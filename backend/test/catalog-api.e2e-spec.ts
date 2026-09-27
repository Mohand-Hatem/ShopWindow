import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CACHE_PORT, CachePort } from '../src/cache/cache.port';

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

    // Clean cache before running tests to ensure deterministic state
    const cache = app.get<CachePort>(CACHE_PORT);
    await cache.delByPattern('*');

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

    it('should return X-Cache: HIT on subsequent identical list fetch', async () => {
      // 1. First fetch (MISS or warm)
      await request(app.getHttpServer())
        .get('/products?page=1&limit=10')
        .expect(200);

      // 2. Second fetch MUST be a cache HIT
      const hitRes = await request(app.getHttpServer())
        .get('/products?page=1&limit=10')
        .expect(200);

      expect(hitRes.headers['x-cache']).toBe('HIT');
      expect(hitRes.body.items.length).toBe(10);
    });

    it('should store list cache keys with a positive TTL <= 120 seconds', async () => {
      await request(app.getHttpServer())
        .get('/products?page=1&limit=10')
        .expect(200);

      const cache = app.get<CachePort>(CACHE_PORT);
      const listVer = await cache.getListVersion();
      const remainingTtl = await cache.ttl(`prod:list:v=${listVer}:lim=10:p=1:sort=newest`);

      expect(remainingTtl).toBeGreaterThan(0);
      expect(remainingTtl).toBeLessThanOrEqual(120);
    });

    it('should achieve cache HIT regardless of parameter order or redundant default values', async () => {
      // 1. Initial request with page first, then limit
      const firstRes = await request(app.getHttpServer())
        .get('/products?page=2&limit=15')
        .expect(200);
      expect(firstRes.body.items.length).toBe(15);

      // 2. Subsequent request with inverted query parameter order -> MUST HIT cache
      const hitResOrder = await request(app.getHttpServer())
        .get('/products?limit=15&page=2')
        .expect(200);
      expect(hitResOrder.headers['x-cache']).toBe('HIT');
      expect(hitResOrder.body.items.length).toBe(15);

      // 3. Subsequent request with explicit default sort (sort=newest) -> MUST HIT cache
      const hitResDefault = await request(app.getHttpServer())
        .get('/products?limit=15&page=2&sort=newest')
        .expect(200);
      expect(hitResDefault.headers['x-cache']).toBe('HIT');
    });

    it('should return X-Cache: MISS when query parameters differ', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?page=3&limit=7&sort=price_desc')
        .expect(200);

      expect(res.headers['x-cache']).toBe('MISS');
      expect(res.body.page).toBe(3);
      expect(res.body.limit).toBe(7);
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

    it('should store cached product keys with a positive TTL <= 300 seconds', async () => {
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      // Ensure key is cached
      await request(app.getHttpServer())
        .get(`/products/${sample!.slug}`)
        .expect(200);

      const cache = app.get<CachePort>(CACHE_PORT);
      const remainingTtl = await cache.ttl(`prod:detail:slug:${sample!.slug}`);

      // Redis TTL must be active, positive, and <= 300
      expect(remainingTtl).toBeGreaterThan(0);
      expect(remainingTtl).toBeLessThanOrEqual(300);
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

    it('PATCH /admin/products/:id should update product and actively evict stale cache', async () => {
      // 1. Warm the cache for this product
      const warmRes = await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(200);
      expect(Number(warmRes.body.price)).toBe(299.99);

      // Verify second fetch is a cache HIT
      const hitRes = await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(200);
      expect(hitRes.headers['x-cache']).toBe('HIT');

      // 2. Perform Admin Update (Price change: 299.99 -> 349.99)
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

      // 3. Verify Redis cache was actively evicted!
      const cache = app.get<CachePort>(CACHE_PORT);
      const cachedAfterUpdate = await cache.get(`prod:detail:id:${createdProductId}`);
      expect(cachedAfterUpdate).toBeNull();

      // 4. Next customer fetch MUST be a cache MISS and return updated price immediately!
      const freshRes = await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(200);

      expect(freshRes.headers['x-cache']).toBe('MISS');
      expect(Number(freshRes.body.price)).toBe(349.99);
    });

    it('DELETE /admin/products/:id should archive product, evict cache, and hide it from customer browse', async () => {
      // 1. Warm cache before archiving
      await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(200);

      // 2. Archive
      const res = await request(app.getHttpServer())
        .delete(`/admin/products/${createdProductId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ARCHIVED');

      // 3. Verify Redis cache was actively purged
      const cache = app.get<CachePort>(CACHE_PORT);
      const cachedAfterArchive = await cache.get(`prod:detail:id:${createdProductId}`);
      expect(cachedAfterArchive).toBeNull();

      // 4. Customer read for this archived product must return 404
      await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(404);
    });

    it('Admin mutations should bump listVer and immediately invalidate cached catalog listings in O(1)', async () => {
      const cache = app.get<CachePort>(CACHE_PORT);
      const initialVer = await cache.getListVersion();

      // 1. Warm catalog list cache
      await request(app.getHttpServer())
        .get('/products?page=1&limit=8')
        .expect(200);

      // Verify second fetch is a HIT
      const hitRes = await request(app.getHttpServer())
        .get('/products?page=1&limit=8')
        .expect(200);
      expect(hitRes.headers['x-cache']).toBe('HIT');

      // 2. Perform an Admin Create mutation (bumps listVer)
      const payload = {
        sku: 'TEST-SKU-V-BUMP',
        name: 'Version Bump Test Item',
        slug: 'version-bump-test-item',
        description: 'Verifying atomic O(1) version invalidation.',
        price: 88.88,
        categoryId: sampleCategory.id,
        stock: 10,
      };

      await request(app.getHttpServer())
        .post('/admin/products')
        .send(payload)
        .expect(201);

      // 3. Verify Redis listVer counter was incremented
      const bumpedVer = await cache.getListVersion();
      expect(bumpedVer).toBe(initialVer + 1);

      // 4. Next customer list fetch MUST be a cache MISS and return updated catalog!
      const freshRes = await request(app.getHttpServer())
        .get('/products?page=1&limit=8')
        .expect(200);
      expect(freshRes.headers['x-cache']).toBe('MISS');

      // 5. Subsequent request is a cache HIT under the new version
      const secondHitRes = await request(app.getHttpServer())
        .get('/products?page=1&limit=8')
        .expect(200);
      expect(secondHitRes.headers['x-cache']).toBe('HIT');

      // 6. Verify Redis holds the new key with the bumped version
      const newKeyExists = await cache.get(`prod:list:v=${bumpedVer}:lim=8:p=1:sort=newest`);
      expect(newKeyExists).not.toBeNull();
    });
  });
});
