import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { FindProductsQueryDto } from './dto/find-products-query.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PRODUCT_DETAIL_TTL = 300; // 5 minutes (300 seconds)
export const PRODUCT_LIST_TTL = 120;   // 2 minutes (120 seconds)

export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

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

import { buildCanonicalListCacheKey, normalizeProductQuery } from '../cache/query-normalizer';

export const buildListCacheKey = buildCanonicalListCacheKey;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
  ) {}

  async findAll(query: FindProductsQueryDto): Promise<ProductListResult> {
    const listVer = await this.cache.getListVersion();
    const norm = normalizeProductQuery(query);
    const cacheKey = buildCanonicalListCacheKey(query, listVer);

    // 1. Check Redis for cached collection
    const cached = await this.cache.get<PaginatedProductsResult>(cacheKey);
    if (cached) {
      return {
        data: cached,
        cacheStatus: 'HIT',
      };
    }

    // 2. Cache MISS -> execute PostgreSQL queries with normalized inputs
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

    // 3. Store collection in Redis with 120s TTL
    await this.cache.set(cacheKey, result, PRODUCT_LIST_TTL);

    return {
      data: result,
      cacheStatus: 'MISS',
    };
  }

  /**
   * Cache-Aside Pattern for Product Detail:
   * 1. Check Redis for prod:detail:id:{id} or prod:detail:slug:{slug}
   * 2. If HIT -> Return cached data immediately
   * 3. If MISS -> Query database, populate both ID and Slug cache keys with 300s TTL, then return
   */
  async findByIdOrSlug(idOrSlug: string): Promise<ProductDetailResult> {
    const isUuid = UUID_REGEX.test(idOrSlug);
    const cacheKey = isUuid ? `prod:detail:id:${idOrSlug}` : `prod:detail:slug:${idOrSlug}`;

    // 1. Check cache
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) {
      return {
        data: cached,
        cacheStatus: 'HIT',
      };
    }

    // 2. Cache miss -> query Supabase PostgreSQL
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
      throw new NotFoundException(`Product with identifier "${idOrSlug}" not found`);
    }

    // 3. Populate cache under both ID and Slug keys for instant cross-resolution with 5-minute TTL
    await Promise.all([
      this.cache.set(`prod:detail:id:${product.id}`, product, PRODUCT_DETAIL_TTL),
      this.cache.set(`prod:detail:slug:${product.slug}`, product, PRODUCT_DETAIL_TTL),
    ]);

    return {
      data: product,
      cacheStatus: 'MISS',
    };
  }
}
