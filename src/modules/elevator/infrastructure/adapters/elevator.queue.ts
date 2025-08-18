import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class ElevatorQueue {
  private queue: Queue;
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.queue = new Queue('elevator-movement', {
      connection: this.redis,
    });
  }

  async addMoveJob(elevatorId: string, fromFloor: number, toFloor: number) {
    await this.queue.add('move', { elevatorId, fromFloor, toFloor });
  }
}
