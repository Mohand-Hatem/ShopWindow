import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { ProductStatus } from '@prisma/client';
import { TtlPolicyService } from '../cache/ttl-policy.service';
import { SingleFlightLockService } from '../cache/single-flight-lock.service';

describe('ProductsService - Cache-Aside Logic (Unit Tests)', () => {
  let service: ProductsService;
  let mockPrisma: any;
  let mockCache: Partial<Record<keyof CachePort, jest.Mock>>;

  const mockProduct = {
    id: '7ebd4625-9215-4d6e-9f2e-50889053d300',
    name: 'Zenith Pro Earbuds 521',
    slug: 'zenith-pro-earbuds-521',
    price: 1376.99,
    status: ProductStatus.ACTIVE,
    category: { id: 'cat-1', name: 'Audio', slug: 'audio' },
  };

  beforeEach(async () => {
    mockPrisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    mockCache = {
      get: jest.fn(),
      getWithStatus: jest.fn().mockImplementation(async (key: string) => {
        const val = await mockCache.get(key);
        return { value: val, status: val ? 'HIT' : 'MISS' };
      }),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      incr: jest.fn(),
      ttl: jest.fn(),
      isHealthy: jest.fn(),
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
      getListVersion: jest.fn().mockResolvedValue(1),
      bumpListVersion: jest.fn().mockResolvedValue(2),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        TtlPolicyService,
        SingleFlightLockService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CACHE_PORT,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findByIdOrSlug (Cache-Aside Pattern)', () => {
    it('should return HIT from cache without touching the database', async () => {
      mockCache.get.mockResolvedValue(mockProduct);

      const result = await service.findByIdOrSlug('zenith-pro-earbuds-521');

      expect(result.cacheStatus).toBe('HIT');
      expect(result.data).toEqual(mockProduct);
      expect(mockCache.get).toHaveBeenCalledWith('prod:detail:slug:zenith-pro-earbuds-521');
      expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
    });

    it('should return MISS on cold cache, fetch from database, and populate both ID and slug keys in cache', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockCache.set.mockResolvedValue(undefined);

      const result = await service.findByIdOrSlug('zenith-pro-earbuds-521');

      expect(result.cacheStatus).toBe('MISS');
      expect(result.data).toEqual(mockProduct);
      expect(mockCache.get).toHaveBeenCalledWith('prod:detail:slug:zenith-pro-earbuds-521');
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: {
          status: ProductStatus.ACTIVE,
          slug: 'zenith-pro-earbuds-521',
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      // Verifies both ID and Slug keys are populated in cache with jittered 300s TTL (within [270, 330])
      expect(mockCache.set).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenCalledWith(`prod:detail:id:${mockProduct.id}`, mockProduct, expect.any(Number));
      expect(mockCache.set).toHaveBeenCalledWith(`prod:detail:slug:${mockProduct.slug}`, mockProduct, expect.any(Number));
      const detailCall = mockCache.set.mock.calls.find((c) => c[0].startsWith('prod:detail:id:'));
      expect(detailCall[2]).toBeGreaterThanOrEqual(270);
      expect(detailCall[2]).toBeLessThanOrEqual(330);
    });

    it('should check prod:detail:id:{uuid} when query is a UUID', async () => {
      const uuid = '7ebd4625-9215-4d6e-9f2e-50889053d300';
      mockCache.get.mockResolvedValue(mockProduct);

      const result = await service.findByIdOrSlug(uuid);

      expect(result.cacheStatus).toBe('HIT');
      expect(mockCache.get).toHaveBeenCalledWith(`prod:detail:id:${uuid}`);
      expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
    });

    it('should query DB on cold 404, set negative cache marker with jittered 30s TTL, and throw CachedNotFoundException(MISS)', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findByIdOrSlug('non-existent-slug')).rejects.toThrow(NotFoundException);

      expect(mockPrisma.product.findFirst).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('prod:detail:neg:non-existent-slug', '1', expect.any(Number));
      const negCall = mockCache.set.mock.calls.find((c) => c[0].startsWith('prod:detail:neg:'));
      expect(negCall[2]).toBeGreaterThanOrEqual(27);
      expect(negCall[2]).toBeLessThanOrEqual(33);
    });

    it('should return HIT from negative cache without touching the database when negative sentinel exists', async () => {
      // First call for positive key returns null, second call for negative key returns '1'
      mockCache.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('1');

      await expect(service.findByIdOrSlug('non-existent-slug')).rejects.toThrow(NotFoundException);

      expect(mockCache.get).toHaveBeenNthCalledWith(1, 'prod:detail:slug:non-existent-slug');
      expect(mockCache.get).toHaveBeenNthCalledWith(2, 'prod:detail:neg:non-existent-slug');
      expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('findAll() (Collection Caching)', () => {
    const mockEnvelope = {
      items: [mockProduct],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    it('should return HIT from cache without querying Prisma', async () => {
      mockCache.get.mockResolvedValue(mockEnvelope);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.cacheStatus).toBe('HIT');
      expect(result.data).toEqual(mockEnvelope);
      expect(mockCache.getListVersion).toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalledWith('prod:list:v=1:lim=20:p=1:sort=newest');
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.product.count).not.toHaveBeenCalled();
    });

    it('should query Prisma on cache MISS, store envelope in cache with 120s TTL, and return MISS', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20, category: 'audio' });

      expect(result.cacheStatus).toBe('MISS');
      expect(result.data.items).toEqual([mockProduct]);
      expect(result.data.total).toBe(1);
      expect(mockCache.get).toHaveBeenCalledWith('prod:list:v=1:cat=audio:lim=20:p=1:sort=newest');
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        'prod:list:v=1:cat=audio:lim=20:p=1:sort=newest',
        expect.objectContaining({ total: 1, page: 1 }),
        expect.any(Number),
      );
      const listCall = mockCache.set.mock.calls.find((c) => c[0].startsWith('prod:list:'));
      expect(listCall[2]).toBeGreaterThanOrEqual(108);
      expect(listCall[2]).toBeLessThanOrEqual(132);
    });

    it('should generate distinct cache keys for different query parameters and preserve order invariance', async () => {
      mockCache.get.mockResolvedValue(mockEnvelope);

      await service.findAll({ page: 2, limit: 10, sort: 'price_asc' });
      expect(mockCache.get).toHaveBeenCalledWith('prod:list:v=1:lim=10:p=2:sort=price_asc');

      await service.findAll({ q: 'keyboard', minPrice: 10, maxPrice: 100 });
      expect(mockCache.get).toHaveBeenCalledWith('prod:list:v=1:lim=20:max=100:min=10:p=1:q=keyboard:sort=newest');

      // Test parameter order invariance
      await service.findAll({ limit: 10, sort: 'price_asc', page: 2 });
      expect(mockCache.get).toHaveBeenLastCalledWith('prod:list:v=1:lim=10:p=2:sort=price_asc');
    });

    it('should use updated list version when listVer increases', async () => {
      mockCache.getListVersion.mockResolvedValue(3);
      mockCache.get.mockResolvedValue(mockEnvelope);

      await service.findAll({ page: 1, limit: 20 });
      expect(mockCache.get).toHaveBeenCalledWith('prod:list:v=3:lim=20:p=1:sort=newest');
    });

    it('should fail-open and return status BYPASS without writing to Redis when cache is degraded', async () => {
      mockCache.getWithStatus.mockResolvedValue({ value: null, status: 'BYPASS' });
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.cacheStatus).toBe('BYPASS');
      expect(result.data.items).toEqual([mockProduct]);
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
      // Must NOT attempt to write to cache when degraded
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('findByIdOrSlug - Fail-Open Degradation', () => {
    it('should query Prisma directly and return status BYPASS when Redis getWithStatus returns BYPASS', async () => {
      mockCache.getWithStatus.mockResolvedValue({ value: null, status: 'BYPASS' });
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.findByIdOrSlug('zenith-pro-earbuds-521');
      expect(result.cacheStatus).toBe('BYPASS');
      expect(result.data).toEqual(mockProduct);
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: { status: ProductStatus.ACTIVE, slug: 'zenith-pro-earbuds-521' },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      // Distributed lock should NOT have been acquired during fail-open
      expect(mockCache.acquireLock).not.toHaveBeenCalled();
    });

    it('should throw CachedNotFoundException with BYPASS when product is missing and Redis is degraded', async () => {
      mockCache.getWithStatus.mockResolvedValue({ value: null, status: 'BYPASS' });
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findByIdOrSlug('nonexistent-slug')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

