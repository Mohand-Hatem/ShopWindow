import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { FindProductsQueryDto } from './dto/find-products-query.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

export interface ProductDetailResult {
  data: any;
  cacheStatus: CacheStatus;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
  ) {}

  async findAll(query: FindProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // 1. Build filtering conditions (only ACTIVE products)
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
    };

    if (query.category) {
      where.category = { slug: query.category };
    }

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = query.maxPrice;
      }
    }

    // 2. Build sorting
    let orderBy: Prisma.ProductOrderByWithRelationInput = { updatedAt: 'desc' };
    if (query.sort === 'price_asc') {
      orderBy = { price: 'asc' };
    } else if (query.sort === 'price_desc') {
      orderBy = { price: 'desc' };
    } else if (query.sort === 'newest') {
      orderBy = { updatedAt: 'desc' };
    }

    // 3. Execute parallel queries directly on PostgreSQL (Uncached baseline)
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

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Cache-Aside Pattern:
   * 1. Check Redis for prod:detail:id:{id} or prod:detail:slug:{slug}
   * 2. If HIT -> Return cached data immediately
   * 3. If MISS -> Query database, populate both ID and Slug cache keys, then return
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

    // 3. Populate cache under both ID and Slug keys for instant cross-resolution
    await Promise.all([
      this.cache.set(`prod:detail:id:${product.id}`, product),
      this.cache.set(`prod:detail:slug:${product.slug}`, product),
    ]);

    return {
      data: product,
      cacheStatus: 'MISS',
    };
  }
}
