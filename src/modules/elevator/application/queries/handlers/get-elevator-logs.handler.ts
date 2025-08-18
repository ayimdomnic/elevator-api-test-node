// src/modules/elevator/application/queries/handlers/get-elevator-logs.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { GetElevatorLogsQuery } from '../get-elevator-logs.query';
import { ElevatorEventStore } from '../../../infrastructure/persistence/event-store/elevator-event.store';

@QueryHandler(GetElevatorLogsQuery)
@Injectable()
export class GetElevatorLogsHandler
  implements IQueryHandler<GetElevatorLogsQuery>
{
  constructor(private readonly eventStore: ElevatorEventStore) {}

  async execute(query: GetElevatorLogsQuery) {
    return this.eventStore.getEventsByDateRange(
      query.startDate,
      query.endDate,
      query.elevatorId,
    );
  }
}
