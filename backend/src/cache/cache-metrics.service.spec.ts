import { Test, TestingModule } from '@nestjs/testing';
import {
  CacheMetricsService,
  METRIC_KEYS,
} from './cache-metrics.service';
import { REDIS_CLIENT } from './redis-cache.adapter';

describe('CacheMetricsService', () => {
  let service: CacheMetricsService;
  let mockRedis: any;

  beforeEach(async () => {
    mockRedis = {
      status: 'ready',
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        incrbyfloat: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      incr: jest.fn().mockResolvedValue(1),
      mget: jest.fn().mockResolvedValue(['7', '3', '0', '14.0', '120.0']),
      dbsize: jest.fn().mockResolvedValue(42),
      del: jest.fn().mockResolvedValue(5),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheMetricsService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<CacheMetricsService>(CacheMetricsService);
  });

  it('should record hits in Redis pipeline with duration', async () => {
    await service.recordHit(2.5);
    expect(mockRedis.pipeline).toHaveBeenCalled();
  });

  it('should record misses in Redis pipeline with duration', async () => {
    await service.recordMiss(45.0);
    expect(mockRedis.pipeline).toHaveBeenCalled();
  });

  it('should record bypasses via incr', async () => {
    await service.recordBypass(10.0);
    expect(mockRedis.incr).toHaveBeenCalledWith(METRIC_KEYS.BYPASSES);
  });

  it('should calculate hit ratio and average latencies accurately', async () => {
    const stats = await service.getStats();

    expect(stats.hits).toBe(7);
    expect(stats.misses).toBe(3);
    expect(stats.bypasses).toBe(0);
    expect(stats.hitRatio).toBe('70.00%');
    expect(stats.avgHitLatencyMs).toBe(2.0); // 14.0 / 7
    expect(stats.avgMissLatencyMs).toBe(40.0); // 120.0 / 3
    expect(stats.totalKeysEstimated).toBe(42);
  });

  it('should return 0.00% hitRatio when zero requests have occurred', async () => {
    mockRedis.mget.mockResolvedValue([null, null, null, null, null]);
    mockRedis.dbsize.mockResolvedValue(0);

    const stats = await service.getStats();

    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRatio).toBe('0.00%');
    expect(stats.avgHitLatencyMs).toBe(0);
    expect(stats.avgMissLatencyMs).toBe(0);
  });

  it('should reset telemetry keys on resetStats()', async () => {
    await service.resetStats();
    expect(mockRedis.del).toHaveBeenCalledWith(
      METRIC_KEYS.HITS,
      METRIC_KEYS.MISSES,
      METRIC_KEYS.BYPASSES,
      METRIC_KEYS.HITS_TOTAL_MS,
      METRIC_KEYS.MISSES_TOTAL_MS,
    );
  });

  it('should use in-memory fallback counters when Redis status is disconnected', async () => {
    mockRedis.status = 'end';

    await service.recordHit(5.0);
    await service.recordMiss(50.0);

    const stats = await service.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBe('50.00%');
    expect(stats.avgHitLatencyMs).toBe(5.0);
    expect(stats.avgMissLatencyMs).toBe(50.0);
  });
});
