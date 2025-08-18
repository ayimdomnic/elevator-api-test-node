
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { InitializeElevatorCommand } from '../intialize-elevator.command'
import { v4 as uuidv4 } from 'uuid';
import { ElevatorRepository } from '../../../infrastructure/repositories/elevator.repository';

@CommandHandler(InitializeElevatorCommand)
@Injectable()
export class InitializeElevatorHandler implements ICommandHandler<InitializeElevatorCommand> {
  private readonly logger = new Logger(InitializeElevatorHandler.name);

  constructor(private readonly repository: ElevatorRepository) {}

  async execute(command: InitializeElevatorCommand): Promise<{ elevatorId: string }> {
    const elevatorId = `${uuidv4()}`;
    const initialFloor = command.initialFloor || 0;

    this.logger.log(`Initializing new elevator ${elevatorId} at floor ${initialFloor}`);

    const elevator = await this.repository.findById(elevatorId);
    await this.repository.save(elevator);

    return { elevatorId };
  }
}