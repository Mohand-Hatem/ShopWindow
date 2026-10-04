import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheGetResult, CachePort } from './cache.port';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_TIMEOUT_MS = 150;

/**
 * Promise timeout wrapper that enforces a strict deadline on Redis commands.
 * Cleans up timer on resolution/rejection to prevent timer leaks.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms = REDIS_TIMEOUT_MS,
  operationName = 'Redis command',
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

@Injectable()
export class RedisCacheAdapter implements CachePort {
  private readonly logger = new Logger(RedisCacheAdapter.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Helper to check if Redis is currently connected and ready to accept commands.
   */
  private isAvailable(): boolean {
    return this.redis.status === 'ready' || this.redis.status === 'connect';
  }

  /**
   * Retrieves a cached value along with explicit cache status.
   * If Redis is down, disconnected, or times out (>150ms), returns status: 'BYPASS'.
   */
  async getWithStatus<T>(key: string): Promise<CacheGetResult<T>> {
    if (!this.isAvailable()) {
      this.logger.warn(`Redis unavailable (status: ${this.redis.status}). Bypassing cache for key "${key}".`);
      return { value: null, status: 'BYPASS' };
    }

    try {
      const data = await withTimeout(this.redis.get(key), REDIS_TIMEOUT_MS, `GET ${key}`);
      if (data === null || data === undefined) {
        return { value: null, status: 'MISS' };
      }
      return { value: JSON.parse(data) as T, status: 'HIT' };
    } catch (error: any) {
      this.logger.warn(`Redis GET failed or timed out for "${key}": ${error.message}. Bypassing cache.`);
      return { value: null, status: 'BYPASS' };
    }
  }

  /**
   * Deserializes and returns cached JSON value.
   * Fails-open to null on cache miss, connection error, or timeout.
   */
  async get<T>(key: string): Promise<T | null> {
    const result = await this.getWithStatus<T>(key);
    return result.value;
  }

  /**
   * Serializes value to JSON and stores in Redis with optional TTL in seconds.
   * Fails-open silently if Redis is degraded or times out.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const serialized = JSON.stringify(value);
      const command =
        ttlSeconds && ttlSeconds > 0
          ? this.redis.set(key, serialized, 'EX', ttlSeconds)
          : this.redis.set(key, serialized);

      await withTimeout(command, REDIS_TIMEOUT_MS, `SET ${key}`);
    } catch (error: any) {
      this.logger.warn(`Redis SET failed or timed out for "${key}": ${error.message}`);
    }
  }

  /**
   * Deletes a single key. Fails-open silently if Redis is degraded.
   */
  async del(key: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await withTimeout(this.redis.del(key), REDIS_TIMEOUT_MS, `DEL ${key}`);
    } catch (error: any) {
      this.logger.warn(`Redis DEL failed or timed out for "${key}": ${error.message}`);
    }
  }

  /**
   * Deletes keys matching a glob pattern using non-blocking SCAN batches.
   * Fails-open silently if Redis is degraded.
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await withTimeout(
          this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100),
          REDIS_TIMEOUT_MS,
          `SCAN ${pattern}`,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await withTimeout(this.redis.del(...keys), REDIS_TIMEOUT_MS, `DEL batch`);
        }
      } while (cursor !== '0');
    } catch (error: any) {
      this.logger.warn(`Redis delByPattern failed or timed out for "${pattern}": ${error.message}`);
    }
  }

  /**
   * Asynchronously deletes all keys matching a pattern using non-blocking SCAN iteration
   * and background thread UNLINK memory reclamation. Returns total unlinked keys.
   */
  async unlinkByPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    let totalUnlinked = 0;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await withTimeout(
          this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100),
          REDIS_TIMEOUT_MS,
          `SCAN ${pattern}`,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          const unlinkedCount = await withTimeout(
            this.redis.unlink(...keys),
            REDIS_TIMEOUT_MS,
            `UNLINK batch`,
          );
          totalUnlinked += unlinkedCount;
        }
      } while (cursor !== '0');
    } catch (error: any) {
      this.logger.warn(`Redis unlinkByPattern failed or timed out for "${pattern}": ${error.message}`);
    }
    return totalUnlinked;
  }

  /**
   * Atomically increments a key counter. Fails-open to 1 on failure.
   */
  async incr(key: string): Promise<number> {
    if (!this.isAvailable()) return 1;

    try {
      return await withTimeout(this.redis.incr(key), REDIS_TIMEOUT_MS, `INCR ${key}`);
    } catch (error: any) {
      this.logger.warn(`Redis INCR failed or timed out for "${key}": ${error.message}`);
      return 1;
    }
  }

  /**
   * Returns remaining TTL in seconds. Fails-open to -2 if unreachable.
   */
  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) return -2;

    try {
      return await withTimeout(this.redis.ttl(key), REDIS_TIMEOUT_MS, `TTL ${key}`);
    } catch (error: any) {
      this.logger.warn(`Redis TTL failed or timed out for "${key}": ${error.message}`);
      return -2;
    }
  }

  /**
   * Health check via Redis PING command. Returns false on error or timeout.
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const response = await withTimeout(this.redis.ping(), REDIS_TIMEOUT_MS, 'PING');
      return response === 'PONG';
    } catch (error: any) {
      this.logger.warn(`Redis healthcheck failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Reads current catalog list version counter. Fails-open to 1 on error.
   */
  async getListVersion(): Promise<number> {
    if (!this.isAvailable()) return 1;

    try {
      const raw = await withTimeout(this.redis.get('prod:listVer'), REDIS_TIMEOUT_MS, 'GET prod:listVer');
      if (!raw) return 1;
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    } catch (error: any) {
      this.logger.warn(`Failed to read list version from Redis: ${error.message}`);
      return 1;
    }
  }

  /**
   * Atomically increments list version counter to invalidate all cached lists in O(1) time.
   * Fails-open gracefully without crashing admin mutations.
   */
  async bumpListVersion(): Promise<number> {
    if (!this.isAvailable()) return 1;

    try {
      const newVersion = await withTimeout(this.redis.incr('prod:listVer'), REDIS_TIMEOUT_MS, 'INCR prod:listVer');
      this.logger.log(`Bumped catalog list version to v=${newVersion}`);
      return newVersion;
    } catch (error: any) {
      this.logger.warn(`Failed to bump list version in Redis: ${error.message}`);
      return 1;
    }
  }

  /**
   * Attempt to acquire a distributed lock using atomic SET NX EX.
   * Returns false if lock is held or if Redis is degraded/unavailable.
   */
  async acquireLock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await withTimeout(
        this.redis.set(key, token, 'EX', ttlSeconds, 'NX'),
        REDIS_TIMEOUT_MS,
        `ACQUIRE_LOCK ${key}`,
      );
      return result === 'OK';
    } catch (error: any) {
      this.logger.warn(`Failed to acquire distributed lock for key "${key}": ${error.message}`);
      return false;
    }
  }

  /**
   * Safely release a distributed lock using Lua script to verify token ownership.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await withTimeout(
        this.redis.eval(luaScript, 1, key, token) as Promise<number>,
        REDIS_TIMEOUT_MS,
        `RELEASE_LOCK ${key}`,
      );
      return result === 1;
    } catch (error: any) {
      this.logger.warn(`Failed to release distributed lock for key "${key}": ${error.message}`);
      return false;
    }
  }
}


