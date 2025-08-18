import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { GetAllElevatorsQuery } from '../get-all-elevators.query';

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
      
      const elevatorId = keys[index].split(':')[1];
      return {
        elevatorId,
        currentFloor: parseInt(state.currentFloor as string) || 0,
        state: state.state as string || 'IDLE',
        direction: state.direction as string || 'IDLE',
        targetFloor: state.targetFloor ? parseInt(state.targetFloor as string) : null,
        lastUpdated: state.lastUpdated ? new Date(state.lastUpdated as string) : new Date(),
      };
    });
  }
}