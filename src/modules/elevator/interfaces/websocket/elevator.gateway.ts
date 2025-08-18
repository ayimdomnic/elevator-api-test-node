
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { QueryBus } from '@nestjs/cqrs';
import { GetAllElevatorsQuery } from '../../application/queries';
  
  @WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/elevators',
  })
  export class ElevatorGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    constructor(private readonly queryBus: QueryBus) {}
  
    async handleConnection(client: Socket) {
      console.log(`Client connected: ${client.id}`);
      const elevators = await this.queryBus.execute(new GetAllElevatorsQuery());
      client.emit('initial-state', elevators);
    }
  
    handleDisconnect(client: Socket) {
      console.log(`Client disconnected: ${client.id}`);
    }
  
    @SubscribeMessage('subscribe-elevator')
    handleSubscribeElevator(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { elevatorId: string },
    ) {
      client.join(`elevator-${data.elevatorId}`);
      return { event: 'subscribed', elevatorId: data.elevatorId };
    }
  
    broadcastUpdate(elevatorId: string, update: any) {
      this.server.to(`elevator-${elevatorId}`).emit('elevator-update', update);
      this.server.emit('global-update', update);
    }
  }