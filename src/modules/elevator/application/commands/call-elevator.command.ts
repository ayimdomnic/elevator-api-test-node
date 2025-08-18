export class CallElevatorCommand {
    constructor(
        public readonly elevatorId: string,
        public readonly fromFloor: number,
        public readonly toFloor: number,
    ) {}
}