import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ElevatorAssignmentService {
  private readonly logger = new Logger(ElevatorAssignmentService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async assignElevator(fromFloor: number, toFloor: number): Promise<string> {
    try {
      const elevatorKeys = await this.redis.keys('elevator:*:state');
      
      if (elevatorKeys.length === 0) {
        this.logger.warn('No elevators found in Redis, creating default elevator');
        const defaultElevatorId = uuidv4();
        await this.redis.hset(`elevator:${defaultElevatorId}:state`, {
          currentFloor: '0',
          state: 'IDLE',
          direction: 'IDLE',
          targetFloor: '',
        });
        return defaultElevatorId;
      }

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
        this.logger.log('No available elevators, assigning to first elevator');
        return elevators[0].id;
      }

      const closest = availableElevators.reduce((prev, curr) => {
        const prevDistance = Math.abs(prev.currentFloor - fromFloor);
        const currDistance = Math.abs(curr.currentFloor - fromFloor);
        return currDistance < prevDistance ? curr : prev;
      });

      this.logger.log(`Assigned elevator ${closest.id} for call ${fromFloor} -> ${toFloor}`);
      return closest.id;
    } catch (error) {
      this.logger.error('Error in elevator assignment:', error);
      
      const fallbackId = uuidv4();
      await this.redis.hset(`elevator:${fallbackId}:state`, {
        currentFloor: '0',
        state: 'IDLE',
        direction: 'IDLE',
        targetFloor: '',
      });
      return fallbackId;
    }
  }
}