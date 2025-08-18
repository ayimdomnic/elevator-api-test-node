import { Redis } from 'ioredis';
import { GetElevatorStatusQuery } from '../get-elevator-status.query';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

@QueryHandler(GetElevatorStatusQuery)
export class GetElevatorStatusHandler
  implements IQueryHandler<GetElevatorStatusQuery>
{
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async execute(query: GetElevatorStatusQuery) {
    const stateKey = `elevator:${query.elevatorId}:state`;
    const state = await this.redis.hgetall(stateKey);

    return {
      elevatorId: query.elevatorId,
      currentFloor: parseInt(state.currentFloor) || 0,
      state: state.state || 'IDLE',
      direction: state.direction || 'IDLE',
      targetFloor: state.targetFloor ? parseInt(state.targetFloor) : null,
      lastUpdated: state.lastUpdated ? new Date(state.lastUpdated) : new Date(),
    };
  }
}
