import { Controller, Get, Post, Body, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { CacheMetricsService, CacheStatsDto } from '../cache/cache-metrics.service';
import { AdminCacheService, PurgeResult } from './admin-cache.service';
import { PurgeCacheDto } from './dto/purge-cache.dto';
import { MockAdminGuard } from './guards/mock-admin.guard';

@Controller('admin/cache')
@UseGuards(MockAdminGuard)
export class AdminCacheController {
  constructor(
    private readonly cacheMetricsService: CacheMetricsService,
    private readonly adminCacheService: AdminCacheService,
  ) {}

  /**
   * GET /admin/cache/stats
   * Retrieve aggregated real-time cache performance metrics, hit ratio, and latencies.
   */
  @Get('stats')
  async getStats(): Promise<CacheStatsDto> {
    return this.cacheMetricsService.getStats();
  }

  /**
   * POST /admin/cache/reset-stats
   * Reset all telemetry metrics and counters to zero.
   */
  @Post('reset-stats')
  @HttpCode(HttpStatus.OK)
  async resetStats() {
    await this.cacheMetricsService.resetStats();
    return {
      success: true,
      message: 'Cache telemetry metrics successfully reset to zero',
    };
  }

  /**
   * POST /admin/cache/purge
   * Scoped cache invalidation: 'product' (by id/slug), 'lists' (via listVer), or 'all' (SCAN + UNLINK).
   */
  @Post('purge')
  @HttpCode(HttpStatus.OK)
  async purge(@Body() dto: PurgeCacheDto): Promise<PurgeResult> {
    return this.adminCacheService.purge(dto);
  }
}
