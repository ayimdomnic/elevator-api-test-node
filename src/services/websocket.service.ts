import WebSocket from 'ws';
import { Server } from 'http';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

interface WebSocketClient {
  ws: WebSocket;
  clientId: string;
  subscriptions: {
    elevatorId?: string;
    eventType?: string;
  };
}

interface WebSocketMessage {
  type: string;
  filters?: {
    elevatorId?: string;
    eventType?: string;
  };
  data?: unknown;
  channel?: string;
  timestamp?: string;
}

export class WebSocketService {
  private wss: WebSocket.Server;
  private redis: Redis;
  private subscriber: Redis;
  private clients: Map<string, WebSocketClient>;
  private logger: Logger;
  constructor(server: Server, redis: Redis, logger: Logger) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws/logs',
    });
    this.redis = redis;
    this.subscriber = redis.duplicate();
    this.clients = new Map();
    this.logger = logger;
    this.setupWebSocketServer();
    this.setupRedisSubscription();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, { ws, clientId, subscriptions: {} });

      this.logger.info('WebSocket client connected', {
        clientId,
        ip: req.socket.remoteAddress,
      });

      ws.on('message', (message: string) =>
        this.handleClientMessage(ws, clientId, message)
      );

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.logger.info('WebSocket client disconnected', { clientId });
      });

      ws.on('error', error => {
        this.logger.error('WebSocket client error', {
          clientId,
          error: (error as Error).message,
        });
      });

      ws.send(
        JSON.stringify({
          type: 'connected',
          clientId,
          message: 'Connected to elevator system logs',
        })
      );
    });
  }

  private setupRedisSubscription() {
    this.subscriber.subscribe('elevator:events', 'elevator:logs', err => {
      if (err) {
        this.logger.error('Redis subscription error', { error: err.message });
      } else {
        this.logger.info('Subscribed to Redis channels', {
          channels: ['elevator:events', 'elevator:logs'],
        });
      }
    });

    this.subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.broadcastToClients({
          type: 'log',
          channel,
          data,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error('Failed to process Redis message', {
          channel,
          error: (error as Error).message,
        });
      }
    });
  }

  private handleClientMessage(
    ws: WebSocket,
    clientId: string,
    message: string
  ) {
    try {
      const data: WebSocketMessage = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) {
        ws.send(JSON.stringify({ type: 'error', message: 'Client not found' }));
        return;
      }

      switch (data.type) {
        case 'subscribe':
          client.subscriptions = { ...data.filters };
          this.logger.info('Client subscription updated', {
            clientId,
            filters: data.filters,
          });
          ws.send(
            JSON.stringify({ type: 'subscribed', filters: data.filters })
          );
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        default:
          ws.send(
            JSON.stringify({ type: 'error', message: 'Unknown message type' })
          );
      }
    } catch (error) {
      this.logger.error('Invalid WebSocket message', {
        clientId,
        error: (error as Error).message,
      });
      ws.send(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      );
    }
  }

  private broadcastToClients(message: WebSocketMessage) {
    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        const { elevatorId, eventType } = client.subscriptions;
        const data = message.data || {};
        if (
          (!elevatorId ||
            (data as { elevatorId?: string }).elevatorId === elevatorId) &&
          (!eventType ||
            (data as { eventType?: string }).eventType === eventType)
        ) {
          client.ws.send(JSON.stringify(message));
        }
      }
    });
  }

  public async publishEvent(channel: string, data: unknown) {
    try {
      await this.redis.publish(channel, JSON.stringify(data));
      this.logger.debug('Published event to Redis', { channel, data });
    } catch (error) {
      this.logger.error('Failed to publish Redis event', {
        channel,
        error: (error as Error).message,
      });
    }
  }

  public async close() {
    await new Promise<void>(resolve => {
      this.wss.close(() => resolve());
    });
    await this.subscriber.quit();
    this.logger.info('WebSocket service closed');
  }

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
