import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CACHE_PORT, CachePort } from '../cache/cache.port';
import { PrismaService } from '../prisma/prisma.service';
import { PurgeCacheDto } from './dto/purge-cache.dto';

export interface PurgeResult {
  success: boolean;
  scope: 'product' | 'lists' | 'all';
  target?: string;
  unlinkedKeys?: number;
  newVersion?: number;
  message: string;
}

@Injectable()
export class AdminCacheService {
  private readonly logger = new Logger(AdminCacheService.name);

  constructor(
    @Inject(CACHE_PORT) private readonly cache: CachePort,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Scoped administrative cache purge orchestrator (Phase 18)
   *
   * - 'product': Surgically evicts a specific product by ID or slug without collateral damage.
   * - 'lists': Atomically bumps `listVer` in O(1), instantly invalidating all paginated lists.
   * - 'all': Bumps `listVer` and performs non-blocking SCAN + UNLINK over all catalog keys.
   */
  async purge(dto: PurgeCacheDto): Promise<PurgeResult> {
    if (dto.scope === 'product') {
      if (!dto.id || dto.id.trim() === '') {
        throw new BadRequestException(
          'id or slug is required when scope is "product"',
        );
      }

      const target = dto.id.trim();
      const keysToEvict = [
        `prod:detail:id:${target}`,
        `prod:detail:slug:${target}`,
        `prod:detail:neg:${target}`,
      ];

      try {
        const product = await this.prisma.product.findFirst({
          where: {
            OR: [{ id: target }, { slug: target }],
          },
        });

        if (product) {
          keysToEvict.push(`prod:detail:id:${product.id}`);
          keysToEvict.push(`prod:detail:slug:${product.slug}`);
          keysToEvict.push(`prod:detail:neg:${product.slug}`);
          keysToEvict.push(`prod:detail:neg:${product.id}`);
        }
      } catch (err: any) {
        this.logger.warn(`Prisma lookup during purge failed: ${err.message}`);
      }

      const uniqueKeys = Array.from(new Set(keysToEvict));
      await Promise.all(uniqueKeys.map((key) => this.cache.del(key)));

      return {
        success: true,
        scope: 'product',
        target,
        message: `Successfully purged cache for product "${target}"`,
      };
    }

    if (dto.scope === 'lists') {
      const newVersion = await this.cache.bumpListVersion();

      return {
        success: true,
        scope: 'lists',
        newVersion,
        message: `Successfully invalidated all catalog list views via O(1) version increment (version: ${newVersion})`,
      };
    }

    if (dto.scope === 'all') {
      const newVersion = await this.cache.bumpListVersion();
      const unlinkedProd = await this.cache.unlinkByPattern('prod:*');
      const unlinkedCatalog = await this.cache.unlinkByPattern('catalog:*');
      const totalUnlinked = unlinkedProd + unlinkedCatalog;

      return {
        success: true,
        scope: 'all',
        unlinkedKeys: totalUnlinked,
        newVersion,
        message: `Successfully purged entire catalog cache (${totalUnlinked} keys unlinked, new list version: ${newVersion})`,
      };
    }

    throw new BadRequestException(`Unsupported cache purge scope: ${(dto as any).scope}`);
  }
}
