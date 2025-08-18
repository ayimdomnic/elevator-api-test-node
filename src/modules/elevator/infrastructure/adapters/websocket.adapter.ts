import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/elevators',
})
export class WebSocketAdapter implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketAdapter.name);
  private connectedClients = new Set<string>();

  handleConnection(client: Socket): void {
    this.connectedClients.add(client.id);
    this.logger.log(`Client connected: ${client.id}. Total: ${this.connectedClients.size}`);
    
    client.emit('connection-established', {
      clientId: client.id,
      timestamp: new Date(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}. Total: ${this.connectedClients.size}`);
  }

  broadcast(event: string, data: any): void {
    if (!this.server) {
      this.logger.warn(`WebSocket server not initialized, cannot broadcast ${event}`);
      return;
    }

    const connectedClientsCount = this.connectedClients.size;
    
    if (connectedClientsCount === 0) {
      this.logger.debug(`No clients connected, skipping broadcast of ${event}`);
      return;
    }

    this.logger.debug(`Broadcasting ${event} to ${connectedClientsCount} clients:`, data);
    
    const enrichedData = {
      ...data,
      eventType: event,
      broadcastTime: new Date(),
      clientCount: connectedClientsCount,
    };

    this.server.emit(event, enrichedData);
  }

  broadcastElevatorUpdate(elevatorId: string, state: any): void {
    this.broadcast('elevator-update', {
      elevatorId,
      ...state,
    });
  }

  broadcastMovementProgress(elevatorId: string, progress: number, currentFloor: number): void {
    this.broadcast('elevator-movement-progress', {
      elevatorId,
      progress,
      currentFloor,
      timestamp: new Date(),
    });
  }

  broadcastElevatorStatus(elevators: any[]): void {
    this.broadcast('elevators-status', {
      elevators,
      count: elevators.length,
    });
  }

  sendToClient(clientId: string, event: string, data: any): void {
    if (this.server) {
      this.server.to(clientId).emit(event, data);
    }
  }

  getConnectionStats(): { connectedClients: number; serverActive: boolean } {
    return {
      connectedClients: this.connectedClients.size,
      serverActive: !!this.server,
    };
  }
}