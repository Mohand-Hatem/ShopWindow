/**
 * ShopWindow - Cache Abstraction Layer
 * Hexagonal Architecture: Port Contract
 *
 * All business services interact exclusively with this CachePort interface.
 * No service should ever import or couple directly to ioredis, Redis, or Memcached.
 */

export interface CachePort {
  /**
   * Retrieve a cached object by key, deserializing from JSON.
   * Returns null on cache miss or deserialization error.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Serialize and store a value in the cache with an optional Time-To-Live (in seconds).
   * If ttlSeconds is omitted or undefined, the key persists until evicted.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a specific cache key.
   */
  del(key: string): Promise<void>;

  /**
   * Delete all keys matching a glob-style pattern (e.g. "prod:list:*").
   * Uses non-blocking SCAN iteration to protect the Redis single thread.
   */
  delByPattern(pattern: string): Promise<void>;

  /**
   * Atomically increment an integer counter key and return the new value.
   * Crucial for version-based cache invalidation.
   */
  incr(key: string): Promise<number>;

  /**
   * Verify if the underlying cache engine is healthy and accepting commands.
   */
  isHealthy(): Promise<boolean>;
}

export const CACHE_PORT = 'CACHE_PORT';
