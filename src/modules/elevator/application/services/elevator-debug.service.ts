import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElevatorEntity } from '../../infrastructure/persistence/entities/elevator.entity';
import Redis from 'ioredis';

@Injectable()
export class ElevatorDebugService {
  private readonly logger = new Logger(ElevatorDebugService.name);

  constructor(
    @InjectRepository(ElevatorEntity)
    private readonly elevatorRepo: Repository<ElevatorEntity>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async debugElevatorState(elevatorId: string): Promise<void> {
    this.logger.log(`=== DEBUGGING ELEVATOR ${elevatorId} ===`);

    try {
      // Check database state
      const dbElevator = await this.elevatorRepo.findOne({ where: { id: elevatorId } });
      this.logger.log('Database state:', {
        exists: !!dbElevator,
        data: dbElevator ? {
          id: dbElevator.id,
          currentFloor: dbElevator.currentFloor,
          state: dbElevator.state,
          direction: dbElevator.direction,
          targetFloor: dbElevator.targetFloor,
          updatedAt: dbElevator.updatedAt,
        } : null,
      });

      // Check Redis state
      const redisState = await this.redis.hgetall(`elevator:${elevatorId}:state`);
      this.logger.log('Redis state:', {
        exists: Object.keys(redisState).length > 0,
        data: redisState,
      });

      // Check for any Redis keys related to this elevator
      const elevatorKeys = await this.redis.keys(`elevator:${elevatorId}:*`);
      this.logger.log('All Redis keys for elevator:', elevatorKeys);

    } catch (error) {
      this.logger.error('Error during debugging:', error);
    }
  }

  async compareAllStates(): Promise<void> {
    this.logger.log('=== COMPARING ALL ELEVATOR STATES ===');

    try {
      // Get all elevators from database
      const dbElevators = await this.elevatorRepo.find();
      this.logger.log(`Found ${dbElevators.length} elevators in database`);

      // Get all elevator keys from Redis
      const redisKeys = await this.redis.keys('elevator:*:state');
      this.logger.log(`Found ${redisKeys.length} elevator states in Redis`);

      for (const dbElevator of dbElevators) {
        const redisState = await this.redis.hgetall(`elevator:${dbElevator.id}:state`);
        
        this.logger.log(`Elevator ${dbElevator.id}:`, {
          database: {
            currentFloor: dbElevator.currentFloor,
            state: dbElevator.state,
            direction: dbElevator.direction,
            targetFloor: dbElevator.targetFloor,
            updatedAt: dbElevator.updatedAt,
          },
          redis: redisState,
          inSync: this.isStateInSync(dbElevator, redisState),
        });
      }
    } catch (error) {
      this.logger.error('Error comparing states:', error);
    }
  }

  private isStateInSync(dbElevator: ElevatorEntity, redisState: any): boolean {
    if (Object.keys(redisState).length === 0) return false;
    
    return (
      dbElevator.currentFloor.toString() === redisState.currentFloor &&
      dbElevator.state === redisState.state &&
      dbElevator.direction === redisState.direction
    );
  }
}