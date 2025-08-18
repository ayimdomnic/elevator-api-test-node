import { ElevatorDirection, ElevatorStatus } from '../types';

export interface Elevator {
  id: string;
  name: string;
  currentFloor: number;
  targetFloor?: number;
  direction: ElevatorDirection;
  status: ElevatorStatus;
  isBusy: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ElevatorLog {
  id: string;
  elevatorId: string;
  eventType: string;
  toFloor?: number;
  fromFloor?: number;
  currentFloor?: number;
  direction: ElevatorDirection;
  state?: ElevatorStatus;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  requestId?: string;
  userContext?: Record<string, unknown>;
}

export interface ElevatorCallRequest {
  fromFloor: number;
  toFloor: number;
  elevatorId?: string;
}
