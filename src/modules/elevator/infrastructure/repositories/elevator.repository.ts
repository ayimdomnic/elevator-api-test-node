// src/modules/elevator/infrastructure/repositories/elevator.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElevatorAggregate } from '../../domain/elevator.aggregate';
import { ElevatorEntity, ElevatorEventEntity } from '../persistence/entities';

@Injectable()
export class ElevatorRepository {
  constructor(
    @InjectRepository(ElevatorEntity)
    private readonly elevatorRepo: Repository<ElevatorEntity>,
    @InjectRepository(ElevatorEventEntity)
    private readonly eventRepo: Repository<ElevatorEventEntity>,
  ) {}

  async findById(id: string): Promise<ElevatorAggregate> {
    // Try to load from current state first
    let elevator = await this.elevatorRepo.findOne({ where: { id } });

    if (!elevator) {
      // Create new elevator
      elevator = this.elevatorRepo.create({
        id,
        currentFloor: 0,
        state: 'IDLE',
        direction: 'IDLE',
      });
      await this.elevatorRepo.save(elevator);
    }

    // Reconstruct from events (Event Sourcing)
    const events = await this.eventRepo.find({
      where: { aggregateId: id },
      order: { sequenceNumber: 'ASC' },
    });

    const aggregate = new ElevatorAggregate(
      id,
      elevator.currentFloor,
      elevator.state as any,
    );

    // Apply events to rebuild state
    // (In a real implementation, you'd replay events to rebuild the aggregate)

    return aggregate;
  }

  async save(aggregate: ElevatorAggregate): Promise<void> {
    // Save current state snapshot
    await this.elevatorRepo.upsert(
      {
        id: aggregate.id,
        currentFloor: aggregate.currentFloor,
        state: aggregate.state,
        direction: aggregate.direction,
        targetFloor: aggregate.targetFloor,
      },
      ['id'],
    );

    // Save events
    const events = aggregate.getUncommittedEvents();
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const sequenceNumber = await this.getNextSequenceNumber(aggregate.id);

      await this.eventRepo.save({
        aggregateId: aggregate.id,
        eventType: event.constructor.name,
        payload: event,
        sequenceNumber,
      });
    }

    aggregate.markEventsAsCommitted();
  }

  private async getNextSequenceNumber(aggregateId: string): Promise<number> {
    const lastEvent = await this.eventRepo.findOne({
      where: { aggregateId },
      order: { sequenceNumber: 'DESC' },
    });
    return (lastEvent?.sequenceNumber || 0) + 1;
  }

  async findAll(): Promise<ElevatorEntity[]> {
    return this.elevatorRepo.find({ where: { isActive: true } });
  }
}
