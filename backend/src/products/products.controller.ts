import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ProductsService } from './products.service';
import { FindProductsQueryDto } from './dto/find-products-query.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query() query: FindProductsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, cacheStatus } = await this.productsService.findAll(query);
    res.setHeader('X-Cache', cacheStatus);
    return data;
  }

  @Get(':idOrSlug')
  async findOne(
    @Param('idOrSlug') idOrSlug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, cacheStatus } = await this.productsService.findByIdOrSlug(idOrSlug);
    res.setHeader('X-Cache', cacheStatus);
    return data;
  }
}
