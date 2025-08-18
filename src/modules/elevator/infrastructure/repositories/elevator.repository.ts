import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElevatorAggregate } from '../../domain/elevator.aggregate';
import { ElevatorEntity, ElevatorEventEntity } from '../persistence/entities';
import { ElevatorState, Floor } from '../../domain/value-objects';

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

    // Convert database types to domain value objects
    const currentFloor = new Floor(elevator.currentFloor);
    const state = new ElevatorState(elevator.state as 
      'IDLE' | 'MOVING' | 'DOORS_OPENING' | 'DOORS_CLOSING' | 'MAINTENANCE');

    // Reconstruct from events (Event Sourcing)
    const events = await this.eventRepo.find({
      where: { aggregateId: id },
      order: { sequenceNumber: 'ASC' },
    });

    const aggregate = new ElevatorAggregate(
      id,
      currentFloor,
      state
    );

    // Apply events to rebuild state
    // (In a real implementation, you'd replay events to rebuild the aggregate)
    // For now, we'll just return the aggregate with current state
    return aggregate;
  }

  async save(aggregate: ElevatorAggregate): Promise<void> {
    
    const elevatorData = {
      id: aggregate.id,
      currentFloor: aggregate.currentFloor,
      state: aggregate.state,
      direction: aggregate.direction,
      targetFloor: aggregate.targetFloor,
    };

    
    await this.elevatorRepo.upsert(
      elevatorData,
      ['id']
    );

    
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

  async createElevator(elevatorId: string): Promise<ElevatorAggregate> {
    
    const elevator = this.elevatorRepo.create({
      id: elevatorId,
      currentFloor: 0,
      state: 'IDLE',
      direction: 'IDLE',
      targetFloor: null,
      isActive: true,
    });
    
    await this.elevatorRepo.save(elevator);

    const currentFloor = new Floor(0);
    const state = new ElevatorState('IDLE');
    
    return new ElevatorAggregate(elevatorId, currentFloor, state);
  }
}