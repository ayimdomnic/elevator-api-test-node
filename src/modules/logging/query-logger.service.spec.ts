import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryLoggerService } from './query-logger.service';
import { QueryLogEntity } from './entities';

describe('QueryLoggerService', () => {
  let service: QueryLoggerService;
  let queryLogRepository: Repository<QueryLogEntity>;

  const mockQueryLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryLoggerService,
        {
          provide: getRepositoryToken(QueryLogEntity),
          useValue: mockQueryLogRepository,
        },
      ],
    }).compile();

    service = module.get<QueryLoggerService>(QueryLoggerService);
    queryLogRepository = module.get<Repository<QueryLogEntity>>(
      getRepositoryToken(QueryLogEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logQuery', () => {
    const logData = {
      method: 'POST',
      url: '/elevators/call',
      userId: 'user-123',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      duration: 100,
      timestamp: new Date('2025-08-18T18:51:00Z'),
    };

    it('should create and save a query log', async () => {
      const logEntry = { id: 'uuid-123', ...logData };
      mockQueryLogRepository.create.mockReturnValue(logEntry);
      mockQueryLogRepository.save.mockResolvedValue(logEntry);

      await service.logQuery(logData);

      expect(queryLogRepository.create).toHaveBeenCalledWith(logData);
      expect(queryLogRepository.save).toHaveBeenCalledWith(logEntry);
    });

    it('should handle missing userId', async () => {
      const logDataWithoutUserId = { ...logData, userId: undefined };
      const logEntry = { id: 'uuid-123', ...logDataWithoutUserId };
      mockQueryLogRepository.create.mockReturnValue(logEntry);
      mockQueryLogRepository.save.mockResolvedValue(logEntry);

      await service.logQuery(logDataWithoutUserId);

      expect(queryLogRepository.create).toHaveBeenCalledWith(logDataWithoutUserId);
      expect(queryLogRepository.save).toHaveBeenCalledWith(logEntry);
    });

    it('should throw an error if save fails', async () => {
      mockQueryLogRepository.create.mockReturnValue(logData);
      mockQueryLogRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.logQuery(logData)).rejects.toThrow('Database error');
    });
  });

  describe('getQueryLogs', () => {
    const mockLogs = [
      {
        id: 'uuid-123',
        method: 'POST',
        url: '/elevators/call',
        userId: 'user-123',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        duration: 100,
        timestamp: new Date('2025-08-18T18:51:00Z'),
      },
      {
        id: 'uuid-124',
        method: 'GET',
        url: '/elevators/status',
        userId: 'user-124',
        ip: '127.0.0.2',
        userAgent: 'Mozilla/5.0',
        duration: 50,
        timestamp: new Date('2025-08-18T18:50:00Z'),
      },
    ];

    it('should retrieve logs with no filters', async () => {
      const queryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLogs),
      };
      mockQueryLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getQueryLogs({});

      expect(queryLogRepository.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('log.timestamp', 'DESC');
      expect(queryBuilder.limit).toHaveBeenCalledWith(100);
      expect(queryBuilder.getMany).toHaveBeenCalled();
      expect(result).toEqual(mockLogs);
    });

    it('should apply userId filter', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLogs[0]]),
      };
      mockQueryLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getQueryLogs({ userId: 'user-123' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.userId = :userId', {
        userId: 'user-123',
      });
    });

    it('should apply method filter', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLogs[0]]),
      };
      mockQueryLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getQueryLogs({ method: 'POST' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.method = :method', {
        method: 'POST',
      });
    });

    it('should apply date range filters', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLogs),
      };
      mockQueryLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const startDate = new Date('2025-08-18T00:00:00Z');
      const endDate = new Date('2025-08-18T23:59:59Z');

      await service.getQueryLogs({ startDate, endDate });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.timestamp >= :startDate', {
        startDate,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.timestamp <= :endDate', {
        endDate,
      });
    });

    it('should apply custom limit', async () => {
      const queryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLogs.slice(0, 1)),
      };
      mockQueryLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.getQueryLogs({ limit: 1 });

      expect(queryBuilder.limit).toHaveBeenCalledWith(1);
    });

    it('should combine multiple filters', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLogs[0]]),
      };
      mockQueryLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const filters = {
        userId: 'user-123',
        method: 'POST',
        startDate: new Date('2025-08-18T00:00:00Z'),
        endDate: new Date('2025-08-18T23:59:59Z'),
        limit: 10,
      };

      await service.getQueryLogs(filters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.userId = :userId', {
        userId: 'user-123',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.method = :method', {
        method: 'POST',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.timestamp >= :startDate', {
        startDate: filters.startDate,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.timestamp <= :endDate', {
        endDate: filters.endDate,
      });
      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
    });
  });
});