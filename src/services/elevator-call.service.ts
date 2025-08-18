import { Queue } from 'bull';
import { ElevatorRepository } from '../repositories/elevator.respository';
import { ElevatorEventLoggingService } from './elevator-event-logging.service';
import { Elevator, ElevatorCallRequest } from '../models/elevator';

export class ElevatorCallService {
  private repository: ElevatorRepository;
  private elevatorQueue: Queue;
  private loggingService: ElevatorEventLoggingService;

  constructor(
    repository: ElevatorRepository,
    elevatorQueue: Queue,
    loggingService: ElevatorEventLoggingService
  ) {
    this.repository = repository;
    this.elevatorQueue = elevatorQueue;
    this.loggingService = loggingService;
  }

  async callElevator(
    request: ElevatorCallRequest,
    requestId: string
  ): Promise<{ elevator: Elevator; estimatedTime: number }> {
    const elevator = request.elevatorId
      ? await this.repository.getElevatorById(request.elevatorId)
      : await this.repository.findOptimalElevator(request.fromFloor);

    if (!elevator) {
      throw new Error('No available elevator found');
    }

    const updatedElevator = await this.repository.updateElevatorTarget(
      elevator.id,
      request.toFloor
    );

    await this.elevatorQueue.add('moveElevator', {
      elevatorId: elevator.id,
      fromFloor: request.fromFloor,
      toFloor: request.toFloor,
      requestId,
    });

    await this.loggingService.logElevatorEvent({
      elevatorId: elevator.id,
      eventType: 'CALL_REQUESTED',
      fromFloor: request.fromFloor,
      toFloor: request.toFloor,
      currentFloor: elevator.currentFloor,
      requestId,
      metadata: { request },
    });

    const estimatedTime = this.calculateEstimatedTime(elevator, request);

    return { elevator: updatedElevator, estimatedTime };
  }

  private calculateEstimatedTime(
    elevator: Elevator,
    request: ElevatorCallRequest
  ): number {
    const floorsToTravel =
      Math.abs(elevator.currentFloor - request.fromFloor) +
      Math.abs(request.fromFloor - request.toFloor);
    return floorsToTravel * 5 + 4;
  }
}
