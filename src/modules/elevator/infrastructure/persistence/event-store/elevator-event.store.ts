import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ElevatorEventStore {
  constructor(private readonly dataSource: DataSource) {}

  async save(aggregateId: string, events: any[]) {
    await this.dataSource.transaction(async (manager) => {
      for (const event of events) {
        await manager.insert('elevator_events', {
          elevatorId: aggregateId,
          event_type: event.constructor.name,
          payload: event,
        });
      }
    });
  }
}
