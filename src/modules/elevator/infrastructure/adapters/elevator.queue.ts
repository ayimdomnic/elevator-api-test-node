// infrastructure/adapters/elevator.queue.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

interface MovementJobData {
  elevatorId: string;
  fromFloor: number;
  toFloor: number;
  direction: 'UP' | 'DOWN' | 'IDLE';
}

@Injectable()
export class ElevatorMovementQueue {
  private readonly logger = new Logger(ElevatorMovementQueue.name);

  constructor(
    @InjectQueue('elevator-movement') private readonly movementQueue: Queue,
  ) {}

  async addMovementJob(data: MovementJobData): Promise<void> {
    try {
      await this.removeExistingJobs(data.elevatorId);

      await this.movementQueue.add('move', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.log(`Added movement job for elevator ${data.elevatorId}: ${data.fromFloor} -> ${data.toFloor} (${data.direction})`);
    } catch (error) {
      this.logger.error(`Failed to add movement job for elevator ${data.elevatorId}:`, error);
      throw error;
    }
  }

  private async removeExistingJobs(elevatorId: string): Promise<void> {
    try {
      const waitingJobs = await this.movementQueue.getWaiting();
      const activeJobs = await this.movementQueue.getActive();

      for (const job of waitingJobs) {
        if (job.data && job.data.elevatorId === elevatorId) {
          await job.remove();
          this.logger.log(`Removed waiting movement job for elevator ${elevatorId}`);
        }
      }

      for (const job of activeJobs) {
        if (job.data && job.data.elevatorId === elevatorId) {
          this.logger.log(`Found active movement job for elevator ${elevatorId}, letting it complete`);
        }
      }
    } catch (error) {
      this.logger.error(`Error removing existing jobs for elevator ${elevatorId}:`, error);
    }
  }

  async getQueueStats(): Promise<any> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.movementQueue.getWaiting(),
      this.movementQueue.getActive(), 
      this.movementQueue.getCompleted(),
      this.movementQueue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      waitingJobs: waiting.map(job => ({
        id: job.id,
        data: job.data,
        opts: job.opts,
      })),
      activeJobs: active.map(job => ({
        id: job.id,
        data: job.data,
        opts: job.opts,
      })),
    };
  }
}