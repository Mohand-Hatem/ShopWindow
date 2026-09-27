import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { ProductStatus } from '@prisma/client';

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
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      incr: jest.fn(),
      isHealthy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
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

      // Verifies both ID and Slug keys are populated in cache
      expect(mockCache.set).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenCalledWith(`prod:detail:id:${mockProduct.id}`, mockProduct);
      expect(mockCache.set).toHaveBeenCalledWith(`prod:detail:slug:${mockProduct.slug}`, mockProduct);
    });

    it('should check prod:detail:id:{uuid} when query is a UUID', async () => {
      const uuid = '7ebd4625-9215-4d6e-9f2e-50889053d300';
      mockCache.get.mockResolvedValue(mockProduct);

      const result = await service.findByIdOrSlug(uuid);

      expect(result.cacheStatus).toBe('HIT');
      expect(mockCache.get).toHaveBeenCalledWith(`prod:detail:id:${uuid}`);
      expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if product is not in cache and not in database', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findByIdOrSlug('non-existent-slug')).rejects.toThrow(NotFoundException);

      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });
});
