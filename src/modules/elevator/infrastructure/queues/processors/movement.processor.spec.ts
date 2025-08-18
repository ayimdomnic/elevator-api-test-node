import { Test, TestingModule } from '@nestjs/testing';
import { MovementProcessor } from './movement.processor';
import { EventBus } from '@nestjs/cqrs';
import { WebSocketAdapter } from '../../../infrastructure/adapters/websocket.adapter';
import Redis from 'ioredis';
import { Job } from 'bull';
import { ElevatorArrivedEvent } from '../../../application/events/elevator-arrived.event';
import { Logger } from '@nestjs/common';
import { MovementJobData } from '../elevator-movement.queue';

jest.mock('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      hmset: jest.fn(),
    })),
  };
});

describe('MovementProcessor', () => {
  let processor: MovementProcessor;
  let redis: jest.Mocked<Redis>;
  let eventBus: jest.Mocked<EventBus>;
  let websocketAdapter: jest.Mocked<WebSocketAdapter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementProcessor,
        {
          provide: 'REDIS_CLIENT',
          useValue: {
            hmset: jest.fn(),
          },
        },
        {
          provide: EventBus,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: WebSocketAdapter,
          useValue: {
            broadcast: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<MovementProcessor>(MovementProcessor);
    redis = module.get('REDIS_CLIENT');
    eventBus = module.get(EventBus);
    websocketAdapter = module.get(WebSocketAdapter);

    // Mock Logger to prevent console output
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    // Mock setTimeout for controlled delays
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => cb() as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'setTimeout').mockRestore();
  });

  describe('handleMovement', () => {
    const job: Job<MovementJobData> = {
      data: {
        elevatorId: 'uuid-1',
        fromFloor: 2,
        toFloor: 5,
        direction: 'UP',
      },
      progress: jest.fn(),
    } as any;

    it('should process movement from floor 2 to 5 (UP)', async () => {
      redis.hmset.mockResolvedValue('OK');

      await processor.handleMovement(job);

      expect(redis.hmset).toHaveBeenCalledTimes(5);
      expect(redis.hmset).toHaveBeenNthCalledWith(1, 'elevator:uuid-1:state', {
        currentFloor: '3',
        state: 'MOVING',
        direction: 'UP',
        targetFloor: '5',
        lastUpdated: expect.any(String),
      });
      expect(redis.hmset).toHaveBeenNthCalledWith(2, 'elevator:uuid-1:state', {
        currentFloor: '4',
        state: 'MOVING',
        direction: 'UP',
        targetFloor: '5',
        lastUpdated: expect.any(String),
      });
      expect(redis.hmset).toHaveBeenNthCalledWith(3, 'elevator:uuid-1:state', {
        currentFloor: '5',
        state: 'DOORS_OPENING',
        direction: 'IDLE',
        targetFloor: '',
        lastUpdated: expect.any(String),
      });

      expect(job.progress).toHaveBeenCalledWith(33.333333333333336);
      expect(job.progress).toHaveBeenCalledWith(66.66666666666667);

      expect(websocketAdapter.broadcast).toHaveBeenCalledTimes(5);
      expect(websocketAdapter.broadcast).toHaveBeenNthCalledWith(1, 'elevator-movement', {
        elevatorId: 'uuid-1',
        currentFloor: 3,
        targetFloor: 5,
        direction: 'UP',
        isMoving: true,
        progress: 33.333333333333336,
        timestamp: expect.any(Date),
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(ElevatorArrivedEvent),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          elevatorId: 'uuid-1',
          floor: 5,
          timestamp: expect.any(Date),
        }),
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        `Starting movement for elevator uuid-1: 2 -> 5`,
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        `Elevator uuid-1 completed movement to floor 5`,
      );
    });

    it('should process movement from floor 5 to 2 (DOWN)', async () => {
      const downJob: Job<MovementJobData> = {
        data: {
          elevatorId: 'uuid-1',
          fromFloor: 5,
          toFloor: 2,
          direction: 'DOWN',
        },
        progress: jest.fn(),
      } as any;

      redis.hmset.mockResolvedValue('OK');

      await processor.handleMovement(downJob);

      expect(redis.hmset).toHaveBeenCalledTimes(5);
      expect(redis.hmset).toHaveBeenNthCalledWith(1, 'elevator:uuid-1:state', {
        currentFloor: '4',
        state: 'MOVING',
        direction: 'DOWN',
        targetFloor: '2',
        lastUpdated: expect.any(String),
      });
      expect(redis.hmset).toHaveBeenNthCalledWith(3, 'elevator:uuid-1:state', {
        currentFloor: '2',
        state: 'DOORS_OPENING',
        direction: 'IDLE',
        targetFloor: '',
        lastUpdated: expect.any(String),
      });

      expect(job.progress).toHaveBeenCalledWith(33.333333333333336);
    });

    it('should handle Redis errors during movement', async () => {
      redis.hmset.mockRejectedValueOnce(new Error('Redis error'));

      await expect(processor.handleMovement(job)).rejects.toThrow('Redis error');

      expect(redis.hmset).toHaveBeenCalledWith('elevator:uuid-1:state', {
        state: 'IDLE',
        direction: 'IDLE',
        targetFloor: '',
        lastUpdated: expect.any(String),
      });
      expect(websocketAdapter.broadcast).toHaveBeenCalledWith('elevator-error', {
        elevatorId: 'uuid-1',
        error: 'Movement failed',
        timestamp: expect.any(Date),
      });
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        `Movement failed for elevator uuid-1:`,
        expect.any(Error),
      );
    });
  });

  describe('handleEmergencyStop', () => {
    const job: Job<{ elevatorId: string }> = {
      data: {
        elevatorId: 'uuid-1',
      },
    } as any;

    it('should process emergency stop', async () => {
      redis.hmset.mockResolvedValue('OK');

      await processor.handleEmergencyStop(job);

      expect(redis.hmset).toHaveBeenCalledWith('elevator:uuid-1:state', {
        state: 'MAINTENANCE',
        direction: 'IDLE',
        targetFloor: '',
        lastUpdated: expect.any(String),
      });
      expect(websocketAdapter.broadcast).toHaveBeenCalledWith('elevator-emergency-stop', {
        elevatorId: 'uuid-1',
        timestamp: expect.any(Date),
      });
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        `Emergency stop for elevator uuid-1`,
      );
    });

    it('should handle Redis errors during emergency stop', async () => {
      redis.hmset.mockRejectedValue(new Error('Redis error'));

      await expect(processor.handleEmergencyStop(job)).rejects.toThrow('Redis error');
    });
  });
});