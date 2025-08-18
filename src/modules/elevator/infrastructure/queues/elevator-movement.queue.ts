import { Injectable, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ElevatorRepository } from '../../infrastructure/repositories/elevator.repository';
import { WebSocketAdapter } from '../../infrastructure/adapters/websocket.adapter';

interface MovementJobData {
  elevatorId: string;
  fromFloor: number;
  toFloor: number;
  direction: 'UP' | 'DOWN' | 'IDLE';
}

@Injectable()
export class ElevatorMovementQueue {
  private readonly queue: Queue;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly repository: ElevatorRepository,
    private readonly websocketAdapter: WebSocketAdapter,
  ) {
    this.queue = new Queue('elevator-movement', {
      connection: this.redis,
    });
  }

  async addMovementJob(data: MovementJobData): Promise<void> {
    await this.queue.add('move', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}