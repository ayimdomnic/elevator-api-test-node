import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';
import { Pool } from 'pg';
import Redis from 'ioredis';
import Bull from 'bull';

import { ElevatorController } from './controllers/elevator.controller';
import { ElevatorCallService } from './services/elevator-call.service';
import { ElevatorStatusService } from './services/elevator-status.service';
import { ElevatorLogService } from './services/elevator-log.service';
import { ElevatorEventLoggingService } from './services/elevator-event-logging.service';
import { CacheService } from './services/cache.service';
import { QueryLoggingService } from './services/query-logging.service';
import { WebSocketService } from './services/websocket.service';
import { ElevatorWorker } from './workers/elevator.worker';
import { ElevatorRepository } from './repositories/elevator.respository';
import { ElevatorLogRepository } from './repositories/elevator-log.repository';

import { errorHandler } from './middleware/error.handler';
import { idempotencyMiddleware } from './middleware/idempotency';
import {
  validateElevatorCall,
  validateElevatorId,
  validateLogFilters,
} from './middleware/validation';

import { Logger } from './utils/logger';
import { swaggerSpec } from './config/swagger';
import { databaseConfig } from './config/database';
import { redisConfig } from './config/redis';

class ElevatorApp {
  private app: express.Application;
  private server: any;
  private db: Pool;
  private redis: Redis;
  private elevatorQueue: Bull.Queue;
  private websocketService: WebSocketService;
  private logger: Logger;
  constructor() {
    this.app = express();
    this.logger = new Logger();
    this.initializeDatabase();
    this.initializeRedis();
    this.initializeQueue();
    this.initializeMiddleware();
    this.initializeServices();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeDatabase() {
    this.db = new Pool(databaseConfig);

    const queryLoggingService = new QueryLoggingService(this.db, this.logger);
    const originalQuery = this.db.query;
    this.db.query = async function (
      text: string,
      params?: any[],
      values?: any
    ) {
      const logger = new Logger();
      const start = Date.now();
      try {
        const result = await originalQuery.call(this, text, params, values);
        const duration = Date.now() - start;

        logger.debug('Database query executed', {
          query: text.substring(0, 100),
          duration,
          rows: result.rows?.length,
        });

        await queryLoggingService.logSQLQuery(text, params || [], duration, {});

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error('Database query failed', {
          query: text.substring(0, 100),
          duration,
          error: (error as Error).message,
        });
        throw error;
      }
    };
  }

  private initializeRedis() {
    this.redis = new Redis(redisConfig);

    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis');
    });

    this.redis.on('error', error => {
      this.logger.error('Redis connection error', {
        error: (error as Error).message,
      });
    });
  }

  private initializeQueue() {
    this.elevatorQueue = new Bull('elevator-movements', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    const elevatorRepository = new ElevatorRepository(this.db);
    const logRepository = new ElevatorLogRepository(this.db);
    const eventLoggingService = new ElevatorEventLoggingService(
      logRepository,
      this.logger
    );
    const cacheService = new CacheService(this.redis, this.logger);
    const worker = new ElevatorWorker(
      elevatorRepository,
      eventLoggingService,
      cacheService,
      this.logger
    );

    this.elevatorQueue.process(
      'moveElevator',
      1,
      worker.processMoveElevator.bind(worker)
    );

    this.elevatorQueue.on('completed', job => {
      this.logger.info('Elevator movement completed', { jobId: job.id });
    });

    this.elevatorQueue.on('failed', (job, error) => {
      this.logger.error('Elevator movement failed', {
        jobId: job.id,
        error: (error as Error).message,
      });
    });
  }

  private initializeMiddleware() {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
        ],
        credentials: true,
      })
    );

    this.app.use(
      '/api/',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP',
          },
        },
      })
    );

    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use((req, res, next) => {
      req.headers['x-request-id'] =
        req.headers['x-request-id'] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    this.app.use(idempotencyMiddleware(this.db, this.logger));

    this.app.use((req, res, next) => {
      this.logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id'] as string,
      });
      next();
    });
  }

  private initializeServices() {
    const elevatorRepository = new ElevatorRepository(this.db);
    const logRepository = new ElevatorLogRepository(this.db);
    const cacheService = new CacheService(this.redis, this.logger);
    const eventLoggingService = new ElevatorEventLoggingService(
      logRepository,
      this.logger
    );
    const callService = new ElevatorCallService(
      elevatorRepository,
      this.elevatorQueue,
      eventLoggingService
    );
    const statusService = new ElevatorStatusService(
      elevatorRepository,
      cacheService
    );
    const logService = new ElevatorLogService(logRepository);

    this.app.locals.callService = callService;
    this.app.locals.statusService = statusService;
    this.app.locals.logService = logService;
  }

  private initializeRoutes() {
    const elevatorController = new ElevatorController(
      this.app.locals.callService,
      this.app.locals.statusService,
      this.app.locals.logService,
      this.logger
    );

    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    this.app.use('/api-docs', swaggerUi.serve);
    this.app.get('/api-docs', swaggerUi.setup(swaggerSpec));

    const apiRouter = express.Router();

    apiRouter.post(
      '/elevators/call',
      validateElevatorCall,
      elevatorController.callElevator.bind(elevatorController)
    );

    apiRouter.get(
      '/elevators/status',
      elevatorController.getStatus.bind(elevatorController)
    );

    apiRouter.get(
      '/elevators/status/:elevatorId',
      validateElevatorId,
      elevatorController.getStatus.bind(elevatorController)
    );

    apiRouter.get(
      '/elevators/logs',
      validateLogFilters,
      elevatorController.getLogs.bind(elevatorController)
    );

    this.app.use('/api/v1', apiRouter);

    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    });
  }

  private initializeErrorHandling() {
    this.app.use(errorHandler);
  }

  public async start() {
    const port = process.env.PORT || 3000;

    this.server = createServer(this.app);
    this.websocketService = new WebSocketService(
      this.server,
      this.redis,
      this.logger
    );

    this.server.listen(port, () => {
      this.logger.info(`Elevator system started on port ${port}`, {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        pid: process.pid,
      });
    });

    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async shutdown() {
    this.logger.info('Shutting down elevator system...');

    try {
      await this.elevatorQueue.close();
      await this.redis.quit();
      await this.db.end();

      this.server.close(() => {
        this.logger.info('Elevator system shut down successfully');
        process.exit(0);
      });
    } catch (error) {
      this.logger.error('Error during shutdown', {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const app = new ElevatorApp();
  app.start().catch(error => {
    const logger = new Logger();
    logger.error('Failed to start elevator system', {
      error: (error as Error).message,
    });
    process.exit(1);
  });
}

export default ElevatorApp;
