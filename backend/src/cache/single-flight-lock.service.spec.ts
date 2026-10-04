import { Test, TestingModule } from '@nestjs/testing';
import { SingleFlightLockService } from './single-flight-lock.service';
import { CACHE_PORT, CachePort } from './cache.port';

describe('SingleFlightLockService', () => {
  let service: SingleFlightLockService;
  let mockCache: jest.Mocked<CachePort>;

  beforeEach(async () => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      incr: jest.fn(),
      ttl: jest.fn(),
      getListVersion: jest.fn(),
      bumpListVersion: jest.fn(),
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
      isHealthy: jest.fn(),
    } as unknown as jest.Mocked<CachePort>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SingleFlightLockService,
        {
          provide: CACHE_PORT,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<SingleFlightLockService>(SingleFlightLockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithLock - Winner Path', () => {
    it('should acquire lock, execute rebuilder, release lock, and return isWinner: true', async () => {
      mockCache.acquireLock.mockResolvedValue(true);
      mockCache.releaseLock.mockResolvedValue(true);

      const rebuilder = jest.fn().mockResolvedValue({ id: 'prod-1', name: 'MacBook Pro' });

      const result = await service.executeWithLock(
        'prod:lock:detail:macbook-pro',
        rebuilder,
        { lockTtlSeconds: 10 },
      );

      expect(mockCache.acquireLock).toHaveBeenCalledTimes(1);
      expect(mockCache.acquireLock).toHaveBeenCalledWith(
        'prod:lock:detail:macbook-pro',
        expect.any(String),
        10,
      );
      expect(rebuilder).toHaveBeenCalledTimes(1);
      expect(mockCache.releaseLock).toHaveBeenCalledTimes(1);
      expect(mockCache.releaseLock).toHaveBeenCalledWith(
        'prod:lock:detail:macbook-pro',
        expect.any(String),
      );
      expect(result).toEqual({
        data: { id: 'prod-1', name: 'MacBook Pro' },
        isWinner: true,
      });
    });

    it('should guarantee lock release via Lua even if rebuilder throws', async () => {
      mockCache.acquireLock.mockResolvedValue(true);
      mockCache.releaseLock.mockResolvedValue(true);

      const rebuilder = jest.fn().mockRejectedValue(new Error('PostgreSQL Connection Timeout'));

      await expect(
        service.executeWithLock('prod:lock:detail:failing-item', rebuilder),
      ).rejects.toThrow('PostgreSQL Connection Timeout');

      expect(mockCache.acquireLock).toHaveBeenCalledTimes(1);
      expect(rebuilder).toHaveBeenCalledTimes(1);
      expect(mockCache.releaseLock).toHaveBeenCalledTimes(1);
      expect(mockCache.releaseLock).toHaveBeenCalledWith(
        'prod:lock:detail:failing-item',
        expect.any(String),
      );
    });
  });

  describe('executeWithLock - Follower Path', () => {
    it('should wait, poll cache, and return cached value with isWinner: false when lock is held', async () => {
      // First call to acquireLock returns false (lock held by winner)
      mockCache.acquireLock.mockResolvedValue(false);

      const cachedProduct = { id: 'prod-2', name: 'Sony Headphones' };
      const checkCache = jest
        .fn()
        .mockResolvedValueOnce(null)          // 1st retry: still rebuilding
        .mockResolvedValueOnce(cachedProduct); // 2nd retry: winner finished and wrote to cache

      const rebuilder = jest.fn().mockResolvedValue({ id: 'prod-2', name: 'Fresh from DB' });

      const result = await service.executeWithLock(
        'prod:lock:detail:sony-headphones',
        rebuilder,
        {
          lockTtlSeconds: 5,
          retryDelayMs: 10,
          maxRetries: 5,
          checkCache,
        },
      );

      expect(mockCache.acquireLock).toHaveBeenCalledTimes(2);
      expect(checkCache).toHaveBeenCalledTimes(2);
      // Rebuilder must NOT have been called by the follower
      expect(rebuilder).not.toHaveBeenCalled();
      // Follower must NOT release the winner's lock
      expect(mockCache.releaseLock).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: cachedProduct,
        isWinner: false,
      });
    });

    it('should propagate CachedNotFoundException thrown by checkCache on negative cache hits', async () => {
      mockCache.acquireLock.mockResolvedValue(false);

      const notFoundError = new Error('Product not found (Cached 404)');
      const checkCache = jest.fn().mockRejectedValue(notFoundError);
      const rebuilder = jest.fn();

      await expect(
        service.executeWithLock('prod:lock:detail:ghost-item', rebuilder, {
          retryDelayMs: 5,
          maxRetries: 3,
          checkCache,
        }),
      ).rejects.toThrow('Product not found (Cached 404)');

      expect(rebuilder).not.toHaveBeenCalled();
    });

    it('should execute fallback rebuilder if maxRetries are exhausted and cache is still empty', async () => {
      mockCache.acquireLock.mockResolvedValue(false);

      const checkCache = jest.fn().mockResolvedValue(null);
      const rebuilder = jest.fn().mockResolvedValue({ id: 'fallback', name: 'Safety Fallback' });

      const result = await service.executeWithLock(
        'prod:lock:detail:stalled-winner',
        rebuilder,
        {
          retryDelayMs: 5,
          maxRetries: 2,
          checkCache,
        },
      );

      expect(checkCache).toHaveBeenCalledTimes(2);
      expect(rebuilder).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        data: { id: 'fallback', name: 'Safety Fallback' },
        isWinner: true,
      });
    });
  });
});
