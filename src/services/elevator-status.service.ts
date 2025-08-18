import { ElevatorRepository } from '../repositories/elevator.respository';
import { CacheService } from './cache.service';
import { Elevator } from '../models/elevator';

export class ElevatorStatusService {
  private repository: ElevatorRepository;
  private cacheService: CacheService;

  constructor(repository: ElevatorRepository, cacheService: CacheService) {
    this.repository = repository;
    this.cacheService = cacheService;
  }

  async getElevatorStatus(elevatorId?: string): Promise<Elevator | Elevator[]> {
    const cacheKey = elevatorId ? `elevator:${elevatorId}` : 'elevators:all';

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const elevators = elevatorId
      ? await this.repository.getElevatorStatus(elevatorId)
      : await this.repository.getAllElevators();

    await this.cacheService.set(cacheKey, elevators, 5);

    return elevators;
  }
}
