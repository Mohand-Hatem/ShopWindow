import { ExecutionContext, CallHandler, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import {
  HttpCacheInterceptor,
  HTTP_CACHE_CONTROL_HEADER,
} from './http-cache.interceptor';

describe('HttpCacheInterceptor', () => {
  let interceptor: HttpCacheInterceptor;
  let mockRequest: any;
  let mockResponse: any;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new HttpCacheInterceptor();

    mockRequest = {
      method: 'GET',
      path: '/products/classic-tee',
      headers: {},
    };

    mockResponse = {
      headersSent: false,
      headers: {} as Record<string, string>,
      statusCode: 200,
      setHeader: jest.fn((key: string, val: string) => {
        mockResponse.headers[key.toLowerCase()] = val;
      }),
      status: jest.fn((code: number) => {
        mockResponse.statusCode = code;
        return mockResponse;
      }),
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  it('should generate ETag and Cache-Control headers for GET requests', (done) => {
    const payload = { id: 'p1', name: 'Classic Tee', price: 29.99 };
    mockCallHandler = { handle: () => of(payload) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual(payload);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        HTTP_CACHE_CONTROL_HEADER,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'ETag',
        expect.stringMatching(/^W\/"[0-9a-f]+-[A-Za-z0-9+/=]+"/),
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });

  it('should return HTTP 304 Not Modified when If-None-Match matches ETag exactly', (done) => {
    const payload = { id: 'p1', name: 'Classic Tee' };
    mockCallHandler = { handle: () => of(payload) };

    // First call to derive the deterministic etag
    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      const generatedEtag = mockResponse.headers['etag'];
      expect(generatedEtag).toBeDefined();

      // Second call with If-None-Match matching generated ETag
      mockRequest.headers['if-none-match'] = generatedEtag;
      mockResponse.status.mockClear();

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
        expect(result).toBeNull();
        done();
      });
    });
  });

  it('should return HTTP 304 Not Modified for weak comparison matching without W/ prefix', (done) => {
    const payload = { id: 'p1', name: 'Classic Tee' };
    mockCallHandler = { handle: () => of(payload) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      const generatedEtag = mockResponse.headers['etag'];
      const rawTag = generatedEtag.replace(/^W\//, '');

      // Client sends raw quotes without W/
      mockRequest.headers['if-none-match'] = rawTag;
      mockResponse.status.mockClear();

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
        expect(result).toBeNull();
        done();
      });
    });
  });

  it('should return HTTP 304 for wildcard If-None-Match: *', (done) => {
    const payload = { id: 'p1', name: 'Classic Tee' };
    mockCallHandler = { handle: () => of(payload) };
    mockRequest.headers['if-none-match'] = '*';

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
      expect(result).toBeNull();
      done();
    });
  });

  it('should return 200 OK with fresh body and ETag when If-None-Match does not match', (done) => {
    const payload = { id: 'p1', name: 'Classic Tee' };
    mockCallHandler = { handle: () => of(payload) };
    mockRequest.headers['if-none-match'] = 'W/"outdated-etag-hash"';

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(mockResponse.status).not.toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
      expect(result).toEqual(payload);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('ETag', expect.any(String));
      done();
    });
  });

  it('should bypass non-GET requests (e.g. POST, PATCH)', (done) => {
    mockRequest.method = 'POST';
    const payload = { success: true };
    mockCallHandler = { handle: () => of(payload) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual(payload);
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      done();
    });
  });

  it('should bypass /health endpoint GET requests', (done) => {
    mockRequest.path = '/health';
    const payload = { status: 'ok' };
    mockCallHandler = { handle: () => of(payload) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual(payload);
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      done();
    });
  });

  it('should passthrough when data is null or headers already sent', (done) => {
    mockCallHandler = { handle: () => of(null) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toBeNull();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      done();
    });
  });
});
