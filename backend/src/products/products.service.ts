import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { FindProductsQueryDto } from './dto/find-products-query.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PRODUCT_DETAIL_TTL = 300;   // 5 minutes (300 seconds)
export const PRODUCT_LIST_TTL = 120;     // 2 minutes (120 seconds)
export const PRODUCT_NEGATIVE_TTL = 30;  // 30 seconds (Negative cache for 404 penetration guard)

export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

export class CachedNotFoundException extends NotFoundException {
  constructor(message: string, public readonly cacheStatus: CacheStatus) {
    super(message);
  }
}

export interface ProductDetailResult {
  data: any;
  cacheStatus: CacheStatus;
}

export interface PaginatedProductsResult {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductListResult {
  data: PaginatedProductsResult;
  cacheStatus: CacheStatus;
}

import {
  buildCanonicalListCacheKey,
  buildNegativeProductKey,
  normalizeProductQuery,
} from '../cache/query-normalizer';
import { TtlPolicyService } from '../cache/ttl-policy.service';
import { SingleFlightLockService } from '../cache/single-flight-lock.service';

export const buildListCacheKey = buildCanonicalListCacheKey;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
    private readonly ttlPolicy: TtlPolicyService,
    private readonly singleFlightLock: SingleFlightLockService,
  ) {}

  async findAll(query: FindProductsQueryDto): Promise<ProductListResult> {
    const listVer = await this.cache.getListVersion();
    const norm = normalizeProductQuery(query);
    const cacheKey = buildCanonicalListCacheKey(query, listVer);

    // 1. Check Redis for cached collection with explicit status
    const { value: cached, status } = await this.cache.getWithStatus<PaginatedProductsResult>(cacheKey);
    if (status === 'HIT' && cached) {
      return {
        data: cached,
        cacheStatus: 'HIT',
      };
    }

    // 2. Cache MISS / BYPASS -> execute PostgreSQL queries with normalized inputs
    const page = norm.page;
    const limit = norm.limit;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
    };

    if (norm.category) {
      where.category = { slug: norm.category };
    }

    if (norm.q) {
      where.OR = [
        { name: { contains: norm.q, mode: 'insensitive' } },
        { description: { contains: norm.q, mode: 'insensitive' } },
      ];
    }

    if (norm.minPrice !== undefined || norm.maxPrice !== undefined) {
      where.price = {};
      if (norm.minPrice !== undefined) {
        where.price.gte = norm.minPrice;
      }
      if (norm.maxPrice !== undefined) {
        where.price.lte = norm.maxPrice;
      }
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { updatedAt: 'desc' };
    if (norm.sort === 'price_asc') {
      orderBy = { price: 'asc' };
    } else if (norm.sort === 'price_desc') {
      orderBy = { price: 'desc' };
    } else if (norm.sort === 'newest') {
      orderBy = { updatedAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const result: PaginatedProductsResult = {
      items,
      total,
      page,
      limit,
      totalPages,
    };

    // 3. Store collection in Redis with jittered 120s TTL (skip if degraded)
    if (status !== 'BYPASS') {
      const listTtl = this.ttlPolicy.applyJitter(PRODUCT_LIST_TTL);
      await this.cache.set(cacheKey, result, listTtl);
    }

    return {
      data: result,
      cacheStatus: status === 'BYPASS' ? 'BYPASS' : 'MISS',
    };
  }

  /**
   * Cache-Aside Pattern with Single-Flight Lock Pattern (Distributed Mutex)
   * and Negative Caching (Penetration Guard):
   * 1. Check Redis for positive cache (prod:detail:id:{id} or prod:detail:slug:{slug})
   * 2. If status is BYPASS -> Fail-open directly to PostgreSQL (zero 500 errors)
   * 3. Check Redis for negative sentinel (prod:detail:neg:{idOrSlug}) -> If HIT, 404 immediately
   * 4. If MISS -> Acquire distributed lock via SingleFlightLockService (prod:lock:detail:{idOrSlug})
   * 5. Winner: Queries PostgreSQL, populates cache with jittered TTL, releases lock, returns { data, cacheStatus: 'MISS' }
   * 6. Followers: Wait in backoff loop, poll cache, and return { data, cacheStatus: 'HIT' }
   */
  async findByIdOrSlug(idOrSlug: string): Promise<ProductDetailResult> {
    const isUuid = UUID_REGEX.test(idOrSlug);
    const cacheKey = isUuid ? `prod:detail:id:${idOrSlug}` : `prod:detail:slug:${idOrSlug}`;
    const negativeKey = buildNegativeProductKey(idOrSlug);

    // 1. Fast path: Check positive cache
    const { value: cached, status } = await this.cache.getWithStatus<any>(cacheKey);
    if (status === 'HIT' && cached) {
      return {
        data: cached,
        cacheStatus: 'HIT',
      };
    }

    // 2. Fail-Open Path: If Redis is down, timed out (>150ms), or disconnected,
    // immediately query PostgreSQL directly with zero 500 errors
    if (status === 'BYPASS') {
      const where: Prisma.ProductWhereInput = {
        status: ProductStatus.ACTIVE,
        ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }),
      };

      const product = await this.prisma.product.findFirst({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (!product) {
        throw new CachedNotFoundException(
          `Product with identifier "${idOrSlug}" not found`,
          'BYPASS',
        );
      }

      return {
        data: product,
        cacheStatus: 'BYPASS',
      };
    }

    // 3. Fast path: Check negative cache (penetration guard)
    const isNegativeCached = await this.cache.get<string>(negativeKey);
    if (isNegativeCached) {
      throw new CachedNotFoundException(
        `Product with identifier "${idOrSlug}" not found`,
        'HIT',
      );
    }

    // 4. Cache MISS -> Single-Flight Lock coordinates concurrent requests
    const lockKey = `prod:lock:detail:${idOrSlug}`;

    const { data, isWinner } = await this.singleFlightLock.executeWithLock<any>(
      lockKey,
      async () => {
        // Double-check cache in case winner populated it right before lock acquisition
        const doubleCached = await this.cache.get<any>(cacheKey);
        if (doubleCached) {
          return doubleCached;
        }
        const doubleNegative = await this.cache.get<string>(negativeKey);
        if (doubleNegative) {
          throw new CachedNotFoundException(
            `Product with identifier "${idOrSlug}" not found`,
            'HIT',
          );
        }

        // Query database
        const where: Prisma.ProductWhereInput = {
          status: ProductStatus.ACTIVE,
          ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }),
        };

        const product = await this.prisma.product.findFirst({
          where,
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        });

        if (!product) {
          // Set negative cache sentinel with jittered 30s TTL to protect DB against penetration attacks
          const negTtl = this.ttlPolicy.applyJitter(PRODUCT_NEGATIVE_TTL);
          await this.cache.set(negativeKey, '1', negTtl);
          throw new CachedNotFoundException(
            `Product with identifier "${idOrSlug}" not found`,
            'MISS',
          );
        }

        // Populate positive cache under both ID and Slug keys with jittered 5-minute TTL
        const detailTtl = this.ttlPolicy.applyJitter(PRODUCT_DETAIL_TTL);
        await Promise.all([
          this.cache.set(`prod:detail:id:${product.id}`, product, detailTtl),
          this.cache.set(`prod:detail:slug:${product.slug}`, product, detailTtl),
        ]);

        return product;
      },
      {
        lockTtlSeconds: 10,
        retryDelayMs: 40,
        maxRetries: 30,
        checkCache: async () => {
          const pos = await this.cache.get<any>(cacheKey);
          if (pos) return pos;

          const neg = await this.cache.get<string>(negativeKey);
          if (neg) {
            throw new CachedNotFoundException(
              `Product with identifier "${idOrSlug}" not found`,
              'HIT',
            );
          }
          return null;
        },
      },
    );

    return {
      data,
      cacheStatus: isWinner ? 'MISS' : 'HIT',
    };
  }
}
