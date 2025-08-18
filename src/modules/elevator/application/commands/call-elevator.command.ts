export class CallElevatorCommand {
  constructor(
    public readonly fromFloor: number,
    public readonly toFloor: number,
    public readonly userId?: string,
  ) {}
}
