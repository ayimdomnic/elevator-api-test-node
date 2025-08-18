import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { EventBus } from '@nestjs/cqrs';
import Redis from 'ioredis';
import { WebSocketAdapter } from '../../adapters/websocket.adapter';
import { ElevatorArrivedEvent } from '../../../application/events/elevator-arrived.event';

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
  private readonly FLOOR_TRAVEL_TIME = 2000;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly eventBus: EventBus,
    private readonly websocketAdapter: WebSocketAdapter,
  ) {}

  @Process('move')
  async handleMovement(job: Job<MovementJobData>): Promise<void> {
    const { elevatorId, fromFloor, toFloor, direction } = job.data;
    
    this.logger.log(`Starting movement for elevator ${elevatorId}: ${fromFloor} -> ${toFloor}`);

    try {
      let currentFloor = fromFloor;
      const increment = direction === 'UP' ? 1 : -1;

      while (currentFloor !== toFloor) {
        const progress = Math.abs(currentFloor - fromFloor) / Math.abs(toFloor - fromFloor) * 100;
        job.progress(progress);

        currentFloor += increment;
        
        await this.updateFloorPosition(elevatorId, currentFloor, toFloor, direction);
        
        this.websocketAdapter.broadcast('elevator-movement', {
          elevatorId,
          currentFloor,
          targetFloor: toFloor,
          direction,
          isMoving: true,
          progress,
          timestamp: new Date(),
        });

        this.logger.debug(`Elevator ${elevatorId} reached floor ${currentFloor}`);

        if (currentFloor !== toFloor) {
          await this.delay(this.FLOOR_TRAVEL_TIME);
        }
      }

      await this.completeMovement(elevatorId, toFloor);
      
      this.logger.log(`Elevator ${elevatorId} completed movement to floor ${toFloor}`);
      
    } catch (error) {
      this.logger.error(`Movement failed for elevator ${elevatorId}:`, error);
      
      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        state: 'IDLE',
        direction: 'IDLE',
        targetFloor: '',
        lastUpdated: new Date().toISOString(),
      });
      
      this.websocketAdapter.broadcast('elevator-error', {
        elevatorId,
        error: 'Movement failed',
        timestamp: new Date(),
      });
      
      throw error;
    }
  }

  private async updateFloorPosition(
    elevatorId: string, 
    currentFloor: number, 
    targetFloor: number, 
    direction: string
  ): Promise<void> {
    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      currentFloor: currentFloor.toString(),
      state: 'MOVING',
      direction,
      targetFloor: targetFloor.toString(),
      lastUpdated: new Date().toISOString(),
    });
  }

  private async completeMovement(elevatorId: string, finalFloor: number): Promise<void> {
    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      currentFloor: finalFloor.toString(),
      state: 'DOORS_OPENING',
      direction: 'IDLE',
      targetFloor: '',
      lastUpdated: new Date().toISOString(),
    });

    const arrivalEvent = new ElevatorArrivedEvent(
      elevatorId,
      finalFloor,
      new Date()
    );
    
    this.eventBus.publish(arrivalEvent);

    this.websocketAdapter.broadcast('elevator-arrived', {
      elevatorId,
      currentFloor: finalFloor,
      state: 'DOORS_OPENING',
      timestamp: new Date(),
    });

    setTimeout(async () => {
      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        state: 'DOORS_CLOSING',
        lastUpdated: new Date().toISOString(),
      });
      
      this.websocketAdapter.broadcast('elevator-update', {
        elevatorId,
        state: 'DOORS_CLOSING',
        timestamp: new Date(),
      });
    }, 3000);

    setTimeout(async () => {
      await this.redis.hmset(`elevator:${elevatorId}:state`, {
        state: 'IDLE',
        lastUpdated: new Date().toISOString(),
      });
      
      this.websocketAdapter.broadcast('elevator-update', {
        elevatorId,
        state: 'IDLE',
        timestamp: new Date(),
      });
    }, 6000); // 6 seconds total for door cycle
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  @Process('emergency-stop')
  async handleEmergencyStop(job: Job<{ elevatorId: string }>): Promise<void> {
    const { elevatorId } = job.data;
    
    this.logger.warn(`Emergency stop for elevator ${elevatorId}`);
    
    await this.redis.hmset(`elevator:${elevatorId}:state`, {
      state: 'MAINTENANCE',
      direction: 'IDLE',
      targetFloor: '',
      lastUpdated: new Date().toISOString(),
    });

    this.websocketAdapter.broadcast('elevator-emergency-stop', {
      elevatorId,
      timestamp: new Date(),
    });
  }
}