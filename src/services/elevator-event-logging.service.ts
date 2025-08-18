import { ElevatorLogRepository } from '../repositories/elevator-log.repository';
import { Logger } from '../utils/logger';

export class ElevatorEventLoggingService {
  private repository: ElevatorLogRepository;
  private logger: Logger;

  constructor(repository: ElevatorLogRepository, logger: Logger) {
    this.repository = repository;
    this.logger = logger;
  }

  async logElevatorEvent(data: {
    elevatorId: string;
    eventType: string;
    fromFloor?: number;
    toFloor?: number;
    currentFloor?: number;
    direction?: string;
    state?: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
    userContext?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.repository.logEvent(data);

      this.logger.info('Elevator event logged', {
        elevatorId: data.elevatorId,
        eventType: data.eventType,
        requestId: data.requestId,
      });
    } catch (error) {
      this.logger.error('Failed to log elevator event', {
        error: (error as Error).message,
        data,
      });
    }
  }
}
