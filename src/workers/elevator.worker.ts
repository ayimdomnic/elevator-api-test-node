import { Job } from 'bull';
import { ElevatorRepository } from '../repositories/elevator.respository';
import { ElevatorEventLoggingService } from '../services/elevator-event-logging.service';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';

interface MoveElevatorJob {
  elevatorId: string;
  fromFloor: number;
  toFloor: number;
  requestId: string;
}

export class ElevatorWorker {
  private repository: ElevatorRepository;
  private loggingService: ElevatorEventLoggingService;
  private cacheService: CacheService;
  private logger: Logger;

  constructor(
    repository: ElevatorRepository,
    loggingService: ElevatorEventLoggingService,
    cacheService: CacheService,
    logger: Logger
  ) {
    this.repository = repository;
    this.loggingService = loggingService;
    this.cacheService = cacheService;
    this.logger = logger;
  }

  async processMoveElevator(job: Job<MoveElevatorJob>) {
    const { elevatorId, fromFloor, toFloor, requestId } = job.data;

    try {
      this.logger.info(`Starting elevator movement`, {
        elevatorId,
        fromFloor,
        toFloor,
        requestId,
      });

      await this.moveElevatorToFloor(elevatorId, fromFloor, requestId);

      await this.operateDoors(elevatorId, 'OPENING', requestId);
      await this.operateDoors(elevatorId, 'CLOSING', requestId);

      await this.moveElevatorToFloor(elevatorId, toFloor, requestId);

      await this.operateDoors(elevatorId, 'OPENING', requestId);
      await this.operateDoors(elevatorId, 'CLOSING', requestId);

      await this.repository.setElevatorIdle(elevatorId);
      await this.loggingService.logElevatorEvent({
        elevatorId,
        eventType: 'ELEVATOR_IDLE',
        state: 'IDLE',
        direction: 'IDLE',
        requestId,
      });
      await this.invalidateCache(elevatorId);

      this.logger.info(`Elevator movement completed`, {
        elevatorId,
        fromFloor,
        toFloor,
        requestId,
      });
    } catch (error) {
      this.logger.error(`Elevator movement failed`, {
        elevatorId,
        error: (error as Error).message,
        requestId,
      });
      throw error;
    }
  }

  private async moveElevatorToFloor(
    elevatorId: string,
    targetFloor: number,
    requestId: string
  ) {
    const elevator = await this.repository.getElevatorById(elevatorId);
    if (!elevator) {
      return;
    }

    const currentFloor = elevator.currentFloor;

    if (currentFloor === targetFloor) {
      return;
    }

    const direction = currentFloor < targetFloor ? 'UP' : 'DOWN';

    await this.repository.updateElevatorState(elevatorId, 'MOVING', direction);
    await this.invalidateCache(elevatorId);

    let floor = currentFloor;
    while (floor !== targetFloor) {
      floor = direction === 'UP' ? floor + 1 : floor - 1;

      await new Promise(resolve => setTimeout(resolve, 5000));

      await this.repository.updateElevatorFloor(elevatorId, floor);
      await this.invalidateCache(elevatorId);

      await this.loggingService.logElevatorEvent({
        elevatorId,
        eventType: 'FLOOR_CHANGED',
        currentFloor: floor,
        direction,
        state: 'MOVING',
        requestId,
      });
    }
  }

  private async operateDoors(
    elevatorId: string,
    operation: 'OPENING' | 'CLOSING',
    requestId: string
  ) {
    const state = operation === 'OPENING' ? 'DOORS_OPENING' : 'DOORS_CLOSING';

    await this.repository.updateElevatorState(elevatorId, state, 'IDLE');
    await this.invalidateCache(elevatorId);

    await this.loggingService.logElevatorEvent({
      elevatorId,
      eventType: `DOORS_${operation}`,
      state,
      requestId,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async invalidateCache(elevatorId: string) {
    await this.cacheService.delete(`elevator:${elevatorId}`);
    await this.cacheService.delete('elevators:all');
  }
}
