import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { CacheMetricsInterceptor } from './cache-metrics.interceptor';
import { CacheMetricsService } from '../../cache/cache-metrics.service';

describe('CacheMetricsInterceptor', () => {
  let interceptor: CacheMetricsInterceptor;
  let mockMetricsService: Partial<CacheMetricsService>;
  let mockRequest: any;
  let mockResponse: any;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    mockMetricsService = {
      recordHit: jest.fn().mockResolvedValue(undefined),
      recordMiss: jest.fn().mockResolvedValue(undefined),
      recordBypass: jest.fn().mockResolvedValue(undefined),
    };

    interceptor = new CacheMetricsInterceptor(
      mockMetricsService as CacheMetricsService,
    );

    mockRequest = {
      method: 'GET',
      path: '/products/classic-tee',
      headers: {},
    };

    mockResponse = {
      headers: {} as Record<string, string>,
      getHeader: jest.fn((key: string) => mockResponse.headers[key.toLowerCase()]),
      setHeader: jest.fn((key: string, val: string) => {
        mockResponse.headers[key.toLowerCase()] = val;
      }),
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  it('should record HIT when X-Cache header is HIT', (done) => {
    mockResponse.headers['x-cache'] = 'HIT';
    mockCallHandler = { handle: () => of({ name: 'Product' }) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      expect(mockMetricsService.recordHit).toHaveBeenCalledWith(
        expect.any(Number),
      );
      done();
    });
  });

  it('should record MISS when X-Cache header is MISS', (done) => {
    mockResponse.headers['x-cache'] = 'MISS';
    mockCallHandler = { handle: () => of({ name: 'Product' }) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      expect(mockMetricsService.recordMiss).toHaveBeenCalledWith(
        expect.any(Number),
      );
      done();
    });
  });

  it('should record BYPASS when X-Cache header is BYPASS', (done) => {
    mockResponse.headers['x-cache'] = 'BYPASS';
    mockCallHandler = { handle: () => of({ name: 'Product' }) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      expect(mockMetricsService.recordBypass).toHaveBeenCalledWith(
        expect.any(Number),
      );
      done();
    });
  });

  it('should record telemetry even when stream throws error (e.g. 404 CachedNotFoundException)', (done) => {
    mockResponse.headers['x-cache'] = 'HIT';
    mockCallHandler = { handle: () => throwError(() => new Error('Not found')) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: () => {
        expect(mockMetricsService.recordHit).toHaveBeenCalled();
        done();
      },
    });
  });

  it('should skip recording on /health and /admin routes', (done) => {
    mockRequest.path = '/health';
    mockResponse.headers['x-cache'] = 'HIT';
    mockCallHandler = { handle: () => of({ status: 'ok' }) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      expect(mockMetricsService.recordHit).not.toHaveBeenCalled();
      done();
    });
  });
});
