import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CACHE_PORT, CachePort } from './cache.port';

export interface SingleFlightOptions<T> {
  /**
   * Lock Time-To-Live in seconds.
   * Auto-releases to prevent deadlocks if the lock holder crashes.
   * Default: 10 seconds.
   */
  lockTtlSeconds?: number;

  /**
   * Delay in milliseconds between backoff retries for followers.
   * Default: 50 ms.
   */
  retryDelayMs?: number;

  /**
   * Maximum number of retry attempts before falling back.
   * Default: 20 retries (giving up to 1 second of wait window).
   */
  maxRetries?: number;

  /**
   * Optional custom cache inspector function.
   * When followers wake up after sleeping, this function is invoked.
   * If it returns non-null data (or throws an anticipated exception like CachedNotFoundException),
   * the follower returns/throws immediately without querying the database!
   */
  checkCache?: () => Promise<T | null>;
}

export interface SingleFlightResult<T> {
  data: T;
  isWinner: boolean;
}

@Injectable()
export class SingleFlightLockService {
  private readonly logger = new Logger(SingleFlightLockService.name);

  constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

  /**
   * Coordinates concurrent requests for an expired or cold resource:
   * 1. Attempts to acquire an atomic distributed lock via Redis SET NX EX.
   * 2. If acquired (Leader / Winner): Executes the rebuilder function, then safely releases the lock via Lua.
   * 3. If locked (Follower): Sleeps for retryDelayMs and polls the cache. Once populated, returns cached data (Cache HIT).
   * 4. Fails safe: If retries are exhausted (e.g. crashed winner), falls back to executing rebuilder directly.
   */
  async executeWithLock<T>(
    lockKey: string,
    rebuilder: () => Promise<T>,
    options?: SingleFlightOptions<T>,
  ): Promise<SingleFlightResult<T>> {
    const lockTtl = options?.lockTtlSeconds ?? 10;
    const retryDelay = options?.retryDelayMs ?? 50;
    const maxRetries = options?.maxRetries ?? 20;
    const token = randomUUID();

    // 1. Initial lock acquisition attempt
    const acquired = await this.cache.acquireLock(lockKey, token, lockTtl);

    if (acquired) {
      try {
        const data = await rebuilder();
        return { data, isWinner: true };
      } finally {
        await this.cache.releaseLock(lockKey, token);
      }
    }

    // 2. Follower Path: Backoff Polling
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      // Check if the winner has populated the cache
      if (options?.checkCache) {
        const cached = await options.checkCache();
        if (cached !== null && cached !== undefined) {
          return { data: cached, isWinner: false };
        }
      }

      // If cache still empty, attempt to acquire lock in case previous winner completed or died
      const tryAcquire = await this.cache.acquireLock(lockKey, token, lockTtl);
      if (tryAcquire) {
        try {
          const data = await rebuilder();
          return { data, isWinner: true };
        } finally {
          await this.cache.releaseLock(lockKey, token);
        }
      }
    }

    // 3. Fallback safety valve: If max retries exhausted and cache still unpopulated,
    // execute rebuilder to avoid hanging or failing the customer request
    this.logger.warn(
      `SingleFlight lock polling exhausted for "${lockKey}" after ${maxRetries} retries. Executing fallback rebuilder.`,
    );
    const data = await rebuilder();
    return { data, isWinner: true };
  }
}
