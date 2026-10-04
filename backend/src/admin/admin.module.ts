import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminCacheController } from './admin-cache.controller';
import { AdminCacheService } from './admin-cache.service';
import { MockAdminGuard } from './guards/mock-admin.guard';

@Module({
  controllers: [AdminProductsController, AdminCacheController],
  providers: [AdminProductsService, AdminCacheService, MockAdminGuard],
  exports: [AdminProductsService, AdminCacheService, MockAdminGuard],
})
export class AdminModule {}
