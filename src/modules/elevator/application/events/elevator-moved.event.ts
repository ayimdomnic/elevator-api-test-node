export class ElevatorMovingEvent {
  constructor(
    public readonly elevatorId: string,
    public readonly fromFloor: number,
    public readonly toFloor: number,
    public readonly direction: 'UP' | 'DOWN' | 'IDLE',
    public readonly timestamp: Date,
  ) {}
}
