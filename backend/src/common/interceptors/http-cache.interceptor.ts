import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

export const HTTP_CACHE_CONTROL_HEADER = 'public, max-age=60, stale-while-revalidate=30';

/**
 * RFC 7232 HTTP Conditional Request & Checksum Interceptor (Phase 16)
 *
 * 1. Computes a deterministic cryptographic entity tag (ETag) for outgoing GET payloads.
 * 2. Attaches standard HTTP headers:
 *    - `ETag: W/"<byteLength>-<sha1>"`
 *    - `Cache-Control: public, max-age=60, stale-while-revalidate=30`
 * 3. Evaluates incoming `If-None-Match` header:
 *    - If match: short-circuits with HTTP 304 Not Modified and sends 0 bytes of payload body.
 *    - If no match / modified: sends HTTP 200 OK with full payload and fresh ETag.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const rawUrl = req.originalUrl || req.url || req.path || '';
    const pathname = rawUrl.split('?')[0];

    // Only apply HTTP conditional validation to idempotent safe GET requests (skipping system healthcheck)
    if (req.method !== 'GET' || pathname.startsWith('/health')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If data is null/undefined or headers were already sent, passthrough
        if (data === null || data === undefined || res.headersSent) {
          return data;
        }

        // 1. Compute deterministic checksum
        const serialized = typeof data === 'string' ? data : JSON.stringify(data);
        const hash = crypto
          .createHash('sha1')
          .update(serialized, 'utf8')
          .digest('base64')
          .substring(0, 27);
        const etag = `W/"${Buffer.byteLength(serialized, 'utf8').toString(16)}-${hash}"`;

        // 2. Attach ETag and Cache-Control headers
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', HTTP_CACHE_CONTROL_HEADER);

        // 3. Evaluate If-None-Match condition (RFC 7232)
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch) {
          const clientTags = ifNoneMatch.split(',').map((tag) => tag.trim());
          const isMatch = clientTags.some((clientTag) => {
            if (clientTag === '*') return true;
            if (clientTag === etag) return true;
            // Weak comparison: strip W/ prefix and match base hash
            const cleanClient = clientTag.replace(/^W\//, '');
            const cleanServer = etag.replace(/^W\//, '');
            return cleanClient === cleanServer;
          });

          if (isMatch) {
            res.status(HttpStatus.NOT_MODIFIED);
            return null; // Express status(304) sends zero-length body
          }
        }

        return data;
      }),
    );
  }
}
