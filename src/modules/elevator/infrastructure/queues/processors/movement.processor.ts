import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { Redis } from 'ioredis';
import { WebSocketAdapter } from '../../adapters/websocket.adapter';
import { ElevatorRepository } from '../../repositories/elevator.repository';

interface MovementJobData {
  elevatorId: string;
  fromFloor: number;
  toFloor: number;
  direction: 'UP' | 'DOWN';
}

@Processor('elevator-movement')
@Injectable()
export class MovementProcessor {
  private readonly logger = new Logger(MovementProcessor.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly repository: ElevatorRepository,
  ) {}

  @Process('move')
  async handleMovement(job: Job<MovementJobData>): Promise<void> {
    const { elevatorId, fromFloor, toFloor, direction } = job.data;

    this.logger.log(
      `Starting movement for elevator ${elevatorId}: ${fromFloor} -> ${toFloor}`,
    );

    let currentFloor = fromFloor;
    const step = direction === 'UP' ? 1 : -1;

    while (currentFloor !== toFloor) {
      await this.delay(5000);
      currentFloor += step;

      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        currentFloor,
        lastUpdated: new Date().toISOString(),
        state: currentFloor === toFloor ? 'ARRIVED' : 'MOVING',
      });

      this.websocketAdapter.broadcast('elevator-update', {
        elevatorId,
        currentFloor,
        state: currentFloor === toFloor ? 'ARRIVED' : 'MOVING',
        direction: currentFloor === toFloor ? 'IDLE' : direction,
        targetFloor: toFloor,
      });

      this.logger.log(`Elevator ${elevatorId} at floor ${currentFloor}`);
    }

    await this.simulateDoors(elevatorId, currentFloor);
  }

  private async simulateDoors(
    elevatorId: string,
    floor: number,
  ): Promise<void> {
    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'DOORS_OPENING',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      currentFloor: floor,
      state: 'DOORS_OPENING',
    });

    await this.delay(2000);

    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'DOORS_OPEN',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      state: 'DOORS_OPEN',
    });

    await this.delay(1000);

    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'DOORS_CLOSING',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      state: 'DOORS_CLOSING',
    });

    await this.delay(2000);

    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'IDLE',
      direction: 'IDLE',
      targetFloor: '',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      state: 'IDLE',
      direction: 'IDLE',
      targetFloor: null,
    });

    this.logger.log(
      `Elevator ${elevatorId} completed journey, now idle at floor ${floor}`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
