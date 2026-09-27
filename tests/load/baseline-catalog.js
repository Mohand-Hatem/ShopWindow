/**
 * ShopWindow - Baseline Load Test (No Redis Cache)
 * Simulates realistic e-commerce traffic:
 * - 80% Catalog List queries (pagination, sorting)
 * - 20% Product Detail queries (slug lookups)
 *
 * Parameters:
 * - Concurrency: 25 connections
 * - Duration: 20 seconds
 * - Target: http://localhost:3000
 */

const fs = require('fs');
const path = require('path');

let autocannon;
try {
  autocannon = require('autocannon');
} catch (e) {
  autocannon = require(path.resolve(__dirname, '../../backend/node_modules/autocannon'));
}

const targetUrl = process.env.TARGET_URL || 'http://localhost:3000';
const duration = parseInt(process.env.DURATION || '20', 10);
const connections = parseInt(process.env.CONNECTIONS || '25', 10);

console.log('====================================================');
console.log('  SHOPWINDOW — BASELINE BENCHMARK (UNCACHED)');
console.log('====================================================');
console.log(`Target:      ${targetUrl}`);
console.log(`Connections: ${connections}`);
console.log(`Duration:    ${duration}s`);
console.log(`Traffic:     80% List / 20% Detail`);
console.log('====================================================\n');

// 8 list requests (80%) + 2 detail requests (20%) = exact 80/20 distribution
const requests = [
  // 80% List Requests (filtering, sorting, pagination)
  { method: 'GET', path: '/products?page=1&limit=20' },
  { method: 'GET', path: '/products?page=2&limit=20' },
  { method: 'GET', path: '/products?page=1&limit=10' },
  { method: 'GET', path: '/products?page=3&limit=20' },
  { method: 'GET', path: '/products?sortBy=price&sortOrder=asc&limit=20' },
  { method: 'GET', path: '/products?sortBy=createdAt&sortOrder=desc&limit=20' },
  { method: 'GET', path: '/products?page=1&limit=20' },
  { method: 'GET', path: '/products?page=2&limit=10' },

  // 20% Product Detail Requests (by slug)
  { method: 'GET', path: '/products/zenith-pro-earbuds-521' },
  { method: 'GET', path: '/products/zenith-pro-earbuds-401' },
];

async function runBenchmark() {
  console.log(`Running benchmark for ${duration}s against ${targetUrl}...`);

  const instance = autocannon({
    url: targetUrl,
    connections: connections,
    duration: duration,
    pipelining: 1,
    requests: requests,
  });

  autocannon.track(instance, { renderProgressBar: true });

  const result = await instance;

  console.log('\n====================================================');
  console.log('  AUTOCANNON REPORT');
  console.log('====================================================');
  console.log(autocannon.printResult(result));

  console.log('====================================================');
  console.log('  KEY METRICS SUMMARY');
  console.log('====================================================');
  console.log(`Duration:            ${result.duration}s`);
  console.log(`Connections:         ${result.connections}`);
  console.log(`Total Requests:      ${result['2xx'] + (result['non2xx'] || 0)}`);
  console.log(`2xx Responses:       ${result['2xx']}`);
  console.log(`Non-2xx Responses:   ${result['non2xx'] || 0}`);
  console.log(`Errors:              ${result.errors}`);
  console.log(`Timeouts:            ${result.timeouts}`);
  console.log(`RPS (Avg):           ${result.requests.average} req/sec`);
  console.log(`RPS (Max):           ${result.requests.max} req/sec`);
  console.log('----------------------------------------------------');
  console.log('Latency Percentiles (ms):');
  console.log(`  p50 (Median):      ${result.latency.p50} ms`);
  console.log(`  p75:               ${result.latency.p75} ms`);
  console.log(`  p90:               ${result.latency.p90} ms`);
  console.log(`  p97.5:             ${result.latency.p97_5} ms`);
  console.log(`  p99 (Tail):        ${result.latency.p99} ms`);
  console.log(`  Average:           ${result.latency.average} ms`);
  console.log(`  Min:               ${result.latency.min} ms`);
  console.log(`  Max:               ${result.latency.max} ms`);
  console.log('====================================================\n');

  // Save raw JSON results
  const resultOutputPath = path.join(__dirname, 'baseline-result.json');
  fs.writeFileSync(resultOutputPath, JSON.stringify(result, null, 2));
  console.log(`Saved raw results to: ${resultOutputPath}`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
