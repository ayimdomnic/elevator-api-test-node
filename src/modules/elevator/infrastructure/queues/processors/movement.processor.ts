import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { Redis } from 'ioredis';
import { EventBus } from '@nestjs/cqrs';
import { WebSocketAdapter } from '../../adapters/websocket.adapter';
import { ElevatorRepository } from '../../repositories/elevator.repository';

interface MovementJobData {
  elevatorId: string;
  fromFloor: number;
  toFloor: number;
  direction: 'UP' | 'DOWN' | 'IDLE';
}

@Processor('elevator-movement')
@Injectable()
export class MovementProcessor {
  private readonly logger = new Logger(MovementProcessor.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly repository: ElevatorRepository,
    private readonly eventBus: EventBus,
  ) {}

  @Process('move')
  async handleMovement(job: Job<MovementJobData>): Promise<void> {
    const { elevatorId, fromFloor, toFloor, direction } = job.data;

    this.logger.log(
      `Starting movement for elevator ${elevatorId}: ${fromFloor} -> ${toFloor} (${direction})`,
    );

    try {
      await this.processElevatorMovement(elevatorId);
    } catch (error) {
      this.logger.error(`Error processing elevator ${elevatorId} movement:`, error);
      throw error;
    }
  }

  private async processElevatorMovement(elevatorId: string): Promise<void> {
    let elevator = await this.repository.findById(elevatorId);
    
    if (!elevator) {
      this.logger.warn(`Elevator ${elevatorId} not found`);
      return;
    }

    while (elevator.state === 'MOVING' && elevator.targetFloor !== null) {
      this.logger.log(`Elevator ${elevatorId} moving from floor ${elevator.currentFloor} to ${elevator.targetFloor}`);
      
      await this.delay(5000);
      
      elevator.moveOneFloor();
      
      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        currentFloor: elevator.currentFloor,
        state: elevator.state,
        direction: elevator.direction,
        targetFloor: elevator.targetFloor || '',
        lastUpdated: new Date().toISOString(),
      });

      this.websocketAdapter.broadcast('elevator-update', {
        elevatorId,
        currentFloor: elevator.currentFloor,
        state: elevator.state,
        direction: elevator.direction,
        targetFloor: elevator.targetFloor,
      });

      
      await this.repository.save(elevator);
      this.eventBus.publishAll(elevator.getUncommittedEvents());
      elevator.markEventsAsCommitted();

     
      if (elevator.state === 'DOORS_OPENING' as typeof elevator.state) {
        await this.handleDoorSequence(elevatorId, elevator.currentFloor);

        elevator = await this.repository.findById(elevatorId);
        if (!elevator) break;
      }
    }

    this.logger.log(`Movement completed for elevator ${elevatorId}`);
  }

  private async handleDoorSequence(elevatorId: string, currentFloor: number): Promise<void> {
    // DOORS_OPENING (already set by domain)
    this.logger.log(`Elevator ${elevatorId} doors opening at floor ${currentFloor}`);
    
    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'DOORS_OPENING',
      currentFloor,
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      currentFloor,
      state: 'DOORS_OPENING',
      direction: 'IDLE',
    });

    await this.delay(2000);

    
    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'DOORS_OPEN',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      currentFloor,
      state: 'DOORS_OPEN',
      direction: 'IDLE',
    });

    await this.delay(1000);

    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'DOORS_CLOSING',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      currentFloor,
      state: 'DOORS_CLOSING',
      direction: 'IDLE',
    });

    await this.delay(2000);

    const elevator = await this.repository.findById(elevatorId);
    if (elevator) {
      
      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        state: elevator.state,
        direction: elevator.direction,
        targetFloor: elevator.targetFloor || '',
        lastUpdated: new Date().toISOString(),
      });

      this.websocketAdapter.broadcast('elevator-update', {
        elevatorId,
        currentFloor,
        state: elevator.state,
        direction: elevator.direction,
        targetFloor: elevator.targetFloor,
      });

      await this.repository.save(elevator);
      this.eventBus.publishAll(elevator.getUncommittedEvents());
      elevator.markEventsAsCommitted();
    }

    this.logger.log(`Elevator ${elevatorId} completed door sequence, now ${elevator?.state} at floor ${currentFloor}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}