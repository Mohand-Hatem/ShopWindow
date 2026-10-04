/**
 * ShopWindow - Cache Abstraction Layer
 * Hexagonal Architecture: Port Contract
 *
 * All business services interact exclusively with this CachePort interface.
 * No service should ever import or couple directly to ioredis, Redis, or Memcached.
 */

export interface CacheGetResult<T> {
  value: T | null;
  status: 'HIT' | 'MISS' | 'BYPASS';
}

export interface CachePort {
  /**
   * Retrieve a cached object by key, deserializing from JSON.
   * Returns null on cache miss or deserialization error.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Retrieve a cached object by key, returning both the value and explicit cache status.
   * If Redis is down, timed out (>150ms), or unavailable, status is 'BYPASS'.
   */
  getWithStatus<T>(key: string): Promise<CacheGetResult<T>>;

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
   * Asynchronously delete all keys matching a glob pattern using non-blocking SCAN and UNLINK.
   * Returns total count of unlinked keys without blocking the Redis single thread.
   */
  unlinkByPattern(pattern: string): Promise<number>;

  /**
   * Atomically increment an integer counter key and return the new value.
   * Crucial for version-based cache invalidation.
   */
  incr(key: string): Promise<number>;

  /**
   * Return the remaining Time-To-Live of a key in seconds.
   * Returns -2 if key does not exist.
   * Returns -1 if key exists without expiration.
   */
  ttl(key: string): Promise<number>;

  /**
   * Get the current active version counter for catalog lists.
   * Defaults to 1 if not yet initialized.
   */
  getListVersion(): Promise<number>;

  /**
   * Atomically increment the catalog list version counter and return the new version.
   * Invalidates all cached lists in O(1) time without scanning keys.
   */
  bumpListVersion(): Promise<number>;

  /**
   * Attempt to acquire a distributed lock using atomic SET NX EX.
   * Returns true if lock was acquired, false if already held.
   */
  acquireLock(key: string, token: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Safely release a distributed lock using Lua script to verify token ownership.
   * Returns true if lock was released, false if token did not match or lock expired.
   */
  releaseLock(key: string, token: string): Promise<boolean>;

  /**
   * Verify if the underlying cache engine is healthy and accepting commands.
   */
  isHealthy(): Promise<boolean>;
}

export const CACHE_PORT = 'CACHE_PORT';

