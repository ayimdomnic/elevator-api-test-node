import { Injectable, Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { WebSocketAdapter } from '../../infrastructure/adapters/websocket.adapter';
import { ElevatorRepository } from '../../infrastructure/repositories/elevator.repository';

@Injectable()
export class RealtimeStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeStatusService.name);
  private statusInterval: NodeJS.Timeout;
  private readonly STATUS_BROADCAST_INTERVAL = 1000; // 1 second

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly websocketAdapter: WebSocketAdapter,
    private readonly elevatorRepository: ElevatorRepository,
  ) {}

  onModuleInit(): void {
    this.startStatusBroadcasting();
  }

  onModuleDestroy(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  }

  private startStatusBroadcasting(): void {
    this.logger.log('Starting real-time status broadcasting');
    
    this.statusInterval = setInterval(async () => {
      try {
        await this.broadcastElevatorStatuses();
      } catch (error) {
        this.logger.error('Error broadcasting elevator statuses:', error);
      }
    }, this.STATUS_BROADCAST_INTERVAL);
  }

  private async broadcastElevatorStatuses(): Promise<void> {
    try {
      // Get all elevator state keys from Redis
      const elevatorKeys = await this.redis.keys('elevator:*:state');
      
      if (elevatorKeys.length === 0) {
        return;
      }

      const elevatorStatuses = await Promise.all(
        elevatorKeys.map(async (key) => {
          const elevatorId = key.split(':')[1];
          const state = await this.redis.hgetall(key);
          
          return {
            id: elevatorId,
            currentFloor: parseInt(state.currentFloor) || 0,
            state: state.state || 'IDLE',
            direction: state.direction || 'IDLE',
            targetFloor: state.targetFloor ? parseInt(state.targetFloor) : null,
            lastUpdated: state.lastUpdated,
            isMoving: state.state === 'MOVING',
          };
        })
      );

      // Only broadcast if there are connected clients
      const stats = this.websocketAdapter.getConnectionStats();
      if (stats.connectedClients > 0) {
        this.websocketAdapter.broadcastElevatorStatus(elevatorStatuses);
      }

    } catch (error) {
      this.logger.error('Error getting elevator statuses:', error);
    }
  }

  // Manual trigger for immediate status update
  async triggerStatusUpdate(): Promise<void> {
    await this.broadcastElevatorStatuses();
  }

  // Start movement tracking for specific elevator
  async startMovementTracking(elevatorId: string): Promise<void> {
    const trackingKey = `elevator:${elevatorId}:tracking`;
    
    await this.redis.hset(trackingKey, {
      isTracking: 'true',
      startTime: new Date().toISOString(),
    });

    this.logger.log(`Started movement tracking for elevator ${elevatorId}`);
  }

  // Stop movement tracking
  async stopMovementTracking(elevatorId: string): Promise<void> {
    const trackingKey = `elevator:${elevatorId}:tracking`;
    await this.redis.del(trackingKey);
    
    this.logger.log(`Stopped movement tracking for elevator ${elevatorId}`);
  }

  // Get movement history for debugging
  async getMovementHistory(elevatorId: string, limit: number = 50): Promise<any[]> {
    const historyKey = `elevator:${elevatorId}:movement-history`;
    const history = await this.redis.lrange(historyKey, 0, limit - 1);
    
    return history.map(item => JSON.parse(item));
  }

  // Store movement history
  async recordMovement(elevatorId: string, movementData: any): Promise<void> {
    const historyKey = `elevator:${elevatorId}:movement-history`;
    const record = {
      ...movementData,
      timestamp: new Date().toISOString(),
    };

    await this.redis.lpush(historyKey, JSON.stringify(record));
    await this.redis.ltrim(historyKey, 0, 99); // Keep only last 100 records
  }
}