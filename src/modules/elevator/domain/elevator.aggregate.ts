// src/modules/elevator/domain/elevator.aggregate.ts
import { AggregateRoot } from '@nestjs/cqrs';
import { ElevatorCalledEvent, ElevatorMovingEvent, ElevatorArrivedEvent } from '../application/events';
import { ElevatorState, Floor } from './value-objects/elevator.vo';
import { ElevatorBusyException } from './exceptions/elevator-busy.exception';

export class ElevatorAggregate extends AggregateRoot {
  constructor(
    public readonly id: string,
    private _currentFloor: Floor,
    private _state: ElevatorState,
    private _targetFloor?: Floor,
    private _direction: 'UP' | 'DOWN' | 'IDLE' = 'IDLE',
    private _requestQueue: Floor[] = [],
  ) {
    super();
  }

  get currentFloor(): number { return this._currentFloor.value; }
  get state(): string { return this._state.value; }
  get targetFloor(): number | null { return this._targetFloor?.value || null; }
  get direction(): string { return this._direction; }

  call(fromFloor: number, toFloor: number): void {
    const from = new Floor(fromFloor);
    const to = new Floor(toFloor);

    if (this._state.value === 'MAINTENANCE') {
      throw new ElevatorBusyException('Elevator is under maintenance');
    }

    if (!this._requestQueue.some(f => f.value === from.value)) {
      this._requestQueue.push(from);
    }
    if (!this._requestQueue.some(f => f.value === to.value)) {
      this._requestQueue.push(to);
    }

    this.apply(new ElevatorCalledEvent(
      this.id,
      fromFloor,
      toFloor,
      new Date(),
    ));

    this.processNextRequest();
  }

  private processNextRequest(): void {
    if (this._state.value !== 'IDLE' || this._requestQueue.length === 0) {
      return;
    }

    const nextFloor = this._requestQueue.shift();
    this._targetFloor = nextFloor;
    
    if (nextFloor.value > this._currentFloor.value) {
      this._direction = 'UP';
    } else if (nextFloor.value < this._currentFloor.value) {
      this._direction = 'DOWN';
    } else {
      this._direction = 'IDLE';
      return;
    }

    this._state = new ElevatorState('MOVING');
    this.apply(new ElevatorMovingEvent(
      this.id,
      this._currentFloor.value,
      nextFloor.value,
      this._direction,
      new Date(),
    ));
  }

  moveOneFloor(): void {
    if (this._state.value !== 'MOVING' || !this._targetFloor) {
      return;
    }

    if (this._direction === 'UP') {
      this._currentFloor = new Floor(this._currentFloor.value + 1);
    } else if (this._direction === 'DOWN') {
      this._currentFloor = new Floor(this._currentFloor.value - 1);
    }

    if (this._currentFloor.value === this._targetFloor.value) {
      this._state = new ElevatorState('DOORS_OPENING');
      this._direction = 'IDLE';
      this._targetFloor = undefined;

      this.apply(new ElevatorArrivedEvent(
        this.id,
        this._currentFloor.value,
        new Date(),
      ));

      setTimeout(() => {
        this._state = new ElevatorState('IDLE');
        this.processNextRequest();
      }, 2000);
    }
  }

  static create(id: string, initialFloor: number = 0): ElevatorAggregate {
    return new ElevatorAggregate(
      id,
      new Floor(initialFloor),
      new ElevatorState('IDLE'),
    );
  }
}