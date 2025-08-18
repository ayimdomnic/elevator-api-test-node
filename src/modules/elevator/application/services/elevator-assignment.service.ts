import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class ElevatorAssignmentService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async assignElevator(fromFloor: number, toFloor: number): Promise<string> {
    const elevatorKeys = await this.redis.keys('elevator:*:state');
    const elevators = await Promise.all(
      elevatorKeys.map(async (key) => {
        const elevatorId = key.split(':')[1];
        const state = await this.redis.hgetall(key);
        return {
          id: elevatorId,
          currentFloor: parseInt(state.currentFloor) || 0,
          state: state.state || 'IDLE',
          direction: state.direction || 'IDLE',
          targetFloor: state.targetFloor ? parseInt(state.targetFloor) : null,
        };
      }),
    );

    const availableElevators = elevators.filter((e) => e.state === 'IDLE');

    if (availableElevators.length === 0) {
      return elevators[0]?.id || 'elevator-1';
    }

    const closest = availableElevators.reduce((prev, curr) => {
      const prevDistance = Math.abs(prev.currentFloor - fromFloor);
      const currDistance = Math.abs(curr.currentFloor - fromFloor);
      return currDistance < prevDistance ? curr : prev;
    });

    return closest.id;
  }
}
