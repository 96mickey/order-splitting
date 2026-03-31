import Redis, { type Redis as RedisClient } from 'ioredis';
import { logger } from './logger';
import { redisConfig } from './vars';

let redis: RedisClient | null = null;

export const connectRedis = async (): Promise<void> => {
  if (!redisConfig.enabled || redis) return;

  redis = redisConfig.url
    ? new Redis(redisConfig.url, { keyPrefix: redisConfig.keyPrefix, lazyConnect: true })
    : new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      keyPrefix: redisConfig.keyPrefix,
      lazyConnect: true,
    });

  redis.on('error', (error: Error) => {
    logger.error('Redis error', { error: error.message });
  });

  await redis.connect();
  logger.info('Redis connected');
};

export const disconnectRedis = async (): Promise<void> => {
  if (!redis) return;
  await redis.quit();
  redis = null;
  logger.info('Redis disconnected');
};

export const getRedisClient = (): RedisClient | null => redis;

export const isRedisReady = (): boolean => {
  if (!redisConfig.enabled) return true;
  return redis?.status === 'ready';
};
