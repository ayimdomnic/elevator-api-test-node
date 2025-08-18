import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
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
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async findById(id: string): Promise<ElevatorAggregate> {
    let elevator = await this.elevatorRepo.findOne({ where: { id } });

    if (!elevator) {
      elevator = this.elevatorRepo.create({
        id,
        currentFloor: 0,
        state: 'IDLE',
        direction: 'IDLE',
      });
      await this.elevatorRepo.save(elevator);
      
      await this.updateRedisState(id, elevator);
    }

    const currentFloor = new Floor(elevator.currentFloor);
    const state = new ElevatorState(elevator.state as 
      'IDLE' | 'MOVING' | 'DOORS_OPENING' | 'DOORS_CLOSING' | 'MAINTENANCE');

    const events = await this.eventRepo.find({
      where: { aggregateId: id },
      order: { sequenceNumber: 'ASC' },
    });

    const aggregate = new ElevatorAggregate(
      id,
      currentFloor,
      state
    );

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

    await this.elevatorRepo.upsert(elevatorData, ['id']);
    
    await this.updateRedisState(aggregate.id, elevatorData);

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

  private async updateRedisState(elevatorId: string, elevatorData: any): Promise<void> {
    try {
      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        currentFloor: elevatorData.currentFloor?.toString() || '0',
        state: elevatorData.state || 'IDLE',
        direction: elevatorData.direction || 'IDLE',
        targetFloor: elevatorData.targetFloor?.toString() || '',
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Failed to update Redis state for elevator ${elevatorId}:`, error);
    }
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
    
    await this.updateRedisState(elevatorId, elevator);

    const currentFloor = new Floor(0);
    const state = new ElevatorState('IDLE');
    
    return new ElevatorAggregate(elevatorId, currentFloor, state);
  }

  async getCurrentState(elevatorId: string): Promise<any> {
    const state = await this.redis.hgetall(`elevator:${elevatorId}:state`);
    return {
      currentFloor: parseInt(state.currentFloor) || 0,
      state: state.state || 'IDLE',
      direction: state.direction || 'IDLE',
      targetFloor: state.targetFloor ? parseInt(state.targetFloor) : null,
      lastUpdated: state.lastUpdated,
    };
  }
}