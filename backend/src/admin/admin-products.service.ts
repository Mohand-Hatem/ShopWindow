import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${dto.categoryId}" not found`);
    }

    return this.prisma.product.create({
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

    return this.prisma.product.update({
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
  }

  async archive(id: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    const archived = await this.prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.ARCHIVED,
      },
    });

    return {
      success: true,
      message: `Product "${archived.name}" archived successfully`,
      id: archived.id,
      status: archived.status,
    };
  }
}
