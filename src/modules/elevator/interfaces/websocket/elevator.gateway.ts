import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { Logger, Inject } from '@nestjs/common';
  import Redis from 'ioredis';
  import { ElevatorRepository } from '../../infrastructure/repositories/elevator.repository';
import { ConfigService } from '@nestjs/config';
  
  @WebSocketGateway({
    namespace: '/elevators',
    cors: {
      origin: (origin, callback) => {
        const configService = new ConfigService();
        const allowedOrigins = configService.get('ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:9001').split(',');
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })
  export class ElevatorGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private readonly logger = new Logger(ElevatorGateway.name);
  
    constructor(
      @Inject('REDIS_CLIENT') private readonly redis: Redis,
      private readonly elevatorRepository: ElevatorRepository,
    ) {}
  
    async handleConnection(client: Socket): Promise<void> {
      this.logger.log(`Client connected: ${client.id}`);
      
      // Send current elevator states to newly connected client
      try {
        const elevatorKeys = await this.redis.keys('elevator:*:state');
        const elevatorStates = await Promise.all(
          elevatorKeys.map(async (key) => {
            const elevatorId = key.split(':')[1];
            const state = await this.redis.hgetall(key);
            return {
              elevatorId,
              currentFloor: parseInt(state.currentFloor) || 0,
              state: state.state || 'IDLE',
              direction: state.direction || 'IDLE',
              targetFloor: state.targetFloor ? parseInt(state.targetFloor) : null,
              lastUpdated: state.lastUpdated,
            };
          }),
        );
  
        client.emit('elevator-states', elevatorStates);
      } catch (error) {
        this.logger.error('Error sending initial elevator states:', error);
      }
    }
  
    handleDisconnect(client: Socket): void {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  
    @SubscribeMessage('subscribe-elevator')
    async handleSubscribeElevator(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { elevatorId: string },
    ): Promise<void> {
      const { elevatorId } = data;
      client.join(`elevator-${elevatorId}`);
      
      // Send current state of this specific elevator
      try {
        const state = await this.redis.hgetall(`elevator:${elevatorId}:state`);
        client.emit('elevator-state', {
          elevatorId,
          currentFloor: parseInt(state.currentFloor) || 0,
          state: state.state || 'IDLE',
          direction: state.direction || 'IDLE',
          targetFloor: state.targetFloor ? parseInt(state.targetFloor) : null,
          lastUpdated: state.lastUpdated,
        });
      } catch (error) {
        this.logger.error(`Error subscribing to elevator ${elevatorId}:`, error);
      }
    }
  
    @SubscribeMessage('unsubscribe-elevator')
    handleUnsubscribeElevator(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { elevatorId: string },
    ): void {
      client.leave(`elevator-${data.elevatorId}`);
    }
  
    @SubscribeMessage('get-elevator-status')
    async handleGetElevatorStatus(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { elevatorId: string },
    ): Promise<void> {
      try {
        const state = await this.redis.hgetall(`elevator:${data.elevatorId}:state`);
        client.emit('elevator-status', {
          elevatorId: data.elevatorId,
          currentFloor: parseInt(state.currentFloor) || 0,
          state: state.state || 'IDLE',
          direction: state.direction || 'IDLE',
          targetFloor: state.targetFloor ? parseInt(state.targetFloor) : null,
          lastUpdated: state.lastUpdated,
        });
      } catch (error) {
        this.logger.error(`Error getting elevator status for ${data.elevatorId}:`, error);
        client.emit('error', { message: 'Failed to get elevator status' });
      }
    }
  
    // Methods called by the WebSocketAdapter
    broadcastElevatorUpdate(elevatorId: string, data: any): void {
      this.server.to(`elevator-${elevatorId}`).emit('elevator-update', data);
      this.server.emit('elevator-update', data); // Also broadcast to all clients
    }
  
    broadcastFloorUpdate(elevatorId: string, data: any): void {
      this.server.to(`elevator-${elevatorId}`).emit('elevator-floor-update', data);
      this.server.emit('elevator-floor-update', data);
    }
  
    broadcastDoorUpdate(elevatorId: string, data: any): void {
      this.server.to(`elevator-${elevatorId}`).emit('elevator-doors', data);
      this.server.emit('elevator-doors', data);
    }
  
    broadcastToAll(event: string, data: any): void {
      this.server.emit(event, data);
    }
  
    broadcastToElevator(elevatorId: string, event: string, data: any): void {
      this.server.to(`elevator-${elevatorId}`).emit(event, data);
    }
  }