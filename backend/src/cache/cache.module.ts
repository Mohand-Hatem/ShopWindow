import { Module, Global, OnModuleDestroy, OnApplicationShutdown, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_PORT } from './cache.port';
import { RedisCacheAdapter, REDIS_CLIENT } from './redis-cache.adapter';
import { TtlPolicyService } from './ttl-policy.service';
import { SingleFlightLockService } from './single-flight-lock.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheMetricsInterceptor } from '../common/interceptors/cache-metrics.interceptor';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const logger = new Logger('RedisClient');
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = Number(config.get<number>('REDIS_PORT', 6379));
        const password = config.get<string>('REDIS_PASSWORD') || undefined;

        const redis = new Redis({
          host,
          port,
          password,
          lazyConnect: true,
          enableOfflineQueue: false,
          retryStrategy: (times) => {
            if (times > 3) {
              return null; // Stop retrying so timers do not leak in tests
            }
            return Math.min(times * 100, 1000);
          },
          maxRetriesPerRequest: 3,
        });

        redis.on('connect', () => {
          logger.log(`Connected to Redis at ${host}:${port}`);
        });

        redis.on('error', (err) => {
          logger.warn(`Redis connection error: ${err.message}`);
        });

        // Trigger connection asynchronously so it doesn't block bootstrap
        redis.connect().catch((err) => {
          logger.warn(`Initial Redis connection failed: ${err.message}`);
        });

        return redis;
      },
      inject: [ConfigService],
    },
    {
      provide: CACHE_PORT,
      useClass: RedisCacheAdapter,
    },
    TtlPolicyService,
    SingleFlightLockService,
    CacheMetricsService,
    CacheMetricsInterceptor,
  ],
  exports: [
    CACHE_PORT,
    REDIS_CLIENT,
    TtlPolicyService,
    SingleFlightLockService,
    CacheMetricsService,
    CacheMetricsInterceptor,
  ],
})
export class CacheModule implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(CacheModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.cleanup();
  }

  async onApplicationShutdown() {
    await this.cleanup();
  }

  private async cleanup() {
    this.logger.log('Closing Redis connection gracefully...');
    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connecting') {
        await this.redis.quit();
      } else {
        this.redis.disconnect();
      }
    } catch {
      this.redis.disconnect();
    }
  }
}
