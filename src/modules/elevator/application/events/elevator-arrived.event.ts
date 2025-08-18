export class ElevatorArrivedEvent {
  constructor(
    public readonly elevatorId: string,
    public readonly floor: number,
    public readonly timestamp: Date,
  ) {}
}
