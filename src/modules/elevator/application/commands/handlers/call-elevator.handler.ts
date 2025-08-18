import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs";
import { CallElevatorCommand } from "../call-elevator.command";


@CommandHandler(CallElevatorCommand)
export class CallElevatorHandler implements ICommandHandler<CallElevatorCommand> {
    constructor(private readonly commandBus: EventBus) {}

    async execute(command: CallElevatorCommand): Promise<void> {
        const { elevatorId, fromFloor, toFloor } = command;

        console.log({elevatorId, fromFloor, toFloor});
    }
}
