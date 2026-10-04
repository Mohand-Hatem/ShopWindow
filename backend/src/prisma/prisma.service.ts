import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public queryCount = 0;
  public productDetailQueryCount = 0;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Attach event listener for SQL query telemetry
    // @ts-ignore
    this.$on('query', (e: Prisma.QueryEvent) => {
      this.queryCount++;
      if (
        e.query.includes('"products"') &&
        (e.query.includes('slug') || e.query.includes('id'))
      ) {
        this.productDetailQueryCount++;
      }
      if (process.env.LOG_PRISMA_QUERIES === 'true') {
        this.logger.log(`[Prisma Query] duration=${e.duration}ms: ${e.query}`);
      }
    });
  }

  resetQueryCounts() {
    this.queryCount = 0;
    this.productDetailQueryCount = 0;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

