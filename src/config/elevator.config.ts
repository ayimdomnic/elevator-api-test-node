type ElevatorConfig = {
  floors: number;
  moveTimerPerFloor: number;
  doorOperationTime: number;
};

export const elevatorConfig: ElevatorConfig = {
  floors: parseInt(process.env.BUILDING_FLOORS),
  moveTimerPerFloor: parseInt(process.env.MOVE_TIMER_PER_FLOOR),
  doorOperationTime: parseInt(process.env.DOOR_OPERATION_TIME),
};
