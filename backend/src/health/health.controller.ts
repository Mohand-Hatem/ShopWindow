import { Controller, Get, Post, HttpStatus, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../cache/cache.port';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PORT) private readonly cache: CachePort,
  ) {}

  @Get()
  async check(@Res() res: Response) {
    let dbConnected = false;
    let cacheConnected = false;
    let dbError: string | null = null;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch (err: any) {
      dbError = err.message;
    }

    cacheConnected = await this.cache.isHealthy();

    const isFullyHealthy = dbConnected && cacheConnected;
    const statusCode = dbConnected ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isFullyHealthy ? 'ok' : 'degraded',
      database: dbConnected ? 'connected' : 'disconnected',
      cache: cacheConnected ? 'connected' : 'disconnected',
      queries: {
        total: this.prisma.queryCount,
        productDetail: this.prisma.productDetailQueryCount,
      },
      ...(dbError ? { error: dbError } : {}),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  @Post('reset-queries')
  async resetQueries(@Res() res: Response) {
    this.prisma.resetQueryCounts();
    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'Query counters reset to 0',
      queries: {
        total: this.prisma.queryCount,
        productDetail: this.prisma.productDetailQueryCount,
      },
    });
  }
}

