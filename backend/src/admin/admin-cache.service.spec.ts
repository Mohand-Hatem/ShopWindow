import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminCacheService } from './admin-cache.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminCacheService', () => {
  let service: AdminCacheService;
  let mockCache: Partial<CachePort>;
  let mockPrisma: any;

  beforeEach(async () => {
    mockCache = {
      del: jest.fn().mockResolvedValue(undefined),
      bumpListVersion: jest.fn().mockResolvedValue(4),
      unlinkByPattern: jest.fn().mockResolvedValue(15),
    };

    mockPrisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-123',
          slug: 'product-slug-123',
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCacheService,
        {
          provide: CACHE_PORT,
          useValue: mockCache,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AdminCacheService>(AdminCacheService);
  });

  describe('scope: product', () => {
    it('should throw BadRequestException if id is missing or empty', async () => {
      await expect(service.purge({ scope: 'product' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.purge({ scope: 'product', id: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete product detail, slug, and negative cache keys', async () => {
      const res = await service.purge({ scope: 'product', id: 'p-123' });

      expect(res.success).toBe(true);
      expect(res.scope).toBe('product');
      expect(mockCache.del).toHaveBeenCalledWith('prod:detail:id:p-123');
      expect(mockCache.del).toHaveBeenCalledWith('prod:detail:slug:product-slug-123');
      expect(mockCache.del).toHaveBeenCalledWith('prod:detail:neg:p-123');
    });
  });

  describe('scope: lists', () => {
    it('should bump list version in O(1) without unlinking individual keys', async () => {
      const res = await service.purge({ scope: 'lists' });

      expect(res.success).toBe(true);
      expect(res.scope).toBe('lists');
      expect(res.newVersion).toBe(4);
      expect(mockCache.bumpListVersion).toHaveBeenCalled();
      expect(mockCache.unlinkByPattern).not.toHaveBeenCalled();
    });
  });

  describe('scope: all', () => {
    it('should bump list version and unlink all prod:* and catalog:* keys', async () => {
      const res = await service.purge({ scope: 'all' });

      expect(res.success).toBe(true);
      expect(res.scope).toBe('all');
      expect(res.newVersion).toBe(4);
      expect(res.unlinkedKeys).toBe(30); // 15 + 15
      expect(mockCache.bumpListVersion).toHaveBeenCalled();
      expect(mockCache.unlinkByPattern).toHaveBeenCalledWith('prod:*');
      expect(mockCache.unlinkByPattern).toHaveBeenCalledWith('catalog:*');
    });
  });
});
