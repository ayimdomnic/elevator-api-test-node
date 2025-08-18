import { Redis } from 'ioredis';
import { GetElevatorStatusQuery } from '../get-elevator-status.query';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetElevatorStatusQuery)
export class GetElevatorStatusHandler
  implements IQueryHandler<GetElevatorStatusQuery>
{
  constructor(private readonly redis: Redis) {}

  async execute(query: GetElevatorStatusQuery) {
    const state = await this.redis.get(`elevator:${query.elevatorId}:state`);
    return JSON.parse(state);
  }
}
