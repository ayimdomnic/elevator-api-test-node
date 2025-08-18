export class ElevatorCalledEvent {
  constructor(
    public readonly elevatorId: string,
    public readonly fromFloor: number,
    public readonly toFloor: number,
    public readonly timestamp: Date,
  ) {}
}
