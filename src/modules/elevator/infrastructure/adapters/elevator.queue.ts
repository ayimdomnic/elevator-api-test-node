import { Injectable, Inject } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { WebSocketAdapter } from './websocket.adapter';
import { ElevatorRepository } from '../repositories/elevator.repository';

interface MovementJobData {
  elevatorId: string;
  fromFloor: number;
  toFloor: number;
  direction: 'UP' | 'DOWN';
}

@Injectable()
export class ElevatorMovementQueue {
  private readonly queue: Queue;
  private readonly worker: Worker;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly repository: ElevatorRepository,
    private readonly websocketAdapter: WebSocketAdapter,
  ) {
    this.queue = new Queue('elevator-movement', {
      connection: this.redis,
    });

    this.worker = new Worker(
      'elevator-movement',
      async (job: Job<MovementJobData>) => this.processMovement(job),
      {
        connection: this.redis,
        concurrency: 10,
      },
    );
  }

  async addMovementJob(data: MovementJobData): Promise<void> {
    await this.queue.add('move', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async processMovement(job: Job<MovementJobData>): Promise<void> {
    const { elevatorId, fromFloor, toFloor } = job.data;
    const elevator = await this.repository.findById(elevatorId);

    let currentFloor = fromFloor;
    const direction = toFloor > fromFloor ? 1 : -1;

    while (currentFloor !== toFloor) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      currentFloor += direction;
      elevator.moveOneFloor();

      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        currentFloor,
        lastUpdated: new Date().toISOString(),
      });

      this.websocketAdapter.broadcast('elevator-update', {
        elevatorId,
        currentFloor,
        state: currentFloor === toFloor ? 'ARRIVED' : 'MOVING',
        direction:
          currentFloor === toFloor ? 'IDLE' : direction > 0 ? 'UP' : 'DOWN',
      });

      await this.repository.save(elevator);
    }

    await this.simulateDoorsOpening(elevatorId, currentFloor);
  }

  private async simulateDoorsOpening(
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

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'DOORS_CLOSING',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-update', {
      elevatorId,
      state: 'DOORS_CLOSING',
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

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
    });
  }
}
