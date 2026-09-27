import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CachePort } from './cache.port';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisCacheAdapter implements CachePort {
  private readonly logger = new Logger(RedisCacheAdapter.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Deserializes and returns cached JSON value.
   * Returns null if key is missing or on JSON parse error.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (data === null || data === undefined) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error: any) {
      this.logger.warn(`Failed to deserialize cached value for key "${key}": ${error.message}`);
      return null;
    }
  }

  /**
   * Serializes value to JSON and stores in Redis with optional TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  /**
   * Deletes a single key.
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Deletes keys matching a glob pattern using non-blocking SCAN batches.
   * Never calls KEYS * in production to prevent event loop blocking.
   */
  async delByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  /**
   * Atomically increments a key counter.
   */
  async incr(key: string): Promise<number> {
    return await this.redis.incr(key);
  }

  /**
   * Health check via Redis PING command.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.redis.ping();
      return response === 'PONG';
    } catch (error: any) {
      this.logger.warn(`Redis healthcheck failed: ${error.message}`);
      return false;
    }
  }
}
