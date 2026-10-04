import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-cache.adapter';

export const METRIC_KEYS = {
  HITS: 'catalog:v1:stats:hits',
  MISSES: 'catalog:v1:stats:misses',
  BYPASSES: 'catalog:v1:stats:bypasses',
  HITS_TOTAL_MS: 'catalog:v1:stats:hits:total_ms',
  MISSES_TOTAL_MS: 'catalog:v1:stats:misses:total_ms',
};

export interface CacheStatsDto {
  hits: number;
  misses: number;
  bypasses: number;
  hitRatio: string;
  avgHitLatencyMs: number;
  avgMissLatencyMs: number;
  totalKeysEstimated: number;
}

@Injectable()
export class CacheMetricsService {
  private readonly logger = new Logger(CacheMetricsService.name);

  // In-memory fallback counters for when Redis is degraded
  private fallbackHits = 0;
  private fallbackMisses = 0;
  private fallbackBypasses = 0;
  private fallbackHitsTotalMs = 0;
  private fallbackMissesTotalMs = 0;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Record a cache HIT event with request duration in milliseconds.
   */
  async recordHit(durationMs: number = 0): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        const pipeline = this.redis.pipeline();
        pipeline.incr(METRIC_KEYS.HITS);
        if (durationMs > 0) {
          pipeline.incrbyfloat(METRIC_KEYS.HITS_TOTAL_MS, durationMs);
        }
        await pipeline.exec();
        return;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to record HIT in Redis: ${err.message}`);
    }

    this.fallbackHits++;
    this.fallbackHitsTotalMs += durationMs;
  }

  /**
   * Record a cache MISS event with request duration in milliseconds.
   */
  async recordMiss(durationMs: number = 0): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        const pipeline = this.redis.pipeline();
        pipeline.incr(METRIC_KEYS.MISSES);
        if (durationMs > 0) {
          pipeline.incrbyfloat(METRIC_KEYS.MISSES_TOTAL_MS, durationMs);
        }
        await pipeline.exec();
        return;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to record MISS in Redis: ${err.message}`);
    }

    this.fallbackMisses++;
    this.fallbackMissesTotalMs += durationMs;
  }

  /**
   * Record a cache BYPASS event (e.g. during Redis degradation).
   */
  async recordBypass(durationMs: number = 0): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        await this.redis.incr(METRIC_KEYS.BYPASSES);
        return;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to record BYPASS in Redis: ${err.message}`);
    }

    this.fallbackBypasses++;
  }

  /**
   * Record operation based on CacheStatus ('HIT' | 'MISS' | 'BYPASS').
   */
  async recordOperation(
    status: 'HIT' | 'MISS' | 'BYPASS',
    durationMs: number = 0,
  ): Promise<void> {
    if (status === 'HIT') {
      await this.recordHit(durationMs);
    } else if (status === 'MISS') {
      await this.recordMiss(durationMs);
    } else if (status === 'BYPASS') {
      await this.recordBypass(durationMs);
    }
  }

  /**
   * Retrieve aggregated cache performance statistics and compute hit ratio.
   */
  async getStats(): Promise<CacheStatsDto> {
    let hits = this.fallbackHits;
    let misses = this.fallbackMisses;
    let bypasses = this.fallbackBypasses;
    let hitsTotalMs = this.fallbackHitsTotalMs;
    let missesTotalMs = this.fallbackMissesTotalMs;
    let totalKeys = 0;

    try {
      if (this.redis.status === 'ready') {
        const [rawHits, rawMisses, rawBypasses, rawHitsTotalMs, rawMissesTotalMs] =
          await this.redis.mget(
            METRIC_KEYS.HITS,
            METRIC_KEYS.MISSES,
            METRIC_KEYS.BYPASSES,
            METRIC_KEYS.HITS_TOTAL_MS,
            METRIC_KEYS.MISSES_TOTAL_MS,
          );

        hits += rawHits ? parseInt(rawHits, 10) : 0;
        misses += rawMisses ? parseInt(rawMisses, 10) : 0;
        bypasses += rawBypasses ? parseInt(rawBypasses, 10) : 0;
        hitsTotalMs += rawHitsTotalMs ? parseFloat(rawHitsTotalMs) : 0;
        missesTotalMs += rawMissesTotalMs ? parseFloat(rawMissesTotalMs) : 0;

        if (typeof this.redis.dbsize === 'function') {
          totalKeys = await this.redis.dbsize();
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to read stats from Redis: ${err.message}`);
    }

    const totalEvaluated = hits + misses;
    const hitRatio =
      totalEvaluated > 0
        ? `${((hits / totalEvaluated) * 100).toFixed(2)}%`
        : '0.00%';

    const avgHitLatencyMs =
      hits > 0 ? parseFloat((hitsTotalMs / hits).toFixed(1)) : 0;
    const avgMissLatencyMs =
      misses > 0 ? parseFloat((missesTotalMs / misses).toFixed(1)) : 0;

    return {
      hits,
      misses,
      bypasses,
      hitRatio,
      avgHitLatencyMs,
      avgMissLatencyMs,
      totalKeysEstimated: totalKeys,
    };
  }

  /**
   * Reset all telemetry counters to zero.
   */
  async resetStats(): Promise<void> {
    this.fallbackHits = 0;
    this.fallbackMisses = 0;
    this.fallbackBypasses = 0;
    this.fallbackHitsTotalMs = 0;
    this.fallbackMissesTotalMs = 0;

    try {
      if (this.redis.status === 'ready') {
        await this.redis.del(
          METRIC_KEYS.HITS,
          METRIC_KEYS.MISSES,
          METRIC_KEYS.BYPASSES,
          METRIC_KEYS.HITS_TOTAL_MS,
          METRIC_KEYS.MISSES_TOTAL_MS,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to reset stats in Redis: ${err.message}`);
    }
  }
}
