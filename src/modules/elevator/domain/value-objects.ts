export class ElevatorId {
  constructor(public readonly value: string) {
    if (!value) throw new Error('Elevator ID is required');
  }
}

export class Floor {
  constructor(public readonly value: number) {
    if (value < 0 || value > 100) throw new Error('Invalid floor');
  }
}
