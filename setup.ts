import { Pool } from 'pg';
import Redis from 'ioredis';
import { Logger } from './src/utils/logger';

// Mock PostgreSQL
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    duplicate: jest.fn(() => ({
      subscribe: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    })),
  }));
});

const logger = new Logger();

// Mock logger to prevent console output during tests
jest.spyOn(logger, 'info').mockImplementation();
jest.spyOn(logger, 'error').mockImplementation();
jest.spyOn(logger, 'warn').mockImplementation();
jest.spyOn(logger, 'debug').mockImplementation();
jest.spyOn(logger, 'verbose').mockImplementation();

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup database connections
  const pool = new Pool();
  await pool.end();

  // Cleanup Redis connections
  const redis = new Redis();
  await redis.quit();
});