// src/modules/elevator/infrastructure/persistence/event-store/elevator-event.store.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElevatorEventEntity } from '../entities/elevator-event.entity';

@Injectable()
export class ElevatorEventStore {
  constructor(
    @InjectRepository(ElevatorEventEntity)
    private readonly eventRepository: Repository<ElevatorEventEntity>,
  ) {}

  async saveEvents(
    aggregateId: string,
    events: any[],
    expectedVersion: number,
  ): Promise<void> {
    const eventEntities = events.map((event, index) => ({
      aggregateId,
      eventType: event.constructor.name,
      payload: event,
      sequenceNumber: expectedVersion + index + 1,
      createdAt: new Date(),
    }));

    await this.eventRepository.save(eventEntities);
  }

  async getEvents(
    aggregateId: string,
    fromVersion: number = 0,
  ): Promise<ElevatorEventEntity[]> {
    return this.eventRepository.find({
      where: {
        aggregateId,
        sequenceNumber: fromVersion > 0 ? fromVersion : undefined,
      },
      order: { sequenceNumber: 'ASC' },
    });
  }

  async getEventsByType(
    eventType: string,
    limit: number = 100,
  ): Promise<ElevatorEventEntity[]> {
    return this.eventRepository.find({
      where: { eventType },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getEventsByDateRange(
    startDate: Date,
    endDate: Date,
    elevatorId?: string,
  ): Promise<ElevatorEventEntity[]> {
    const query = this.eventRepository
      .createQueryBuilder('event')
      .where('event.createdAt >= :startDate', { startDate })
      .andWhere('event.createdAt <= :endDate', { endDate });

    if (elevatorId) {
      query.andWhere('event.aggregateId = :elevatorId', { elevatorId });
    }

    return query.orderBy('event.createdAt', 'DESC').getMany();
  }
}
