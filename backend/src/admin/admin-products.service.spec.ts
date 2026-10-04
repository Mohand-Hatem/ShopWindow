import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { ProductStatus } from '@prisma/client';

describe('AdminProductsService - Active Invalidation (Unit Tests)', () => {
  let service: AdminProductsService;
  let mockPrisma: any;
  let mockCache: Partial<Record<keyof CachePort, jest.Mock>>;

  const mockCategory = { id: 'cat-1', name: 'Electronics', slug: 'electronics' };
  const mockProduct = {
    id: 'prod-uuid-123',
    sku: 'SKU-001',
    name: 'Wireless Mouse',
    slug: 'wireless-mouse',
    description: 'A great wireless mouse',
    price: 49.99,
    currency: 'USD',
    categoryId: 'cat-1',
    stock: 50,
    status: ProductStatus.ACTIVE,
    category: mockCategory,
  };

  beforeEach(async () => {
    mockPrisma = {
      category: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn(),
      incr: jest.fn(),
      ttl: jest.fn(),
      isHealthy: jest.fn(),
      getListVersion: jest.fn().mockResolvedValue(1),
      bumpListVersion: jest.fn().mockResolvedValue(2),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminProductsService,
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

    service = module.get<AdminProductsService>(AdminProductsService);
  });

  describe('create()', () => {
    it('should create product in DB, evict negative cache, and bump list version', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.product.create.mockResolvedValue(mockProduct);

      const result = await service.create({
        sku: 'SKU-NEW',
        name: 'New Headset',
        slug: 'new-headset',
        description: 'High-performance gaming headset with surround sound.',
        price: 99.99,
        categoryId: 'cat-1',
      });

      expect(result).toEqual(mockProduct);
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:neg:${mockProduct.slug.toLowerCase()}`);
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:neg:${mockProduct.id.toLowerCase()}`);
      expect(mockCache.bumpListVersion).toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('should update product in DB and evict ID and slug cache keys', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      const updatedProduct = { ...mockProduct, price: 39.99 };
      mockPrisma.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update(mockProduct.id, { price: 39.99 });

      expect(result.price).toBe(39.99);
      expect(mockPrisma.product.update).toHaveBeenCalled();

      // Verifies active cache eviction for both ID and slug
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:id:${mockProduct.id}`);
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:slug:${mockProduct.slug}`);
      expect(mockCache.bumpListVersion).toHaveBeenCalled();
    });

    it('should evict both old slug and new slug if product slug changes', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      const updatedProduct = { ...mockProduct, name: 'Pro Wireless Mouse', slug: 'pro-wireless-mouse' };
      mockPrisma.product.update.mockResolvedValue(updatedProduct);

      await service.update(mockProduct.id, { slug: 'pro-wireless-mouse' });

      // Verifies old slug, new slug, and ID are all evicted
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:id:${mockProduct.id}`);
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:slug:${mockProduct.slug}`);
      expect(mockCache.del).toHaveBeenCalledWith('prod:detail:slug:pro-wireless-mouse');
      expect(mockCache.bumpListVersion).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update('fake-id', { price: 10 })).rejects.toThrow(NotFoundException);
      expect(mockCache.del).not.toHaveBeenCalled();
      expect(mockCache.bumpListVersion).not.toHaveBeenCalled();
    });
  });

  describe('archive()', () => {
    it('should set status to ARCHIVED in DB and evict cache keys immediately', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      const archivedProduct = { ...mockProduct, status: ProductStatus.ARCHIVED };
      mockPrisma.product.update.mockResolvedValue(archivedProduct);

      const result = await service.archive(mockProduct.id);

      expect(result.success).toBe(true);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProduct.id },
        data: { status: ProductStatus.ARCHIVED },
      });

      // Verifies active cache eviction so archived product is not served
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:id:${mockProduct.id}`);
      expect(mockCache.del).toHaveBeenCalledWith(`prod:detail:slug:${mockProduct.slug}`);
      expect(mockCache.bumpListVersion).toHaveBeenCalled();
    });

    it('should throw NotFoundException if product to archive does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.archive('fake-id')).rejects.toThrow(NotFoundException);
      expect(mockCache.del).not.toHaveBeenCalled();
      expect(mockCache.bumpListVersion).not.toHaveBeenCalled();
    });
  });
});
