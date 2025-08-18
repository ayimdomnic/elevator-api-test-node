import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import Redis from 'ioredis';
import { WebSocketAdapter } from './websocket.adapter';

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
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly websocketAdapter: WebSocketAdapter,
  ) {
    this.setupQueueEventListeners();
  }

  async addMovementJob(data: MovementJobData): Promise<void> {
    try {
      await this.removeExistingJobs(data.elevatorId);

      const job = await this.movementQueue.add('move', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
        jobId: `elevator-${data.elevatorId}-${Date.now()}`,
      });

      await this.redis.set(
        `elevator:${data.elevatorId}:active-job`,
        job.id,
        'EX',
        300
      );

      this.logger.log(`Added movement job ${job.id} for elevator ${data.elevatorId}: ${data.fromFloor} -> ${data.toFloor} (${data.direction})`);

      this.websocketAdapter.broadcast('movement-job-started', {
        elevatorId: data.elevatorId,
        jobId: job.id,  
        fromFloor: data.fromFloor,
        toFloor: data.toFloor,
        direction: data.direction,
        estimatedDuration: Math.abs(data.toFloor - data.fromFloor) * 2000, // 2 seconds per floor
      });

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
          this.logger.log(`Removed waiting movement job ${job.id} for elevator ${elevatorId}`);
        }
      }

      for (const job of activeJobs) {
        if (job.data && job.data.elevatorId === elevatorId) {
          this.logger.log(`Found active movement job ${job.id} for elevator ${elevatorId}, letting it complete`);
        }
      }

      await this.redis.del(`elevator:${elevatorId}:active-job`);

    } catch (error) {
      this.logger.error(`Error removing existing jobs for elevator ${elevatorId}:`, error);
    }
  }

  private setupQueueEventListeners(): void {
    this.movementQueue.on('active', (job) => {
      this.logger.log(`Movement job ${job.id} started for elevator ${job.data.elevatorId}`);
      
      this.websocketAdapter.broadcast('movement-job-active', {
        elevatorId: job.data.elevatorId,
        jobId: job.id,
        status: 'active',
      });
    });

    this.movementQueue.on('completed', async (job) => {
      this.logger.log(`Movement job ${job.id} completed for elevator ${job.data.elevatorId}`);
      
      await this.redis.del(`elevator:${job.data.elevatorId}:active-job`);
      
      this.websocketAdapter.broadcast('movement-job-completed', {
        elevatorId: job.data.elevatorId,
        jobId: job.id,
        status: 'completed',
      });
    });

    this.movementQueue.on('failed', async (job, err) => {
      this.logger.error(`Movement job ${job.id} failed for elevator ${job.data.elevatorId}:`, err);
      
      await this.redis.del(`elevator:${job.data.elevatorId}:active-job`);
      
      this.websocketAdapter.broadcast('movement-job-failed', {
        elevatorId: job.data.elevatorId,
        jobId: job.id,
        status: 'failed',
        error: err.message,
      });
    });

    this.movementQueue.on('progress', (job, progress) => {
      this.logger.debug(`Movement job ${job.id} progress: ${progress}%`);
      
      this.websocketAdapter.broadcast('movement-progress', {
        elevatorId: job.data.elevatorId,
        jobId: job.id,
        progress,
      });
    });
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
        elevatorId: job.data?.elevatorId,
        data: job.data,
        opts: job.opts,
      })),
      activeJobs: active.map(job => ({
        id: job.id,
        elevatorId: job.data?.elevatorId,
        data: job.data,
        opts: job.opts,
        progress: job.progress(),
      })),
    };
  }

  async hasActiveMovement(elevatorId: string): Promise<boolean> {
    const jobId = await this.redis.get(`elevator:${elevatorId}:active-job`);
    if (!jobId) return false;

    try {
      const job = await this.movementQueue.getJob(jobId);
      return job ? ['active', 'waiting'].includes(await job.getState()) : false;
    } catch {
      await this.redis.del(`elevator:${elevatorId}:active-job`);
      return false;
    }
  }
}