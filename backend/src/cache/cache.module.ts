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
        const redisUrl = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = Number(config.get<number>('REDIS_PORT', 6379));
        const password = config.get<string>('REDIS_PASSWORD') || undefined;
        const useTls = config.get<string>('REDIS_TLS') === 'true' || port === 6380;

        const commonOptions: any = {
          lazyConnect: true,
          enableOfflineQueue: false,
          retryStrategy: (times: number) => {
            if (times > 3) {
              return null; // Stop retrying so timers do not leak in tests
            }
            return Math.min(times * 100, 1000);
          },
          maxRetriesPerRequest: 3,
        };

        const redis = redisUrl
          ? new Redis(redisUrl, commonOptions)
          : new Redis({
              host,
              port,
              password,
              tls: useTls ? {} : undefined,
              ...commonOptions,
            });

        redis.on('connect', () => {
          logger.log(`Connected to Redis ${redisUrl ? '(via REDIS_URL)' : `at ${host}:${port}`}`);
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
