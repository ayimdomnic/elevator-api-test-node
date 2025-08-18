export class ElevatorState {
  private static readonly VALID_STATES = [
    'IDLE',
    'MOVING',
    'DOORS_OPENING',
    'DOORS_CLOSING',
    'MAINTENANCE',
  ] as const;

  constructor(
    public readonly value: (typeof ElevatorState.VALID_STATES)[number],
  ) {
    if (!ElevatorState.VALID_STATES.includes(value)) {
      throw new Error(`Invalid elevator state: ${value}`);
    }
  }
}

export class Floor {
  constructor(public readonly value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error(`Invalid floor: ${value}. Must be between 0-100`);
    }
  }
}

export class ElevatorId {
  constructor(public readonly value: string) {
    if (!value || typeof value !== 'string') {
      throw new Error('Elevator ID must be a non-empty string');
    }
  }
}
