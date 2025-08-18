import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { CallElevatorCommand } from '../call-elevator.command';
import { ElevatorRepository } from '../../../infrastructure/repositories/elevator.repository';
import { ElevatorAssignmentService } from '../../../application/services/elevator-assignment.service';

@CommandHandler(CallElevatorCommand)
@Injectable()
export class CallElevatorHandler
  implements ICommandHandler<CallElevatorCommand>
{
  private readonly logger = new Logger(CallElevatorHandler.name);

  constructor(
    private readonly repository: ElevatorRepository,
    private readonly assignmentService: ElevatorAssignmentService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CallElevatorCommand): Promise<{ elevatorId: string }> {
    this.logger.log(
      `Processing elevator call: ${command.fromFloor} -> ${command.toFloor}`,
    );

    const elevatorId = await this.assignmentService.assignElevator(
      command.fromFloor,
      command.toFloor,
    );

    let elevator = await this.repository.findById(elevatorId);
    
    if (!elevator) {
      this.logger.log(`Elevator ${elevatorId} not found in database, creating new elevator`);
      elevator = await this.repository.createElevator(elevatorId);
    }

    elevator.call(command.fromFloor, command.toFloor);

    await this.repository.save(elevator);
    this.eventBus.publishAll(elevator.getUncommittedEvents());

    return { elevatorId };
  }
}