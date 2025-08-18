export class ElevatorBusyException extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ElevatorBusyException';
      
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, ElevatorBusyException);
      }
    }
  
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        stack: this.stack,
      };
    }
  }