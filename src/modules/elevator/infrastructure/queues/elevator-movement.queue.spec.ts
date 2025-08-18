import { Test, TestingModule } from '@nestjs/testing';
import { ElevatorMovementQueue, MovementJobData } from './elevator-movement.queue';
import { ElevatorRepository } from '../../infrastructure/repositories/elevator.repository';
import { WebSocketAdapter } from '../../infrastructure/adapters/websocket.adapter';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
    })),
  };
});

jest.mock('ioredis', () => {
  return {
    default: jest.fn().mockImplementation(() => ({})),
  };
});

describe('ElevatorMovementQueue', () => {
  let service: ElevatorMovementQueue;
  let queue: jest.Mocked<Queue>;
  let redis: jest.Mocked<Redis>;
  let elevatorRepository: jest.Mocked<ElevatorRepository>;
  let websocketAdapter: jest.Mocked<WebSocketAdapter>;

  beforeEach(async () => {
    queue = {
      add: jest.fn(),
    } as any;

    jest.spyOn(require('bullmq'), 'Queue').mockImplementation(() => queue);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElevatorMovementQueue,
        {
          provide: 'REDIS_CLIENT',
          useValue: {},
        },
        {
          provide: ElevatorRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: WebSocketAdapter,
          useValue: {
            broadcastElevatorUpdate: jest.fn(),
            broadcastFloorUpdate: jest.fn(),
            broadcastDoorUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ElevatorMovementQueue>(ElevatorMovementQueue);
    redis = module.get('REDIS_CLIENT');
    elevatorRepository = module.get(ElevatorRepository);
    websocketAdapter = module.get(WebSocketAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize BullMQ queue with correct configuration', () => {
      expect(require('bullmq').Queue).toHaveBeenCalledWith('elevator-movement', {
        connection: redis,
      });
    });
  });

  describe('addMovementJob', () => {
    const movementJobData: MovementJobData = {
      elevatorId: 'uuid-1',
      fromFloor: 2,
      toFloor: 5,
      direction: 'UP',
    };

    it('should add a movement job to the queue with correct data and options', async () => {
      queue.add.mockResolvedValue(undefined);

      await service.addMovementJob(movementJobData);

      expect(queue.add).toHaveBeenCalledWith('move', movementJobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    });

    it('should handle errors when adding a job to the queue', async () => {
      queue.add.mockRejectedValue(new Error('Queue error'));

      await expect(service.addMovementJob(movementJobData)).rejects.toThrow('Queue error');
    });

    it('should add job with different direction values', async () => {
      const jobDataDown: MovementJobData = {
        ...movementJobData,
        direction: 'DOWN',
      };
      queue.add.mockResolvedValue(undefined);

      await service.addMovementJob(jobDataDown);

      expect(queue.add).toHaveBeenCalledWith('move', jobDataDown, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    });

    it('should add job with IDLE direction', async () => {
      const jobDataIdle: MovementJobData = {
        ...movementJobData,
        direction: 'IDLE',
      };
      queue.add.mockResolvedValue(undefined);

      await service.addMovementJob(jobDataIdle);

      expect(queue.add).toHaveBeenCalledWith('move', jobDataIdle, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    });
  });
});