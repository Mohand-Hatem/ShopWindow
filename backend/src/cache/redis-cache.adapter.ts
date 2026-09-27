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
   * Returns remaining TTL in seconds.
   * Returns -2 if key does not exist.
   * Returns -1 if key exists without TTL.
   */
  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
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

  /**
   * Reads current catalog list version counter.
   * Returns 1 if uninitialized or upon read errors.
   */
  async getListVersion(): Promise<number> {
    try {
      const raw = await this.redis.get('prod:listVer');
      if (!raw) {
        return 1;
      }
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    } catch (error: any) {
      this.logger.warn(`Failed to read list version from Redis: ${error.message}`);
      return 1;
    }
  }

  /**
   * Atomically increments list version counter to invalidate all cached lists in O(1) time.
   */
  async bumpListVersion(): Promise<number> {
    try {
      const newVersion = await this.redis.incr('prod:listVer');
      this.logger.log(`Bumped catalog list version to v=${newVersion}`);
      return newVersion;
    } catch (error: any) {
      this.logger.error(`Failed to bump list version in Redis: ${error.message}`);
      throw error;
    }
  }
}
