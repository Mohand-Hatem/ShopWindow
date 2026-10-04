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

    it('should store list cache keys with a jittered TTL within [108, 132] seconds', async () => {
      await request(app.getHttpServer())
        .get('/products?page=1&limit=10')
        .expect(200);

      const cache = app.get<CachePort>(CACHE_PORT);
      const listVer = await cache.getListVersion();
      const remainingTtl = await cache.ttl(`prod:list:v=${listVer}:lim=10:p=1:sort=newest`);

      expect(remainingTtl).toBeGreaterThanOrEqual(100);
      expect(remainingTtl).toBeLessThanOrEqual(132);
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

    it('should store cached product keys with a jittered TTL within [270, 330] seconds', async () => {
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      // Ensure key is cached
      await request(app.getHttpServer())
        .get(`/products/${sample!.slug}`)
        .expect(200);

      const cache = app.get<CachePort>(CACHE_PORT);
      const remainingTtl = await cache.ttl(`prod:detail:slug:${sample!.slug}`);

      // Redis TTL must be active, positive, and within jittered bounds [270, 330]
      expect(remainingTtl).toBeGreaterThanOrEqual(260);
      expect(remainingTtl).toBeLessThanOrEqual(330);
    });

    it('should return 404 with X-Cache: MISS on cold nonexistent product, and X-Cache: HIT on subsequent requests', async () => {
      const fakeSlug = 'completely-fake-product-slug-12345';
      const cache = app.get<CachePort>(CACHE_PORT);

      // 1. First 404 lookup (Cold -> Database queried -> negative marker set in Redis)
      const missRes = await request(app.getHttpServer())
        .get(`/products/${fakeSlug}`)
        .expect(404);

      expect(missRes.headers['x-cache']).toBe('MISS');
      expect(missRes.body.message).toContain('not found');

      // 2. Second 404 lookup (Hot -> Served from Redis negative cache sentinel without querying PostgreSQL!)
      const hitRes = await request(app.getHttpServer())
        .get(`/products/${fakeSlug}`)
        .expect(404);

      expect(hitRes.headers['x-cache']).toBe('HIT');
      expect(hitRes.body.message).toContain('not found');

      // 3. Verify Redis negative cache entry has positive jittered TTL within [27, 33] seconds
      const remainingTtl = await cache.ttl(`prod:detail:neg:${fakeSlug}`);
      expect(remainingTtl).toBeGreaterThanOrEqual(25);
      expect(remainingTtl).toBeLessThanOrEqual(33);
    });

    it('should immediately clear negative cache when an admin creates the previously missing product', async () => {
      const suffix = Date.now().toString().slice(-6);
      const newSlug = `newly-created-missing-item-${suffix}`;
      const cache = app.get<CachePort>(CACHE_PORT);

      // 1. Initial 404 lookup generates negative cache marker
      await request(app.getHttpServer())
        .get(`/products/${newSlug}`)
        .expect(404);

      const markerBefore = await cache.get(`prod:detail:neg:${newSlug}`);
      expect(markerBefore).toBe('1');

      // 2. Admin creates the product with this exact slug
      const payload = {
        sku: `SKU-RECOVER-${suffix}`,
        name: 'Newly Created Missing Item',
        slug: newSlug,
        description: 'Previously 404 now live.',
        price: 49.99,
        categoryId: sampleCategory.id,
        stock: 20,
      };

      await request(app.getHttpServer())
        .post('/admin/products')
        .send(payload)
        .expect(201);

      // 3. Negative cache marker must be deleted immediately!
      const markerAfter = await cache.get(`prod:detail:neg:${newSlug}`);
      expect(markerAfter).toBeNull();

      // 4. Client read must now succeed with HTTP 200
      const liveRes = await request(app.getHttpServer())
        .get(`/products/${newSlug}`)
        .expect(200);

      expect(liveRes.body.slug).toBe(newSlug);
    });

    it('should collapse concurrent cold requests into exactly 1 database query via SingleFlightLock', async () => {
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      const cache = app.get<CachePort>(CACHE_PORT);
      // Ensure positive and negative keys are purged
      await cache.del(`prod:detail:slug:${sample!.slug}`);
      await cache.del(`prod:detail:id:${sample!.id}`);

      // Reset query counter
      await request(app.getHttpServer()).post('/health/reset-queries').expect(200);

      // Fire 15 concurrent requests simultaneously
      const concurrency = 15;
      const promises = Array.from({ length: concurrency }, () =>
        request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200),
      );

      const responses = await Promise.all(promises);

      // Verify all responses succeeded with the correct product
      for (const res of responses) {
        expect(res.body.slug).toBe(sample!.slug);
      }

      // Check cache headers
      const missCount = responses.filter((r) => r.headers['x-cache'] === 'MISS').length;
      const hitCount = responses.filter((r) => r.headers['x-cache'] === 'HIT').length;

      // Exactly 1 request was the winner and got MISS
      expect(missCount).toBe(1);
      // All other requests were followers and got HIT
      expect(hitCount).toBe(concurrency - 1);

      // Verify database telemetry shows exactly 1 productDetail query
      const healthRes = await request(app.getHttpServer()).get('/health').expect(200);
      expect(healthRes.body.queries.productDetail).toBe(1);
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
      const bumpSuffix = Date.now().toString().slice(-6);
      const payload = {
        sku: `TEST-SKU-V-BUMP-${bumpSuffix}`,
        name: 'Version Bump Test Item',
        slug: `version-bump-test-item-${bumpSuffix}`,
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

  describe('Graceful Degradation (Fail-Open Resilience)', () => {
    it('should fail-open and return 200 with X-Cache: BYPASS when cache read experiences error or timeout', async () => {
      const cache = app.get<CachePort>(CACHE_PORT);
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });

      // Simulate cache degradation / bypass
      const spy = jest.spyOn(cache, 'getWithStatus').mockResolvedValueOnce({
        value: null,
        status: 'BYPASS',
      });

      const res = await request(app.getHttpServer())
        .get(`/products/${sample!.slug}`)
        .expect(200);

      expect(res.headers['x-cache']).toBe('BYPASS');
      expect(res.body.slug).toBe(sample!.slug);

      spy.mockRestore();
    });

    it('should fail-open and return 404 with X-Cache: BYPASS on missing item when cache is degraded (zero 500s)', async () => {
      const cache = app.get<CachePort>(CACHE_PORT);

      const spy = jest.spyOn(cache, 'getWithStatus').mockResolvedValueOnce({
        value: null,
        status: 'BYPASS',
      });

      const res = await request(app.getHttpServer())
        .get('/products/completely-missing-degraded-item-slug')
        .expect(404);

      expect(res.headers['x-cache']).toBe('BYPASS');
      expect(res.body.message).toContain('not found');

      spy.mockRestore();
    });
  });

  describe('HTTP Caching (RFC 7232 ETag / 304 Not Modified)', () => {
    it('should attach ETag and Cache-Control headers to GET responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?page=1&limit=5')
        .expect(200);

      expect(res.headers['etag']).toBeDefined();
      expect(res.headers['etag']).toMatch(/^W\/"[0-9a-f]+-[A-Za-z0-9+/=]+"/);
      expect(res.headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=30');
    });

    it('should return 304 Not Modified with empty body when If-None-Match matches ETag', async () => {
      // 1. Initial request to obtain fresh ETag
      const firstRes = await request(app.getHttpServer())
        .get('/products?page=1&limit=5')
        .expect(200);

      const etag = firstRes.headers['etag'];
      expect(etag).toBeDefined();

      // 2. Subsequent conditional request with If-None-Match
      const conditionalRes = await request(app.getHttpServer())
        .get('/products?page=1&limit=5')
        .set('If-None-Match', etag)
        .expect(304);

      // Verify zero-payload transmission
      expect(conditionalRes.text).toBe('');
      expect(conditionalRes.body).toEqual({});
      expect(conditionalRes.headers['etag']).toBe(etag);
    });

    it('should return 200 OK with fresh ETag when data changes between conditional requests', async () => {
      const suffix = Date.now().toString().slice(-6);
      // 1. Create a product
      const createRes = await request(app.getHttpServer())
        .post('/admin/products')
        .send({
          sku: `SKU-ETAG-${suffix}`,
          name: 'ETag Testing Widget',
          slug: `etag-testing-widget-${suffix}`,
          description: 'Testing 304 vs 200 invalidation.',
          price: 19.99,
          categoryId: sampleCategory.id,
          stock: 15,
        })
        .expect(201);

      const prodId = createRes.body.id;

      try {
        // 2. Initial fetch -> capture ETag
        const initialRes = await request(app.getHttpServer())
          .get(`/products/${prodId}`)
          .expect(200);
        const originalEtag = initialRes.headers['etag'];
        expect(originalEtag).toBeDefined();

        // 3. Conditional request before modification -> 304 Not Modified
        await request(app.getHttpServer())
          .get(`/products/${prodId}`)
          .set('If-None-Match', originalEtag)
          .expect(304);

        // 4. Admin modifies product price
        await request(app.getHttpServer())
          .patch(`/admin/products/${prodId}`)
          .send({ price: 29.99 })
          .expect(200);

        // 5. Conditional request with old ETag -> MUST return 200 OK with fresh data & new ETag!
        const modifiedRes = await request(app.getHttpServer())
          .get(`/products/${prodId}`)
          .set('If-None-Match', originalEtag)
          .expect(200);

        expect(modifiedRes.headers['etag']).toBeDefined();
        expect(modifiedRes.headers['etag']).not.toBe(originalEtag);
        expect(Number(modifiedRes.body.price)).toBe(29.99);
      } finally {
        await prisma.product.delete({ where: { id: prodId } }).catch(() => null);
      }
    });

    it('should bypass HTTP cache-control header for /health requests', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(res.headers['cache-control']).toBeUndefined();
    });
  });

  describe('Cache Telemetry & Real-Time Metrics (GET /admin/cache/stats)', () => {
    it('should reject unauthenticated access to /admin/cache/stats with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/cache/stats')
        .expect(401);

      expect(res.body.message).toContain('Invalid or missing admin authorization header');
    });

    it('should reject access with invalid admin token with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/cache/stats')
        .set('x-admin-auth', 'invalid-token')
        .expect(401);

      expect(res.body.message).toContain('Invalid or missing admin authorization header');
    });

    it('should reset telemetry stats via POST /admin/cache/reset-stats', async () => {
      const resetRes = await request(app.getHttpServer())
        .post('/admin/cache/reset-stats')
        .set('x-admin-auth', 'mock-secret')
        .expect(200);

      expect(resetRes.body.success).toBe(true);

      const statsRes = await request(app.getHttpServer())
        .get('/admin/cache/stats')
        .set('x-admin-auth', 'mock-secret')
        .expect(200);

      expect(statsRes.body.hits).toBe(0);
      expect(statsRes.body.misses).toBe(0);
      expect(statsRes.body.hitRatio).toBe('0.00%');
    });

    it('should accurately track hits, misses, hitRatio, and latency through real requests', async () => {
      // 1. Reset metrics baseline
      await request(app.getHttpServer())
        .post('/admin/cache/reset-stats')
        .set('x-admin-auth', 'mock-secret')
        .expect(200);

      // Invalidate list version so queries start cold
      const cache = app.get<CachePort>(CACHE_PORT);
      await cache.bumpListVersion();

      // 2. Trigger 3 cold MISSes
      const q1 = await request(app.getHttpServer()).get('/products?page=11&limit=2').expect(200);
      expect(q1.headers['x-cache']).toBe('MISS');

      const q2 = await request(app.getHttpServer()).get('/products?page=12&limit=2').expect(200);
      expect(q2.headers['x-cache']).toBe('MISS');

      const q3 = await request(app.getHttpServer()).get('/products?page=13&limit=2').expect(200);
      expect(q3.headers['x-cache']).toBe('MISS');

      // 3. Trigger 7 warm HITs against the cached queries
      for (let i = 0; i < 3; i++) {
        const hit = await request(app.getHttpServer()).get('/products?page=11&limit=2').expect(200);
        expect(hit.headers['x-cache']).toBe('HIT');
      }
      for (let i = 0; i < 2; i++) {
        const hit = await request(app.getHttpServer()).get('/products?page=12&limit=2').expect(200);
        expect(hit.headers['x-cache']).toBe('HIT');
      }
      for (let i = 0; i < 2; i++) {
        const hit = await request(app.getHttpServer()).get('/products?page=13&limit=2').expect(200);
        expect(hit.headers['x-cache']).toBe('HIT');
      }

      // 4. Fetch telemetry and assert hit ratio calculation (7 / (7 + 3) = 70.00%)
      const statsRes = await request(app.getHttpServer())
        .get('/admin/cache/stats')
        .set('x-admin-auth', 'mock-secret')
        .expect(200);

      expect(statsRes.body.hits).toBe(7);
      expect(statsRes.body.misses).toBe(3);
      expect(statsRes.body.bypasses).toBe(0);
      expect(statsRes.body.hitRatio).toBe('70.00%');
      expect(statsRes.body.avgHitLatencyMs).toBeGreaterThanOrEqual(0);
      expect(statsRes.body.avgMissLatencyMs).toBeGreaterThanOrEqual(0);
      expect(statsRes.body.totalKeysEstimated).toBeGreaterThan(0);
    });
  });

  describe('Admin Cache Operations (POST /admin/cache/purge)', () => {
    it('should reject unauthenticated purge requests with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/cache/purge')
        .send({ scope: 'lists' })
        .expect(401);

      expect(res.body.message).toContain('Invalid or missing admin authorization header');
    });

    it('should reject requests with invalid scope with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/cache/purge')
        .set('x-admin-auth', 'mock-secret')
        .send({ scope: 'invalid-scope' })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('scope must be one of');
    });

    it('should reject scope: product without id with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/cache/purge')
        .set('x-admin-auth', 'mock-secret')
        .send({ scope: 'product' })
        .expect(400);

      expect(res.body.message).toContain('id or slug is required when scope is "product"');
    });

    it('should surgically purge a single product cache while preserving list cache', async () => {
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      // 1. Warm product detail
      await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      const hitProd = await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      expect(hitProd.headers['x-cache']).toBe('HIT');

      // 2. Warm catalog list
      await request(app.getHttpServer()).get('/products?page=1&limit=6').expect(200);
      const hitList = await request(app.getHttpServer()).get('/products?page=1&limit=6').expect(200);
      expect(hitList.headers['x-cache']).toBe('HIT');

      // 3. Purge product cache surgically
      const purgeRes = await request(app.getHttpServer())
        .post('/admin/cache/purge')
        .set('x-admin-auth', 'mock-secret')
        .send({ scope: 'product', id: sample!.slug })
        .expect(200);

      expect(purgeRes.body.success).toBe(true);
      expect(purgeRes.body.scope).toBe('product');

      // 4. Product read must now be MISS!
      const missProd = await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      expect(missProd.headers['x-cache']).toBe('MISS');

      // 5. List read MUST STILL BE HIT! (Zero collateral damage)
      const listStillHit = await request(app.getHttpServer()).get('/products?page=1&limit=6').expect(200);
      expect(listStillHit.headers['x-cache']).toBe('HIT');
    });

    it('should invalidate all lists via O(1) listVer increment while preserving product detail cache', async () => {
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      // 1. Warm product detail
      await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      const hitProd = await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      expect(hitProd.headers['x-cache']).toBe('HIT');

      // 2. Warm catalog list
      await request(app.getHttpServer()).get('/products?page=1&limit=7').expect(200);
      const hitList = await request(app.getHttpServer()).get('/products?page=1&limit=7').expect(200);
      expect(hitList.headers['x-cache']).toBe('HIT');

      // 3. Purge lists scope
      const purgeRes = await request(app.getHttpServer())
        .post('/admin/cache/purge')
        .set('x-admin-auth', 'mock-secret')
        .send({ scope: 'lists' })
        .expect(200);

      expect(purgeRes.body.success).toBe(true);
      expect(purgeRes.body.scope).toBe('lists');
      expect(purgeRes.body.newVersion).toBeGreaterThan(0);

      // 4. Catalog list read must now be MISS!
      const missList = await request(app.getHttpServer()).get('/products?page=1&limit=7').expect(200);
      expect(missList.headers['x-cache']).toBe('MISS');

      // 5. Product detail read MUST STILL BE HIT!
      const prodStillHit = await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      expect(prodStillHit.headers['x-cache']).toBe('HIT');
    });

    it('should purge entire catalog cache via scope: all', async () => {
      const sample = await prisma.product.findFirst({ where: { status: 'ACTIVE' } });
      expect(sample).toBeDefined();

      // 1. Warm both
      await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      await request(app.getHttpServer()).get('/products?page=1&limit=9').expect(200);

      // Verify HITs
      const hitProd = await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      expect(hitProd.headers['x-cache']).toBe('HIT');
      const hitList = await request(app.getHttpServer()).get('/products?page=1&limit=9').expect(200);
      expect(hitList.headers['x-cache']).toBe('HIT');

      // 2. Purge ALL
      const purgeRes = await request(app.getHttpServer())
        .post('/admin/cache/purge')
        .set('x-admin-auth', 'mock-secret')
        .send({ scope: 'all' })
        .expect(200);

      expect(purgeRes.body.success).toBe(true);
      expect(purgeRes.body.scope).toBe('all');
      expect(purgeRes.body.unlinkedKeys).toBeGreaterThanOrEqual(1);

      // 3. Both must now be MISS!
      const missProd = await request(app.getHttpServer()).get(`/products/${sample!.slug}`).expect(200);
      expect(missProd.headers['x-cache']).toBe('MISS');
      const missList = await request(app.getHttpServer()).get('/products?page=1&limit=9').expect(200);
      expect(missList.headers['x-cache']).toBe('MISS');
    });
  });
});

