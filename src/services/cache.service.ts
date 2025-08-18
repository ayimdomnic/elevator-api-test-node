import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

export class CacheService {
  private redis: Redis;
  private logger: Logger;

  constructor(redis: Redis, logger: Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.error('Cache get error', {
        key,
        error: (error as Error).message,
      });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      this.logger.error('Cache set error', {
        key,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.error('Cache delete error', {
        key,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      return 0;
    } catch (error) {
      this.logger.error('Cache pattern invalidation error', {
        pattern,
        error: (error as Error).message,
      });
      return 0;
    }
  }
}
