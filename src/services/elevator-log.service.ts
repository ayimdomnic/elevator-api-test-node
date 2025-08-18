import { ElevatorLogRepository } from '../repositories/elevator-log.repository';
import { ElevatorLog } from '../models/elevator';

export class ElevatorLogService {
  private repository: ElevatorLogRepository;

  constructor(repository: ElevatorLogRepository) {
    this.repository = repository;
  }

  async getLogs(filters?: {
    elevatorId?: string;
    eventType?: string;
    fromTime?: Date;
    toTime?: Date;
    limit?: number;
  }): Promise<ElevatorLog[]> {
    return this.repository.getLogs(filters);
  }
}
