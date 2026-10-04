import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CacheMetricsService } from '../../cache/cache-metrics.service';

/**
 * CacheMetricsInterceptor (Phase 17)
 *
 * Automatically records cache hits, misses, and bypasses along with request
 * latency by observing the `X-Cache` response header set during request processing.
 * Explicitly skips `/health` and `/admin` routes so administrative overhead
 * does not skew customer traffic statistics.
 */
@Injectable()
export class CacheMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: CacheMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const rawUrl = req.originalUrl || req.url || req.path || '';
    const pathname = rawUrl.split('?')[0];

    // Skip telemetry for health probes and admin operations
    if (pathname.startsWith('/health') || pathname.startsWith('/admin')) {
      return next.handle();
    }

    const start = Date.now();

    const recordMetric = () => {
      const durationMs = Math.max(0.1, Date.now() - start);
      const cacheHeader = (res.getHeader('x-cache') || res.getHeader('X-Cache')) as string | undefined;

      if (cacheHeader === 'HIT') {
        this.metricsService.recordHit(durationMs).catch(() => null);
      } else if (cacheHeader === 'MISS') {
        this.metricsService.recordMiss(durationMs).catch(() => null);
      } else if (cacheHeader === 'BYPASS') {
        this.metricsService.recordBypass(durationMs).catch(() => null);
      }
    };

    return next.handle().pipe(
      tap({
        next: recordMetric,
        error: recordMetric,
      }),
    );
  }
}
