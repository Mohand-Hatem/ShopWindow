/**
 * ShopWindow — Phase 13: Cache Stampede (Thundering Herd) Reproduction Harness
 *
 * This simulation reproduces and quantifies the classic "Cache Stampede":
 * 1. An in-demand hot product detail key expires or is evicted from Redis.
 * 2. 50 concurrent requests arrive simultaneously for that exact product.
 * 3. Without Single-Flight locking (distributed mutex), ALL 50 requests experience
 *    a Cache MISS and concurrently query PostgreSQL for the identical data.
 * 4. This harness captures response headers, latencies, and verifies database
 *    query multiplication against the /health telemetry counter.
 */

import * as path from 'path';
import * as fs from 'fs';

// Ensure backend node_modules is in module resolution path
const backendModules = path.resolve(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendModules)) {
  module.paths.push(backendModules);
}

const dotenv = require(path.resolve(backendModules, 'dotenv'));
const Redis = require(path.resolve(backendModules, 'ioredis'));

// Load environment variables from backend or root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10);

interface RequestResult {
  index: number;
  durationMs: number;
  status: number;
  cacheHeader: string;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function runStampedeSimulation() {
  console.log('================================================================');
  console.log('  SHOPWINDOW — PHASE 13: CACHE STAMPEDE (THUNDERING HERD) SIMULATION');
  console.log('================================================================');
  console.log(`Target URL:        ${TARGET_URL}`);
  console.log(`Redis:             ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`Concurrent Waves:  ${CONCURRENCY} simultaneous requests`);
  console.log('================================================================\n');

  // Step 1: Health check
  console.log('[Step 1/5] Verifying API and database connectivity...');
  const healthRes = await fetch(`${TARGET_URL}/health`);
  if (!healthRes.ok) {
    throw new Error(`API health check failed with status ${healthRes.status}`);
  }
  const healthData = await healthRes.json();
  console.log(`  -> API Status: ${healthData.status}, DB: ${healthData.database}, Redis: ${healthData.cache}\n`);

  // Step 2: Fetch an active product to test
  console.log('[Step 2/5] Selecting active target product...');
  const productsRes = await fetch(`${TARGET_URL}/products?limit=1`);
  if (!productsRes.ok) {
    throw new Error(`Failed to fetch catalog product: ${productsRes.status}`);
  }
  const productsData = await productsRes.json();
  if (!productsData.items || productsData.items.length === 0) {
    throw new Error('No active products found in the database. Seed the database first.');
  }
  const targetProduct = productsData.items[0];
  console.log(`  -> Selected Target: "${targetProduct.name}" (ID: ${targetProduct.id}, Slug: ${targetProduct.slug})\n`);

  // Step 3: Evict product from Redis & reset telemetry query counters
  console.log('[Step 3/5] Purging cache keys & resetting query telemetry...');
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();

  const slugKey = `prod:detail:slug:${targetProduct.slug}`;
  const idKey = `prod:detail:id:${targetProduct.id}`;
  const negSlugKey = `prod:detail:neg:${targetProduct.slug}`;
  const negIdKey = `prod:detail:neg:${targetProduct.id}`;

  await redis.del(slugKey, idKey, negSlugKey, negIdKey);

  const existsSlug = await redis.exists(slugKey);
  const existsId = await redis.exists(idKey);
  console.log(`  -> Cache purged: slugKey exists=${existsSlug}, idKey exists=${existsId}`);

  // Reset backend query counter
  await fetch(`${TARGET_URL}/health/reset-queries`, { method: 'POST' });
  const freshHealth = await (await fetch(`${TARGET_URL}/health`)).json();
  console.log(`  -> Telemetry counter reset: total=${freshHealth.queries?.total ?? 0}, productDetail=${freshHealth.queries?.productDetail ?? 0}\n`);

  // Step 4: Unleash the Thundering Herd (50 concurrent requests simultaneously)
  console.log(`[Step 4/5] UNLEASHING STAMPEDE: Firing ${CONCURRENCY} concurrent requests simultaneously...`);
  const startTime = Date.now();

  const tasks: Promise<RequestResult>[] = Array.from({ length: CONCURRENCY }, (_, i) => {
    return new Promise(async (resolve) => {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${TARGET_URL}/products/${targetProduct.slug}`, {
          headers: { 'Accept': 'application/json' },
        });
        const reqEnd = performance.now();
        const cacheHeader = res.headers.get('x-cache') || 'NONE';
        await res.text(); // consume body

        resolve({
          index: i + 1,
          durationMs: Math.round((reqEnd - reqStart) * 100) / 100,
          status: res.status,
          cacheHeader,
        });
      } catch (err: any) {
        const reqEnd = performance.now();
        resolve({
          index: i + 1,
          durationMs: Math.round((reqEnd - reqStart) * 100) / 100,
          status: 500,
          cacheHeader: 'ERROR',
        });
      }
    });
  });

  const results = await Promise.all(tasks);
  const totalDuration = Date.now() - startTime;
  console.log(`  -> All ${CONCURRENCY} requests finished in ${totalDuration}ms.\n`);

  // Step 5: Collect post-stampede telemetry
  console.log('[Step 5/5] Gathering post-stampede database telemetry & cache state...');
  const postHealth = await (await fetch(`${TARGET_URL}/health`)).json();
  const dbQueriesObserved = postHealth.queries?.productDetail ?? 0;
  const isNowCached = await redis.exists(slugKey);
  await redis.quit();

  // Metric computations
  const missCount = results.filter((r) => r.cacheHeader === 'MISS').length;
  const hitCount = results.filter((r) => r.cacheHeader === 'HIT').length;
  const successCount = results.filter((r) => r.status === 200).length;
  const errorCount = results.filter((r) => r.status >= 400).length;

  const latencies = results.map((r) => r.durationMs);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const avgLatency = Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100;
  const p50 = calculatePercentile(latencies, 50);
  const p75 = calculatePercentile(latencies, 75);
  const p90 = calculatePercentile(latencies, 90);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);

  console.log('================================================================');
  console.log('  STAMPEDE SIMULATION RESULTS & FAILURE MODE ANALYSIS');
  console.log('================================================================');
  console.log(`Concurrent HTTP Requests:    ${CONCURRENCY}`);
  console.log(`Successful Responses (200):  ${successCount}`);
  console.log(`Failed Responses (5xx/4xx):  ${errorCount}`);
  console.log(`Cache MISS Count (X-Cache):  ${missCount} (${((missCount / CONCURRENCY) * 100).toFixed(1)}%)`);
  console.log(`Cache HIT Count (X-Cache):   ${hitCount} (${((hitCount / CONCURRENCY) * 100).toFixed(1)}%)`);
  console.log('----------------------------------------------------------------');
  console.log(`Database Queries Executed:   ${dbQueriesObserved}`);
  console.log(`Optimal Queries Needed:      1 (The single-flight target)`);
  console.log(`Redundant DB Queries:        ${Math.max(0, dbQueriesObserved - 1)}`);
  console.log(`Multiplication Factor:       ${dbQueriesObserved}x database load spike`);
  console.log('----------------------------------------------------------------');
  console.log('Latency Distribution (ms):');
  console.log(`  Min Latency:               ${minLatency} ms`);
  console.log(`  Average Latency:           ${avgLatency} ms`);
  console.log(`  p50 (Median):              ${p50} ms`);
  console.log(`  p75:                       ${p75} ms`);
  console.log(`  p90:                       ${p90} ms`);
  console.log(`  p95:                       ${p95} ms`);
  console.log(`  p99:                       ${p99} ms`);
  console.log(`  Max Latency:               ${maxLatency} ms`);
  console.log(`Post-Stampede Redis Cached:  ${isNowCached === 1 ? 'YES' : 'NO'}`);
  console.log('================================================================\n');

  // Verify stampede reproduction
  if (missCount >= CONCURRENCY * 0.9 && dbQueriesObserved >= CONCURRENCY * 0.9) {
    console.log('💥 [CONFIRMED] THUNDERING HERD (CACHE STAMPEDE) REPRODUCED SUCCESSFULLY!');
    console.log(`   ${missCount} requests raced to query PostgreSQL simultaneously.`);
    console.log(`   This proves that without a Distributed Mutex (Single-Flight Lock),`);
    console.log(`   the database absorbs 100% of concurrent traffic on cold/expired keys.`);
  } else {
    console.log('⚠️ [NOTE] Stampede did not trigger 100% database misses.');
  }

  // Save detailed Markdown report
  const benchmarkDir = path.resolve(__dirname, '../../docs/benchmarks');
  if (!fs.existsSync(benchmarkDir)) {
    fs.mkdirSync(benchmarkDir, { recursive: true });
  }

  const reportPath = path.join(benchmarkDir, 'stampede-observed.md');
  const markdownReport = `# Phase 13 — Cache Stampede Observed Benchmark Report

**Date:** ${new Date().toISOString()}  
**Target Resource:** \`/products/${targetProduct.slug}\`  
**Database:** Supabase PostgreSQL (Remote Pooler)  
**Cache:** Redis 7 (Docker, \`allkeys-lru\`)  
**Concurrency Level:** ${CONCURRENCY} Simultaneous Requests  

---

## 1. Executive Summary

When a hot cache key expires or is evicted, incoming concurrent requests experience a race condition known as **The Cache Stampede (Thundering Herd)**.
Because no synchronization mechanism exists between concurrent worker threads or asynchronous request fibers, all **${CONCURRENCY}** requests simultaneously inspect the cache, observe a cache miss, and issue **${dbQueriesObserved} duplicate SQL queries** to PostgreSQL for the identical row.

---

## 2. Benchmark Metrics

| Metric | Measured Value | Optimal Target (Phase 14 Single-Flight) |
|---|---|---|
| **Concurrent Requests** | \`${CONCURRENCY}\` | \`${CONCURRENCY}\` |
| **HTTP 200 OK** | \`${successCount}\` | \`${CONCURRENCY}\` |
| **Cache MISS Count** | \`${missCount} (${((missCount / CONCURRENCY) * 100).toFixed(1)}%)\` | \`1 (2.0%)\` |
| **Cache HIT Count** | \`${hitCount} (${((hitCount / CONCURRENCY) * 100).toFixed(1)}%)\` | \`${CONCURRENCY - 1} (98.0%)\` |
| **Database Queries Executed** | **\`${dbQueriesObserved}\`** | **\`1\`** |
| **Redundant Queries** | **\`${Math.max(0, dbQueriesObserved - 1)}\`** | **\`0\`** |
| **Database Amplification** | **\`${dbQueriesObserved}x\`** | **\`1x\`** |

---

## 3. Latency Percentiles

| Percentile | Response Time (ms) |
|---|---|
| **Min** | ${minLatency} ms |
| **p50 (Median)** | ${p50} ms |
| **p75** | ${p75} ms |
| **p90** | ${p90} ms |
| **p95** | ${p95} ms |
| **p99** | ${p99} ms |
| **Max** | ${maxLatency} ms |
| **Mean / Average** | ${avgLatency} ms |

---

## 4. Root Cause Analysis

\`\`\`
Client 1 ───> Check Redis (MISS) ───> Query PostgreSQL ───────────────┐
Client 2 ───> Check Redis (MISS) ───> Query PostgreSQL ─────────────┐ │
Client 3 ───> Check Redis (MISS) ───> Query PostgreSQL ───────────┐ │ │
   ...                                                            │ │ │
Client 50 ──> Check Redis (MISS) ───> Query PostgreSQL ─────────┐ │ │ │
                                                                ▼ ▼ ▼ ▼
                                                      PostgreSQL Connection Pool
                                                      Exhaustion & CPU Spikes!
\`\`\`

1. **Window of Vulnerability:** The latency to query PostgreSQL over the network is ~${p50}ms.
2. **Race Condition:** During this ${p50}ms window, all ${CONCURRENCY} incoming requests check Redis and find nothing.
3. **Cascading Failure Risk:** In production under thousands of req/sec (e.g. flash sales), this causes pool exhaustion, high CPU utilization, and 504 Gateway Timeouts.

---

## 5. Next Step: Phase 14 Single-Flight Lock Pattern

Phase 14 introduces the **Single-Flight Lock (Distributed Mutex)** using Redis \`SET NX EX\` and an atomic Lua release script:
- Only **1 request (the winner)** acquires the lock and queries PostgreSQL.
- The remaining **${CONCURRENCY - 1} requests (followers)** wait and poll Redis for the populated value.
- Target metric: **${CONCURRENCY} requests $\\rightarrow$ EXACTLY 1 database query**.
`;

  fs.writeFileSync(reportPath, markdownReport, 'utf8');
  console.log(`Saved detailed benchmark report to: ${reportPath}`);
}

runStampedeSimulation().catch((err) => {
  console.error('\n❌ Simulation failed with error:', err);
  process.exit(1);
});
