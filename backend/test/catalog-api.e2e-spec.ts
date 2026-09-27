import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Catalog API Endpoints (E2E Baseline - Uncached)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdProductId: string;
  let sampleCategory: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    // Get a sample category for admin testing
    sampleCategory = await prisma.category.findFirst({ where: { slug: 'electronics' } });
  });

  afterAll(async () => {
    if (createdProductId) {
      await prisma.product.delete({ where: { id: createdProductId } }).catch(() => null);
    }
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 with database: connected', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(['ok', 'degraded']).toContain(res.body.status);
      expect(res.body.database).toBe('connected');
    });
  });

  describe('GET /categories', () => {
    it('should return 8 categories with active product counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(8);
      expect(res.body[0]).toHaveProperty('slug');
      expect(res.body[0]).toHaveProperty('_count');
      expect(res.body[0]._count).toHaveProperty('products');
    });
  });

  describe('GET /products', () => {
    it('should return paginated active products with metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?page=1&limit=10')
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(res.body.items.length).toBe(10);
      expect(res.body.total).toBeGreaterThan(450);
      expect(res.body.items[0]).toHaveProperty('category');
    });

    it('should reject requests with limit exceeding 50 with HTTP 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?limit=100')
        .expect(400);

      expect(res.body.message).toContain('limit must not be greater than 50');
    });

    it('should filter products by category slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?category=electronics&limit=5')
        .expect(200);

      expect(res.body.items.length).toBeGreaterThan(0);
      for (const item of res.body.items) {
        expect(item.category.slug).toBe('electronics');
      }
    });

    it('should sort products by price ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?sort=price_asc&limit=5')
        .expect(200);

      const items = res.body.items;
      expect(items.length).toBe(5);
      for (let i = 1; i < items.length; i++) {
        expect(Number(items[i].price)).toBeGreaterThanOrEqual(Number(items[i - 1].price));
      }
    });
  });

  describe('GET /products/:idOrSlug', () => {
    it('should fetch product detail by slug', async () => {
      // Get an active product slug
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/products/${sample!.slug}`)
        .expect(200);

      expect(res.body.id).toBe(sample!.id);
      expect(res.body.slug).toBe(sample!.slug);
      expect(res.body.category).toBeDefined();
    });

    it('should return X-Cache: HIT on subsequent fetch of the same product', async () => {
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      // First request (warms the cache if not already warm)
      await request(app.getHttpServer())
        .get(`/products/${sample!.slug}`)
        .expect(200);

      // Second request MUST be a cache HIT
      const hitRes = await request(app.getHttpServer())
        .get(`/products/${sample!.slug}`)
        .expect(200);

      expect(hitRes.headers['x-cache']).toBe('HIT');
      expect(hitRes.body.slug).toBe(sample!.slug);
    });

    it('should return 404 for nonexistent product identifier', async () => {
      const res = await request(app.getHttpServer())
        .get('/products/completely-fake-product-slug-12345')
        .expect(404);

      expect(res.body.message).toContain('not found');
    });
  });

  describe('Admin CRUD Operations', () => {
    it('POST /admin/products should create a new active product', async () => {
      const payload = {
        sku: 'TEST-SKU-9999',
        name: 'Test Autonomous Drone 99',
        slug: 'test-autonomous-drone-99',
        description: 'High-speed test drone for automated testing.',
        price: 299.99,
        categoryId: sampleCategory.id,
        stock: 45,
      };

      const res = await request(app.getHttpServer())
        .post('/admin/products')
        .send(payload)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(payload.name);
      expect(res.body.status).toBe('ACTIVE');
      createdProductId = res.body.id;
    });

    it('PATCH /admin/products/:id should update product fields', async () => {
      const updatePayload = {
        price: 349.99,
        stock: 50,
      };

      const res = await request(app.getHttpServer())
        .patch(`/admin/products/${createdProductId}`)
        .send(updatePayload)
        .expect(200);

      expect(Number(res.body.price)).toBe(349.99);
      expect(res.body.stock).toBe(50);
    });

    it('DELETE /admin/products/:id should archive product and hide it from customer browse', async () => {
      // 1. Archive
      const res = await request(app.getHttpServer())
        .delete(`/admin/products/${createdProductId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ARCHIVED');

      // 2. Customer read for this archived product must return 404
      await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(404);
    });
  });
});
