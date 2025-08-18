export class InitializeElevatorCommand {
    initialFloor: number;
    constructor(
      public readonly elevatorId: number,
    ) {}
  }
  