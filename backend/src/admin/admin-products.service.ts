import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
  ) {}

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${dto.categoryId}" not found`);
    }

    const created = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        price: dto.price,
        currency: dto.currency || 'USD',
        categoryId: dto.categoryId,
        stock: dto.stock ?? 0,
        status: ProductStatus.ACTIVE,
      },
      include: {
        category: true,
      },
    });

    // Invalidate any potential stale negative cache for this slug or id
    await Promise.all([
      this.cache.del(`prod:detail:neg:${created.slug.toLowerCase()}`),
      this.cache.del(`prod:detail:neg:${created.id.toLowerCase()}`),
    ]);

    // Bump catalog list version to immediately invalidate all cached listings in O(1)
    await this.cache.bumpListVersion();

    return created;
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with id "${dto.categoryId}" not found`);
      }
    }

    // 1. Commit update to PostgreSQL first (Database-First Order)
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.description && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
      },
      include: {
        category: true,
      },
    });

    // 2. Active Cache Invalidation: Evict ID key, old slug key, and new slug key
    const keysToInvalidate = new Set<string>([
      `prod:detail:id:${id}`,
      `prod:detail:slug:${existing.slug}`,
      `prod:detail:slug:${updated.slug}`,
    ]);

    await Promise.all(
      Array.from(keysToInvalidate).map((key) => this.cache.del(key)),
    );

    // Bump catalog list version to immediately invalidate all cached listings in O(1)
    await this.cache.bumpListVersion();

    return updated;
  }

  async archive(id: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    // 1. Commit archive status to PostgreSQL
    const archived = await this.prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.ARCHIVED,
      },
    });

    // 2. Active Cache Invalidation: Purge both ID and Slug keys immediately
    await Promise.all([
      this.cache.del(`prod:detail:id:${id}`),
      this.cache.del(`prod:detail:slug:${existing.slug}`),
    ]);

    // Bump catalog list version to immediately invalidate all cached listings in O(1)
    await this.cache.bumpListVersion();

    return {
      success: true,
      message: `Product "${archived.name}" archived successfully`,
      id: archived.id,
      status: archived.status,
    };
  }
}
