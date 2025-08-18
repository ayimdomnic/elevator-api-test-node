import { Injectable } from '@nestjs/common';
import { ElevatorGateway } from '../../interfaces/websocket/elevator.gateway';

@Injectable()
export class WebSocketAdapter {
  constructor(private readonly gateway: ElevatorGateway) {}

  broadcast(event: string, data: any): void {
    this.gateway.server.emit(event, data);
  }

  broadcastToElevator(elevatorId: string, event: string, data: any): void {
    this.gateway.server.to(`elevator-${elevatorId}`).emit(event, data);
  }
}
