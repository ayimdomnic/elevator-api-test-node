export class GetElevatorLogsQuery {
    constructor(
        public readonly elevatorId: string,
        public readonly startDate: Date,
        public readonly endDate: Date,
    ) {}
  }
  
  