export interface PhaseInfo {
  phase: number;
  title: string;
  tagline: string;
  category: 'Foundation' | 'Core Caching' | 'Advanced Invalidation' | 'Resilience & Telemetry' | 'Full-Stack Integration';
  whatWeBuilt: string;
  problemSolving: string;
  howItWorks: string[];
  whatWeLearned: {
    concept: string;
    explanation: string;
  };
  benefit: string;
  metrics?: {
    before?: string;
    after?: string;
    delta?: string;
  };
  nextConnection: string;
}

export const PHASES_DATA: PhaseInfo[] = [
  {
    phase: 1,
    title: 'Database & Domain Modeling',
    tagline: 'Relational schema, composite indexing, and 520 seeded products',
    category: 'Foundation',
    whatWeBuilt:
      'Prisma ORM schema defining User, Category, and Product entities with composite indexes (categoryId, status) and (status, updatedAt), PostgreSQL migration, and a deterministic seed script populating 520 active products across 8 categories.',
    problemSolving:
      'If a database has only 5 rows, queries execute in 0.5ms and caching is completely unnecessary. To observe real database query latency, disk I/O contention, sorting overhead, and connection saturation, we needed realistic data volume and proper relational indexing.',
    howItWorks: [
      '1. Declared Product model in schema.prisma with SKU, slug, name, price, stock, category relation, and status enum (ACTIVE / ARCHIVED).',
      '2. Created composite indexes: @@index([categoryId, status]) to optimize category filtering, and @@index([status, updatedAt]) for recency sorting.',
      '3. Executed prisma migrate dev to apply tables and constraints to cloud Supabase PostgreSQL.',
      '4. Ran prisma db seed to insert 8 categories and 520 products with realistic pricing ($19.99 to $899.99) and inventory counts.',
    ],
    whatWeLearned: {
      concept: 'Realistic Data Volume & Indexing in Caching',
      explanation:
        'Caching cannot be properly benchmarked on trivial toy datasets. Furthermore, caching does not replace good indexing—indexes ensure that cold cache misses execute as efficiently as possible without full table scans.',
    },
    benefit:
      'Established a production-grade relational database baseline with 520 products, giving subsequent phases measurable query times to optimize.',
    metrics: {
      before: '0 products (empty database)',
      after: '520 products across 8 categories',
      delta: 'Full catalog seed completed',
    },
    nextConnection:
      'With data stored in PostgreSQL, we needed an uncached HTTP REST API to expose products to customers before introducing caching.',
  },
  {
    phase: 2,
    title: 'Catalog REST API',
    tagline: 'Clean modular REST endpoints for catalog browsing and detail lookups',
    category: 'Foundation',
    whatWeBuilt:
      'NestJS catalog module with ProductsController and ProductsService implementing GET /products (multi-facet filtering, sorting, pagination) and GET /products/:idOrSlug (UUID or slug detail lookup).',
    problemSolving:
      'Before adding caching layers, the system needed a functional, uncached REST API where business logic and database queries were directly coupled, serving as our clean baseline.',
    howItWorks: [
      '1. GET /products accepts query parameters: page, limit, category, q (search), minPrice, maxPrice, and sort.',
      '2. Builds Prisma queries with where: { status: "ACTIVE" } and executes $transaction([findMany, count]) to return items and pagination metadata.',
      '3. GET /products/:idOrSlug detects UUID format via regex; if UUID matches it queries by id, otherwise queries by unique slug.',
      '4. Archived products return HTTP 404 Not Found to prevent ghost inventory from appearing in the storefront.',
    ],
    whatWeLearned: {
      concept: 'The Uncached Application Baseline',
      explanation:
        'A clean architectural separation between HTTP controllers, business services, and database repositories is required before caching can be introduced cleanly without creating tangled code.',
    },
    benefit:
      'Delivered fully functional, type-safe REST endpoints capable of filtering, sorting, and paginating 520 products.',
    metrics: {
      before: 'No HTTP interface',
      after: '4 REST endpoints (/health, /categories, /products, /products/:idOrSlug)',
      delta: 'Functional uncached catalog',
    },
    nextConnection:
      'Now that the API worked, we had to measure its performance under concurrent load to prove empirically how slow it was before caching.',
  },
  {
    phase: 3,
    title: 'Baseline Performance Benchmarking',
    tagline: 'Measuring cold uncached PostgreSQL performance under 25 concurrent connections',
    category: 'Foundation',
    whatWeBuilt:
      'Autocannon HTTP load testing harness (tests/load/baseline-catalog.js) executing an 80% browsing / 20% detail lookup traffic distribution under 25 concurrent connections for 20 seconds, exporting baseline-result.json.',
    problemSolving:
      'The first rule of performance engineering is: "You cannot improve what you do not measure." Without an objective baseline, any future claim that Redis made the app faster would be unscientific guesswork.',
    howItWorks: [
      '1. Autocannon sends 25 concurrent connections against http://localhost:3000.',
      '2. 80% of requests simulate browsing: /products with page, limit, sort, and category params.',
      '3. 20% of requests simulate detail lookups: /products/zenith-pro-earbuds-521.',
      '4. Captures round-trip times and records p50, p90, p95, p99, and RPS throughput.',
    ],
    whatWeLearned: {
      concept: 'Tail Latency & Connection Pool Contention',
      explanation:
        'Average latency is misleading. Under concurrency, requests queue up waiting for database connections. The slowest 5% of users (p95) experience severe multi-second delays because every request hits disk.',
    },
    benefit:
      'Established our permanent historical baseline: 5.8 req/sec throughput, 3,844 ms median p50 latency, and 5,029 ms p95 tail latency.',
    metrics: {
      before: 'Unmeasured performance',
      after: 'Throughput: 5.8 req/s | Median p50: 3,844 ms | p95: 5,029 ms',
      delta: 'Cold baseline documented',
    },
    nextConnection:
      'With the baseline proving the remote database was a massive bottleneck (~3.8s latency), we needed a clean architectural way to introduce Redis.',
  },
  {
    phase: 4,
    title: 'Cache Abstraction Layer (CachePort)',
    tagline: 'Hexagonal Architecture separating business logic from Redis storage',
    category: 'Core Caching',
    whatWeBuilt:
      'Hexagonal Ports & Adapters architecture: CachePort TypeScript interface and RedisCacheAdapter implementing get, set, del, exists, and ping wrapping ioredis, with in-memory fallback.',
    problemSolving:
      'Directly importing ioredis or Redis client types into business controllers creates tight coupling. If you change caching providers or write unit tests, your entire codebase breaks.',
    howItWorks: [
      '1. Defined CachePort abstract token with generic methods: get<T>(key), set(key, value, ttlSeconds), del(key), exists(key).',
      '2. Implemented RedisCacheAdapter using ioredis connecting to local Docker Redis 7 container on port 6379.',
      '3. Handled JSON serialization and deserialization transparently inside the adapter.',
      '4. Registered CachePort as a NestJS custom provider so services depend only on the interface.',
    ],
    whatWeLearned: {
      concept: 'Hexagonal Architecture & The Dependency Inversion Principle',
      explanation:
        'High-level business modules should not depend on low-level cache clients. Both should depend on abstractions. This allows mocking the cache in unit tests without needing a running Redis server.',
    },
    benefit:
      'Zero Redis dependencies leaked into business services; 100% testable caching layer with hot-swappable adapters.',
    metrics: {
      before: 'Direct coupling risk',
      after: 'Pure abstract CachePort interface',
      delta: 'Clean architecture achieved',
    },
    nextConnection:
      'With the CachePort abstraction ready, we could implement the first real caching pattern: the Cache-Aside pattern for individual product lookups.',
  },
  {
    phase: 5,
    title: 'Cache-Aside Pattern for Product Detail',
    tagline: 'Read-through caching for products with X-Cache: HIT / MISS telemetry headers',
    category: 'Core Caching',
    whatWeBuilt:
      'Cache-Aside (read-through) pattern in ProductsService.findBySlug with structured key naming prod:detail:slug:<slug>, returning X-Cache: HIT or MISS headers and X-Response-Time telemetry.',
    problemSolving:
      'Every product page visit previously generated a remote SQL query taking ~3,500ms. E-commerce shoppers revisit the same popular items repeatedly, making disk queries completely redundant.',
    howItWorks: [
      '1. Request arrives for GET /products/:slug.',
      '2. Service checks Redis key prod:detail:slug:<slug>.',
      '3. If found (Cache HIT): returns cached product JSON directly from RAM in ~2-4ms; attaches X-Cache: HIT.',
      '4. If not found (Cache MISS): queries Supabase PostgreSQL, writes product to Redis, and attaches X-Cache: MISS.',
    ],
    whatWeLearned: {
      concept: 'The Cache-Aside (Lazy Loading) Pattern',
      explanation:
        'The application code is responsible for checking the cache first and populating it only when a miss occurs. Data is loaded on demand, ensuring only frequently accessed items occupy memory.',
    },
    benefit:
      'Individual product lookups accelerated from ~3,500ms down to ~3-5ms—a 120x speedup for warm requests.',
    metrics: {
      before: 'First call: ~3,500ms (Postgres)',
      after: 'Second call: ~3ms (Redis HIT)',
      delta: '120x latency acceleration',
    },
    nextConnection:
      'Storing items in cache forever is dangerous because Redis will run out of memory and data will become permanently stale. We needed a TTL eviction policy.',
  },
  {
    phase: 6,
    title: 'Time-To-Live (TTL) Policy & Eviction',
    tagline: 'Bounded cache lifespans (PRODUCT_DETAIL_TTL = 300s) and LRU memory management',
    category: 'Core Caching',
    whatWeBuilt:
      'Formalized TTL constants (PRODUCT_DETAIL_TTL = 300 seconds), automated key expiration in RedisCacheAdapter.set(), and Docker container memory cap with allkeys-lru eviction policy.',
    problemSolving:
      'Without expiration, cached data consumes RAM indefinitely until Redis runs out of memory (OOM). Stale data remains in cache forever if the database changes out-of-band.',
    howItWorks: [
      '1. Every cache write specifies an explicit TTL in seconds: set(key, value, 300).',
      '2. Redis internal timer passively and actively expires keys after 300 seconds.',
      '3. If memory reaches the 256MB Docker container limit, Redis executes the allkeys-lru (Least Recently Used) algorithm, evicting the least accessed keys first.',
    ],
    whatWeLearned: {
      concept: 'TTL as a Safety Net & LRU Memory Bounds',
      explanation:
        'TTL is not a replacement for active invalidation—it is a safety net. It guarantees eventual consistency if an invalidation event fails, while LRU prevents memory exhaustion.',
    },
    benefit:
      'Zero memory leaks in Redis; guaranteed 5-minute maximum staleness window even if no invalidation occurs.',
    metrics: {
      before: 'Infinite lifespan risk',
      after: 'Strict 300s TTL + 256MB LRU memory cap',
      delta: 'Bounded memory footprint',
    },
    nextConnection:
      'Waiting 5 minutes for TTL to expire when an admin changes a price is unacceptable in e-commerce. We needed active cache invalidation on mutations.',
  },
  {
    phase: 7,
    title: 'Active Cache Invalidation on Mutations',
    tagline: 'Database-first commit with dual-key eviction (UUID + Slug) on updates and archives',
    category: 'Advanced Invalidation',
    whatWeBuilt:
      'AdminProductsService implementing active cache invalidation for PATCH /admin/products/:id and DELETE /admin/products/:id with dual-key eviction (prod:detail:id:<id> and prod:detail:slug:<slug>) and slug rename cascading.',
    problemSolving:
      'If a store owner updates a price from $100 to $80, customers should not see the old $100 price for 5 minutes. The cache must be invalidated immediately upon mutation.',
    howItWorks: [
      '1. Database-First Pattern: Mutate data in PostgreSQL first. If the SQL query fails, the cache is NOT touched.',
      '2. Read pre-mutation state to detect if the product slug was changed.',
      '3. Evict old slug key, new slug key, and UUID key simultaneously via Promise.all().',
      '4. If archived: evict cache keys so the product immediately returns 404 on the public storefront.',
    ],
    whatWeLearned: {
      concept: 'Dual-Key Eviction & The Database-First Principle',
      explanation:
        'When entities can be queried by multiple keys (ID or Slug), mutations must evict ALL corresponding keys. Always commit to the primary database BEFORE evicting cache to prevent race conditions.',
    },
    benefit:
      'Instantaneous price and stock synchronization across the storefront with 0 stale cache reads after mutation.',
    metrics: {
      before: 'Up to 300s delay to see price updates',
      after: '0s delay (instant eviction on mutation)',
      delta: 'Active cache consistency',
    },
    nextConnection:
      'We cached individual products, but 80% of e-commerce traffic is catalog browsing. We needed to solve the much harder problem of caching product lists.',
  },
  {
    phase: 8,
    title: 'Product List Caching (The Multi-Dimensional Problem)',
    tagline: 'Caching paginated, sorted, and filtered envelopes with PRODUCT_LIST_TTL = 120s',
    category: 'Advanced Invalidation',
    whatWeBuilt:
      'List caching envelope structure storing paginated product arrays and metadata in Redis with PRODUCT_LIST_TTL = 120s, accelerating catalog browsing by 200x.',
    problemSolving:
      'Listing queries involve complex multi-table SQL queries with WHERE clauses, ORDER BY, and LIMIT/OFFSET, consuming significant database CPU. Uncached catalog pages took ~1,500ms.',
    howItWorks: [
      '1. Client calls GET /products?page=1&limit=20&sortBy=price&sortOrder=asc.',
      '2. Service computes list cache key envelope.',
      '3. Checks Redis: on HIT, returns full pagination payload in ~5-7ms.',
      '4. On MISS: queries PostgreSQL $transaction([findMany, count]), caches envelope for 120s, and returns.',
    ],
    whatWeLearned: {
      concept: 'The Multi-Dimensional Caching Problem',
      explanation:
        'Caching lists is fundamentally harder than detail caching because a single product update could theoretically alter dozens of different filtered, sorted, and paginated pages.',
    },
    benefit:
      'Catalog browsing latency dropped from ~1,500ms to ~7ms (a 200x speedup).',
    metrics: {
      before: 'Uncached list: ~1,500 ms',
      after: 'Cached list: ~7 ms',
      delta: '200x list browsing speedup',
    },
    nextConnection:
      'List URLs can have permutations like ?sort=price&page=1 vs ?page=1&sort=price. Without normalization, these create duplicate cache keys and cache fragmentation.',
  },
  {
    phase: 9,
    title: 'Query Normalization & Stable Cache Keys',
    tagline: 'Deterministic key sorting, whitespace sanitization, and SHA-256 length bounding',
    category: 'Advanced Invalidation',
    whatWeBuilt:
      'QueryNormalizer utility that sorts query parameters alphabetically, strips default and undefined values, sanitizes whitespace, and hashes long keys with SHA-256.',
    problemSolving:
      'Different parameter orderings (page=1&limit=10 vs limit=10&page=1) produce different raw URLs. Without normalization, Redis stores identical data under multiple keys, reducing hit ratio and wasting RAM.',
    howItWorks: [
      '1. Ingests raw query params object: { limit: "10", page: "1", sort: "newest" }.',
      '2. Strips redundant default values (e.g. page=1, limit=10, sort=newest are defaults).',
      '3. Sorts remaining keys in strict alphabetical order: key1=val1:key2=val2.',
      '4. If normalized key exceeds 64 characters, hashes it to a fixed 64-char SHA-256 hex string.',
    ],
    whatWeLearned: {
      concept: 'Query Normalization & Key Entropy Control',
      explanation:
        'Cache keys must be deterministic. Semantically equivalent requests must always resolve to the exact same cache key, regardless of how query parameters were ordered in the URL.',
    },
    benefit:
      '100% cache hit sharing across permuted URLs; zero duplicate keys in Redis.',
    metrics: {
      before: 'Permuted URLs caused 100% cache MISS',
      after: 'Permuted URLs share identical cache HIT',
      delta: 'Eliminated cache fragmentation',
    },
    nextConnection:
      'When an admin adds or deletes a product, how do you invalidate all cached lists without running dangerous blocking KEYS * commands?',
  },
  {
    phase: 10,
    title: 'Version-Based List Invalidation (listVer)',
    tagline: 'O(1) instant mass list invalidation via atomic INCR prod:listVer',
    category: 'Advanced Invalidation',
    whatWeBuilt:
      'Version-based list key partitioning: embedding atomic integer prod:listVer into list cache keys (prod:list:v1:hash). Bumping listVer instantaneously invalidates all lists in O(1) time.',
    problemSolving:
      'Traditional cache invalidation uses Redis KEYS prod:list:* followed by DEL. In production databases with 100,000+ keys, KEYS * blocks the single-threaded Redis event loop for seconds, crashing the API.',
    howItWorks: [
      '1. Redis stores an atomic integer key: prod:listVer (e.g., 1).',
      '2. All list keys include the version: prod:list:v1:<sha256>.',
      '3. When an admin mutates any product, NestJS calls redis.incr("prod:listVer").',
      '4. listVer atomically increments from 1 to 2 in O(1) time (microsecond).',
      '5. Subsequent list requests query prod:list:v2:*. All v1 keys become instantly unreachable and are reclaimed automatically by TTL or LRU!',
    ],
    whatWeLearned: {
      concept: 'Atomic Versioning vs Blocking Key Scans',
      explanation:
        'Never scan keys in production Redis. By embedding a global version counter into keys, you achieve instant, zero-cost invalidation across millions of keys with a single INCR command.',
    },
    benefit:
      'Mass list invalidation executed in O(1) time (< 1ms) with zero keys scanned and zero event loop blocking.',
    metrics: {
      before: 'Dangerous KEYS * scan: O(N) blocking',
      after: 'INCR prod:listVer: O(1) non-blocking',
      delta: 'Instant zero-scan invalidation',
    },
    nextConnection:
      'What happens when an attacker requests a product that does not exist? Caching valid items is solved, but missing items create a vulnerability called Cache Penetration.',
  },
  {
    phase: 11,
    title: 'Negative Caching for 404s (Cache Penetration Guard)',
    tagline: '30-second negative sentinels protecting PostgreSQL from nonexistent ID attacks',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'Negative cache sentinel storage (prod:detail:neg:<target> = "__NULL__") with 30s TTL. Repeated 404 queries are served directly from Redis with 0 database lookups.',
    problemSolving:
      'If an attacker or bot script requests thousands of nonexistent products (/products/fake-id-1234), Redis returns MISS every time. All requests penetrate directly to PostgreSQL disk, causing connection exhaustion.',
    howItWorks: [
      '1. Request arrives for nonexistent product /products/missing-item.',
      '2. NestJS queries PostgreSQL: item does not exist (HTTP 404).',
      '3. NestJS writes sentinel key prod:detail:neg:missing-item = "__NULL__" with 30s TTL.',
      '4. Next request checks sentinel: returns 404 immediately from Redis without touching PostgreSQL.',
      '5. If an admin creates that product, the negative sentinel is actively deleted immediately.',
    ],
    whatWeLearned: {
      concept: 'Cache Penetration & Negative Caching',
      explanation:
        'Cache Penetration occurs when queries bypass the cache because the data does not exist in the database. Caching the nonexistence of data (with a short TTL) neutralizes this attack.',
    },
    benefit:
      'Database query volume for repeated 404s reduced from 100% to 0%; database CPU load completely protected.',
    metrics: {
      before: '100% of 404s hit PostgreSQL disk',
      after: '0% of repeated 404s hit PostgreSQL (served from Redis)',
      delta: 'Complete penetration protection',
    },
    nextConnection:
      'If 1,000 products are cached at the exact same moment with a 300s TTL, what happens 300 seconds later? They all expire together in a Cache Avalanche.',
  },
  {
    phase: 12,
    title: 'TTL Jitter (Preventing Expiration Avalanches)',
    tagline: 'Bounded ±10% entropy spreading key expirations across time',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'TtlPolicyService implementing bounded pseudo-random entropy: baseTtl ± (baseTtl * 0.10 * random). Product detail keys expire randomly between 270s and 330s.',
    problemSolving:
      'If hundreds of keys are cached simultaneously (e.g. after a marketing email blast), a static 300s TTL causes all keys to expire at the exact same second, flooding the database in a massive Cache Avalanche.',
    howItWorks: [
      '1. TtlPolicyService.getProductDetailTtl() calculates: 300 ± (300 * 0.10 * Math.random()).',
      '2. Returns a staggered integer strictly within the interval [270, 330] seconds.',
      '3. Verified via Monte Carlo simulation of 1,000 samples confirming uniform distribution.',
    ],
    whatWeLearned: {
      concept: 'Cache Avalanche & Entropy Smoothing',
      explanation:
        'Adding controlled statistical noise (jitter) to cache TTLs smooths out database query spikes over time, preventing mass simultaneous expirations.',
    },
    benefit:
      'Staggered key expiration curves eliminating synchronized database load spikes.',
    metrics: {
      before: 'Static 300s: 100% simultaneous expiration',
      after: 'Jittered [270s, 330s]: Staggered expiration',
      delta: 'Avalanche risk eliminated',
    },
    nextConnection:
      'Jitter protects against mass key expirations, but what happens when a single extremely popular hot key expires during peak traffic? This triggers the Thundering Herd.',
  },
  {
    phase: 13,
    title: 'Cache Stampede Simulation (The Thundering Herd)',
    tagline: 'Empirical reproduction proving 50 concurrent misses cause 50 redundant SQL queries',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'Concurrency test harness (tests/simulation/stampede-repro.ts) firing 50 simultaneous requests for an expired product, recording 50 redundant database queries against /health telemetry.',
    problemSolving:
      'When an in-demand product expires while hundreds of users are requesting it concurrently, every request encounters a Cache MISS at the same millisecond and all hammer the database simultaneously.',
    howItWorks: [
      '1. Deletes cached product key prod:detail:slug:zenith-pro-earbuds-521 from Redis.',
      '2. Fires Promise.all() dispatching 50 concurrent requests simultaneously.',
      '3. In uncached code, all 50 requests find Redis empty.',
      '4. All 50 requests execute identical SQL queries on PostgreSQL concurrently.',
      '5. Proves that without locking, caching fails during peak traffic.',
    ],
    whatWeLearned: {
      concept: 'The Cache Stampede (Thundering Herd) Vulnerability',
      explanation:
        'Under high concurrency, a cache miss does not result in 1 database query—it results in N concurrent queries where N is the number of simultaneous active users, risking database collapse.',
    },
    benefit:
      'Empirically reproduced and quantified the thundering herd failure mode as a permanent regression test.',
    metrics: {
      before: 'Unproven vulnerability',
      after: '50 concurrent requests = 50 redundant DB queries',
      delta: 'Vulnerability isolated & measured',
    },
    nextConnection:
      'Now that the stampede vulnerability was proven, we needed a distributed synchronization mechanism to collapse those 50 queries into exactly 1.',
  },
  {
    phase: 14,
    title: 'Single-Flight Lock Pattern (Distributed Mutex)',
    tagline: 'Redis SET NX EX + safe Lua unlock collapsing 50 stampede queries into 1 SQL lookup',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'SingleFlightLockService implementing a distributed mutex using Redis SET key uuid NX EX 5 and atomic Lua release script, with bounded follower polling retries.',
    problemSolving:
      'Collapsing concurrent cache misses for the same key so only ONE worker queries the database, while all other concurrent requests wait and read the cached result.',
    howItWorks: [
      '1. On cache miss, worker attempts to acquire lock: redis.set("lock:product:123", uuid, "NX", "EX", 5).',
      '2. If acquired (Leader): queries PostgreSQL, writes result to Redis, and unlocks via safe Lua script.',
      '3. If not acquired (Follower): sleeps for 50ms, then checks Redis for the result. Up to 4 retries.',
      '4. Safe Lua Release: if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end (prevents releasing someone else\'s lock).',
    ],
    whatWeLearned: {
      concept: 'Distributed Mutex & Single-Flight Coalescing',
      explanation:
        'A distributed lock collapses redundant concurrent executions. Using SET NX EX ensures atomic lock creation with a timeout, while Lua scripting ensures safe, token-verified lock releases.',
    },
    benefit:
      '50 concurrent stampede requests collapsed to exactly 1 database query—a 98% reduction in database load during cold misses.',
    metrics: {
      before: '50 concurrent requests = 50 database queries',
      after: '50 concurrent requests = 1 database query',
      delta: '98% database load reduction',
    },
    nextConnection:
      'What happens if the Redis server itself crashes, runs out of memory, or disconnects? Does your application crash with HTTP 500 errors?',
  },
  {
    phase: 15,
    title: 'Graceful Redis Degradation (X-Cache: BYPASS)',
    tagline: '150ms command timeout deadline and fail-open resilience returning zero 500 errors',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'Fail-open graceful degradation in RedisCacheAdapter with 150ms timeout deadline. If Redis is paused, stopped, or disconnected, the application bypasses cache to PostgreSQL with X-Cache: BYPASS.',
    problemSolving:
      'In fragile architectures, Redis is treated as a hard dependency. If Redis crashes, the entire website goes down with HTTP 500 errors. A cache should never kill your application.',
    howItWorks: [
      '1. All Redis commands are wrapped in Promise.race([command, timeout(150ms)]).',
      '2. If Redis fails or times out: catch block logs error, marks connection degraded, and returns null.',
      '3. Business logic detects null from cache and queries PostgreSQL directly.',
      '4. Attaches header X-Cache: BYPASS to inform telemetry that cache was bypassed.',
      '5. The application remains 100% functional with zero HTTP 500 crashes.',
    ],
    whatWeLearned: {
      concept: 'Fail-Open Architecture & Graceful Degradation',
      explanation:
        'A cache is an optimization, not a database. If the cache dies, the application must degrade gracefully to the primary source of truth rather than halting operations.',
    },
    benefit:
      '100% availability during total Redis container stoppage; exactly 0 HTTP 500 errors during infrastructure failure.',
    metrics: {
      before: 'Redis crash = HTTP 500 application outage',
      after: 'Redis crash = HTTP 200 with X-Cache: BYPASS',
      delta: '100% uptime resilience achieved',
    },
    nextConnection:
      'Even with Redis responding in 2ms, network transport bandwidth over the internet takes time and money. We needed HTTP-level caching.',
  },
  {
    phase: 16,
    title: 'HTTP Caching (RFC 7232 ETag & 304 Not Modified)',
    tagline: '0-byte payload conditional requests saving 100% of wire bandwidth',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'HttpCacheInterceptor generating cryptographic ETags (W/"<hash>") and Cache-Control: public, max-age=60, stale-while-revalidate=30. Responds with 0-byte HTTP 304 Not Modified when If-None-Match matches.',
    problemSolving:
      'Transmitting full JSON payloads over the network when the data hasn\'t changed wastes mobile data, server egress bandwidth, and CPU serialization time.',
    howItWorks: [
      '1. Server hashes response body into weak ETag: W/"9f3a...".',
      '2. Attaches headers: ETag and Cache-Control: public, max-age=60.',
      '3. On re-fetch, browser sends request header: If-None-Match: W/"9f3a...".',
      '4. Interceptor compares incoming header with current content hash.',
      '5. If identical: returns HTTP 304 Not Modified with empty body (0 payload bytes transferred).',
    ],
    whatWeLearned: {
      concept: 'RFC 7232 HTTP Conditional Validation',
      explanation:
        'The fastest request is the one that sends no payload. HTTP 304 Not Modified allows the client to validate freshness with a tiny header check, eliminating 100% of payload transfer.',
    },
    benefit:
      'Eliminated 100% of payload bandwidth on repeated customer visits; sub-1ms response times from edge caches.',
    metrics: {
      before: 'Full JSON payload on every request (~15-50 KB)',
      after: '0 payload bytes on 304 Not Modified',
      delta: '100% payload bandwidth saved',
    },
    nextConnection:
      'How do engineering teams observe hit ratios and latency disparities in production? We needed real-time telemetry counters.',
  },
  {
    phase: 17,
    title: 'Cache Telemetry & Real-Time Metrics',
    tagline: 'Redis atomic counters, hit ratio calculation, and secured GET /admin/cache/stats',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'CacheMetricsService and CacheMetricsInterceptor tracking hits, misses, bypasses, and cumulative hit latency via atomic Redis INCR counters, exposed via secured GET /admin/cache/stats.',
    problemSolving:
      'Without production observability, engineers cannot determine if their cache is effective, whether hit ratio is degrading, or if memory is being utilized efficiently.',
    howItWorks: [
      '1. Interceptor observes X-Cache header on every outgoing response.',
      '2. If HIT: redis.incr("catalog:v1:stats:hits") and redis.incrbyfloat("stats:latency", durationMs).',
      '3. If MISS: redis.incr("catalog:v1:stats:misses"). If BYPASS: redis.incr("catalog:v1:stats:bypasses").',
      '4. GET /admin/cache/stats computes hitRatio: hits / (hits + misses) * 100 and averageHitLatencyMs.',
      '5. Secured with MockAdminGuard checking header x-admin-auth: mock-secret.',
    ],
    whatWeLearned: {
      concept: 'Atomic Telemetry & In-Memory Observability',
      explanation:
        'Telemetry counters must be atomic (O(1)) and non-blocking. Tracking metrics directly in Redis allows distributed nodes to aggregate cluster statistics without a separate metrics database.',
    },
    benefit:
      'Live visibility into hit ratios (> 99%), average latency (2.8ms), and cluster health accessible in real time.',
    metrics: {
      before: 'Zero telemetry visibility',
      after: 'Live hit ratio (0-100%) and latency metrics in Redis',
      delta: 'Production observability established',
    },
    nextConnection:
      'When operations emergencies happen, administrators need the ability to safely purge the cache without taking the database down.',
  },
  {
    phase: 18,
    title: 'Admin Cache Operations (Purge & Stats)',
    tagline: 'Scoped surgical eviction, O(1) list purge, and non-blocking SCAN + UNLINK',
    category: 'Resilience & Telemetry',
    whatWeBuilt:
      'POST /admin/cache/purge supporting three scopes (product, lists, all) utilizing non-blocking cursor SCAN (COUNT 100) and background UNLINK to reclaim memory safely.',
    problemSolving:
      'Junior developers often run FLUSHALL or KEYS * when a cache purge is needed. In production with millions of keys, this freezes the single-threaded Redis event loop, causing widespread timeouts.',
    howItWorks: [
      '1. Scope product: surgically evicts single UUID and slug keys + negative sentinels. Zero collateral damage.',
      '2. Scope lists: calls bumpListVersion() in O(1) time. All cached lists become obsolete with 0 keys scanned.',
      '3. Scope all: bumps listVer and iterates keys via non-blocking SCAN with COUNT 100.',
      '4. Uses UNLINK instead of DEL: memory deallocation is offloaded to a background thread without pausing the event loop.',
    ],
    whatWeLearned: {
      concept: 'Non-Blocking Memory Management (SCAN vs KEYS, UNLINK vs DEL)',
      explanation:
        'Synchronous DEL and KEYS block Redis. Cursor-based SCAN processes keys incrementally, while UNLINK reclaims memory asynchronously in background worker threads.',
    },
    benefit:
      'Production-safe cache purging that never blocks the Redis event loop or causes client timeouts.',
    metrics: {
      before: 'Dangerous FLUSHALL / KEYS * blocking risks',
      after: 'Safe scoped purges with SCAN + UNLINK',
      delta: 'Zero-downtime cache operations',
    },
    nextConnection:
      'With the backend caching engine fully hardened, we needed a modern frontend to visualize the 4-layer resolution trace and benchmark data.',
  },
  {
    phase: 19,
    title: 'Modern Storefront UI with TanStack Query',
    tagline: 'Cinescope Mail design system, deep URL search params, and 4-layer trace inspector',
    category: 'Full-Stack Integration',
    whatWeBuilt:
      'React 19 + Vite + TailwindCSS v4 storefront adhering to Cinescope Mail design tokens (#000000 void, frost borders, 9999px pills, Fraunces serif headings), deep URL state sync, 4-layer resolution trace inspector, and Admin Cache Console.',
    problemSolving:
      'Developers cannot easily understand multi-layer caching without seeing the client, transport, and server layers interact visually in real time.',
    howItWorks: [
      '1. TanStack Query v5 manages browser memory cache with staleTime: 30s.',
      '2. API client extracts headers: X-Cache, ETag, Cache-Control, and round-trip duration.',
      '3. ProductCard displays live micro-badges (HIT in electric mint, MISS in crimson).',
      '4. Product Detail view includes interactive 4-Layer Resolution Trace Inspector showing which layer fulfilled the request.',
      '5. Admin Cache Console provides live cluster metrics and one-click scoped purges.',
    ],
    whatWeLearned: {
      concept: 'Client-Server Cache Symmetry & Telemetry UI',
      explanation:
        'Coordinating browser memory (TanStack Query) with HTTP headers (ETag) and server cache (Redis) creates instant UI transitions while drastically reducing network traffic.',
    },
    benefit:
      'A beautiful, dark-mode, production-grade interface providing visual proof of every caching mechanism.',
    metrics: {
      before: 'Raw curl terminal outputs only',
      after: 'Interactive UI with live cache badges & 4-layer inspector',
      delta: 'Full visual observability',
    },
    nextConnection:
      'The final step of the entire curriculum: running the definitive comparative benchmark across all states to generate our architectural post-mortem.',
  },
  {
    phase: 20,
    title: 'Final Comparative Integration Benchmark & Post-Mortem',
    tagline: 'State A vs State B vs State C empirical load proof: +145x throughput, -99% latency reduction',
    category: 'Full-Stack Integration',
    whatWeBuilt:
      'Automated comparative benchmark runner (tests/simulation/comparative-benchmark.ts), final benchmark post-mortem report (docs/benchmarks/final-comparison.md), and developer verification guide (docs/VERIFICATION_GUIDE.md).',
    problemSolving:
      'Closing the engineering loop by testing the entire system under identical 25-connection concurrency across three states: Baseline vs Production Cached vs Degraded Fallback.',
    howItWorks: [
      '1. State A (Baseline): Autocannon runs cold uncached PostgreSQL (5.8 req/s, 3,844 ms p50).',
      '2. State B (Cached): Autocannon runs full production cache (850.7 req/s, 30 ms p50, 17,014 requests handled).',
      '3. State C (Degraded): Stops Redis container; verifies 100% fail-open bypass with zero HTTP 500 errors.',
      '4. Computes exact statistical speedup multiples and exports final comparison matrix.',
    ],
    whatWeLearned: {
      concept: 'Empirical Verification & High-Availability Validation',
      explanation:
        'True architectural mastery requires proof. By benchmarking baseline, cached, and degraded failure states under identical load, we prove both performance optimization and system resilience.',
    },
    benefit:
      'Definitive mathematical proof of 145x throughput expansion, 99.2% latency reduction, and zero downtime in chaos mode.',
    metrics: {
      before: 'Baseline: 5.8 req/s | 3,844 ms p50 | 117 reqs',
      after: 'Cached: 850.7 req/s | 30 ms p50 | 17,014 reqs',
      delta: '+145.4x Throughput | -99.2% Latency | 0 Errors',
    },
    nextConnection:
      'The 21-phase ShopWindow caching curriculum is 100% complete! The codebase stands as a production-grade educational reference manual for high-performance distributed caching.',
  },
];
