import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { GetAllElevatorsQuery } from '../get-all-elevators.query';

interface ElevatorState {
  currentFloor?: string;
  state?: string;
  direction?: string;
  targetFloor?: string;
  lastUpdated?: string;
}

@QueryHandler(GetAllElevatorsQuery)
@Injectable()
export class GetAllElevatorsHandler implements IQueryHandler<GetAllElevatorsQuery> {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async execute(query: GetAllElevatorsQuery) {
    const pattern = 'elevator:*:state';
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.hgetall(key));

    const results = await pipeline.exec();
    
    return results.map(([err, state], index) => {
      if (err) throw err;
      
      const typedState = state as ElevatorState;
      const elevatorId = keys[index].split(':')[1];
      return {
        elevatorId,
        currentFloor: typedState.currentFloor ? parseInt(typedState.currentFloor) : 0,
        state: typedState.state || 'IDLE',
        direction: typedState.direction || 'IDLE',
        targetFloor: typedState.targetFloor ? parseInt(typedState.targetFloor) : null,
        lastUpdated: typedState.lastUpdated ? new Date(typedState.lastUpdated) : new Date(),
      };
    });
  }
}