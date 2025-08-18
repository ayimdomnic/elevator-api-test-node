import { Test, TestingModule } from '@nestjs/testing';
import { ElevatorGateway } from './elevator.gateway';
import { ElevatorRepository } from '../../infrastructure/repositories/elevator.repository';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

jest.mock('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      keys: jest.fn(),
      hgetall: jest.fn(),
    })),
  };
});

describe('ElevatorGateway', () => {
  let gateway: ElevatorGateway;
  let redis: jest.Mocked<Redis>;
  let elevatorRepository: jest.Mocked<ElevatorRepository>;
  let server: jest.Mocked<Server>;
  let client: jest.Mocked<Socket>;

  beforeEach(async () => {
    server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;

    client = {
      id: 'client-123',
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElevatorGateway,
        {
          provide: 'REDIS_CLIENT',
          useValue: {
            keys: jest.fn(),
            hgetall: jest.fn(),
          },
        },
        {
          provide: ElevatorRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<ElevatorGateway>(ElevatorGateway);
    redis = module.get('REDIS_CLIENT');
    elevatorRepository = module.get(ElevatorRepository);
    gateway.server = server;

    // Mock Logger to prevent console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should log connection and send initial elevator states', async () => {
      const elevatorKeys = ['elevator:uuid-1:state', 'elevator:uuid-2:state'];
      const state1 = {
        currentFloor: '5',
        state: 'MOVING',
        direction: 'UP',
        targetFloor: '10',
        lastUpdated: '2025-08-18T18:51:00Z',
      };
      const state2 = {
        currentFloor: '3',
        state: 'IDLE',
        direction: 'IDLE',
        lastUpdated: '2025-08-18T18:50:00Z',
      };

      redis.keys.mockResolvedValue(elevatorKeys);
      redis.hgetall
        .mockResolvedValueOnce(state1)
        .mockResolvedValueOnce(state2);

      await gateway.handleConnection(client);

      expect(Logger.prototype.log).toHaveBeenCalledWith(`Client connected: ${client.id}`);
      expect(redis.keys).toHaveBeenCalledWith('elevator:*:state');
      expect(redis.hgetall).toHaveBeenCalledTimes(2);
      expect(client.emit).toHaveBeenCalledWith('elevator-states', [
        {
          elevatorId: 'uuid-1',
          currentFloor: 5,
          state: 'MOVING',
          direction: 'UP',
          targetFloor: 10,
          lastUpdated: '2025-08-18T18:51:00Z',
        },
        {
          elevatorId: 'uuid-2',
          currentFloor: 3,
          state: 'IDLE',
          direction: 'IDLE',
          targetFloor: null,
          lastUpdated: '2025-08-18T18:50:00Z',
        },
      ]);
    });

    it('should handle Redis errors gracefully', async () => {
      redis.keys.mockRejectedValue(new Error('Redis error'));

      await gateway.handleConnection(client);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error sending initial elevator states:',
        expect.any(Error),
      );
      expect(client.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should log disconnection', () => {
      gateway.handleDisconnect(client);

      expect(Logger.prototype.log).toHaveBeenCalledWith(`Client disconnected: ${client.id}`);
    });
  });

  describe('handleSubscribeElevator', () => {
    it('should join elevator room and send current state', async () => {
      const elevatorId = 'uuid-1';
      const state = {
        currentFloor: '5',
        state: 'MOVING',
        direction: 'UP',
        targetFloor: '10',
        lastUpdated: '2025-08-18T18:51:00Z',
      };

      redis.hgetall.mockResolvedValue(state);

      await gateway.handleSubscribeElevator(client, { elevatorId });

      expect(client.join).toHaveBeenCalledWith(`elevator-${elevatorId}`);
      expect(redis.hgetall).toHaveBeenCalledWith(`elevator:${elevatorId}:state`);
      expect(client.emit).toHaveBeenCalledWith('elevator-state', {
        elevatorId,
        currentFloor: 5,
        state: 'MOVING',
        direction: 'UP',
        targetFloor: 10,
        lastUpdated: '2025-08-18T18:51:00Z',
      });
    });

    it('should handle missing state fields', async () => {
      const elevatorId = 'uuid-1';
      const state = { lastUpdated: '2025-08-18T18:51:00Z' };

      redis.hgetall.mockResolvedValue(state);

      await gateway.handleSubscribeElevator(client, { elevatorId });

      expect(client.emit).toHaveBeenCalledWith('elevator-state', {
        elevatorId,
        currentFloor: 0,
        state: 'IDLE',
        direction: 'IDLE',
        targetFloor: null,
        lastUpdated: '2025-08-18T18:51:00Z',
      });
    });

    it('should handle Redis errors', async () => {
      const elevatorId = 'uuid-1';
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      await gateway.handleSubscribeElevator(client, { elevatorId });

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Error subscribing to elevator ${elevatorId}:`,
        expect.any(Error),
      );
    });
  });

  describe('handleUnsubscribeElevator', () => {
    it('should leave elevator room', () => {
      const elevatorId = 'uuid-1';

      gateway.handleUnsubscribeElevator(client, { elevatorId });

      expect(client.leave).toHaveBeenCalledWith(`elevator-${elevatorId}`);
    });
  });

  describe('handleGetElevatorStatus', () => {
    it('should return elevator status', async () => {
      const elevatorId = 'uuid-1';
      const state = {
        currentFloor: '5',
        state: 'MOVING',
        direction: 'UP',
        targetFloor: '10',
        lastUpdated: '2025-08-18T18:51:00Z',
      };

      redis.hgetall.mockResolvedValue(state);

      await gateway.handleGetElevatorStatus(client, { elevatorId });

      expect(redis.hgetall).toHaveBeenCalledWith(`elevator:${elevatorId}:state`);
      expect(client.emit).toHaveBeenCalledWith('elevator-status', {
        elevatorId,
        currentFloor: 5,
        state: 'MOVING',
        direction: 'UP',
        targetFloor: 10,
        lastUpdated: '2025-08-18T18:51:00Z',
      });
    });

    it('should handle Redis errors', async () => {
      const elevatorId = 'uuid-1';
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      await gateway.handleGetElevatorStatus(client, { elevatorId });

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Error getting elevator status for ${elevatorId}:`,
        expect.any(Error),
      );
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to get elevator status',
      });
    });
  });

  describe('broadcastElevatorUpdate', () => {
    it('should broadcast to elevator room and all clients', () => {
      const elevatorId = 'uuid-1';
      const data = { state: 'MOVING', currentFloor: 5 };

      gateway.broadcastElevatorUpdate(elevatorId, data);

      expect(server.to).toHaveBeenCalledWith(`elevator-${elevatorId}`);
      expect(server.emit).toHaveBeenCalledWith('elevator-update', data);
    });
  });

  describe('broadcastFloorUpdate', () => {
    it('should broadcast to elevator room and all clients', () => {
      const elevatorId = 'uuid-1';
      const data = { currentFloor: 5 };

      gateway.broadcastFloorUpdate(elevatorId, data);

      expect(server.to).toHaveBeenCalledWith(`elevator-${elevatorId}`);
      expect(server.emit).toHaveBeenCalledWith('elevator-floor-update', data);
    });
  });

  describe('broadcastDoorUpdate', () => {
    it('should broadcast to elevator room and all clients', () => {
      const elevatorId = 'uuid-1';
      const data = { doorState: 'OPEN' };

      gateway.broadcastDoorUpdate(elevatorId, data);

      expect(server.to).toHaveBeenCalledWith(`elevator-${elevatorId}`);
      expect(server.emit).toHaveBeenCalledWith('elevator-doors', data);
    });
  });

  describe('broadcastToAll', () => {
    it('should broadcast to all clients', () => {
      const event = 'custom-event';
      const data = { message: 'Hello' };

      gateway.broadcastToAll(event, data);

      expect(server.emit).toHaveBeenCalledWith(event, data);
    });
  });

  describe('broadcastToElevator', () => {
    it('should broadcast to specific elevator room', () => {
      const elevatorId = 'uuid-1';
      const event = 'custom-event';
      const data = { message: 'Hello' };

      gateway.broadcastToElevator(elevatorId, event, data);

      expect(server.to).toHaveBeenCalledWith(`elevator-${elevatorId}`);
      expect(server.emit).toHaveBeenCalledWith(event, data);
    });
  });
});