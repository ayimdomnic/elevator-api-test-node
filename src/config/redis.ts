export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
  lazyConnect: true,
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
};
