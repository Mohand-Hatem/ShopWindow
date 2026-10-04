import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ApiResponse } from '../api/client';
import { CacheBadge } from '../components/telemetry/CacheBadge';
import {
  BookOpen,
  Layers,
  Zap,
  Database,
  Globe,
  Clock,
  Activity,
  ArrowRight,
  RefreshCw,
  Terminal,
  Sparkles,
} from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  // Live interactive sandbox probe state
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    target: string;
    status: number;
    cacheHeader: string;
    etag: string;
    cacheControl: string;
    durationMs: number;
    timestamp: string;
  } | null>(null);
  const [probeCount, setProbeCount] = useState(0);

  const runLiveProbe = async (path: string) => {
    setProbeLoading(true);
    const start = performance.now();
    try {
      let res: ApiResponse<any>;
      if (path === '/products') {
        res = await api.getProducts({ page: 1, limit: 5 });
      } else {
        res = await api.getProduct('zenith-pro-earbuds-521');
      }
      const durationMs = Math.round(performance.now() - start);
      setProbeResult({
        target: path,
        status: res.status || 200,
        cacheHeader: res.headers.cacheStatus || 'UNKNOWN',
        etag: res.headers.etag || 'None',
        cacheControl: res.headers.cacheControl || 'None',
        durationMs: res.durationMs || durationMs,
        timestamp: new Date().toLocaleTimeString(),
      });
      setProbeCount((c) => c + 1);
    } catch (e: any) {
      console.error(e);
    } finally {
      setProbeLoading(false);
    }
  };

  return (
    <div className="space-y-16 max-w-6xl mx-auto pb-24">
      {/* Hero Header */}
      <section className="space-y-6 pt-4 border-b border-frost pb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-zinc-950 border border-frost text-[#11ff99]">
          <BookOpen className="w-3.5 h-3.5 text-[#11ff99]" />
          <span>Interactive Onboarding & Architecture Reference Manual</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl text-white font-normal tracking-tight leading-tight">
          How the Caching Engine Works.
        </h1>

        <p className="text-base sm:text-lg text-[#a1a4a5] leading-relaxed max-w-4xl">
          ShopWindow is not just an e-commerce storefront—it is an empirical caching laboratory.
          This comprehensive reference manual walks you through the 4-layer caching architecture,
          explains real benchmark performance metrics, and gives you 7 hands-on testing scenarios
          to trigger and observe each cache state in real time.
        </p>

        {/* Quick Navigation Jump Anchors */}
        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href="#architecture"
            className="px-4 py-2 rounded-full text-xs font-mono border border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]/50 transition-colors"
          >
            1. The 4 Layers
          </a>
          <a
            href="#lifecycle"
            className="px-4 py-2 rounded-full text-xs font-mono border border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]/50 transition-colors"
          >
            2. Request Journey
          </a>
          <a
            href="#metrics"
            className="px-4 py-2 rounded-full text-xs font-mono border border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]/50 transition-colors"
          >
            3. Metrics Encyclopedia
          </a>
          <a
            href="#before-after"
            className="px-4 py-2 rounded-full text-xs font-mono border border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]/50 transition-colors"
          >
            4. Real Benchmark Evidence
          </a>
          <a
            href="#scenarios"
            className="px-4 py-2 rounded-full text-xs font-mono border border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]/50 transition-colors"
          >
            5. 7 Hands-On Scenarios
          </a>
          <a
            href="#live-sandbox"
            className="px-4 py-2 rounded-full text-xs font-mono bg-[#ff801f]/10 border border-[#ff801f]/40 text-[#ff801f] hover:bg-[#ff801f]/20 transition-colors"
          >
            6. Interactive Live Probe ⚡
          </a>
        </div>
      </section>

      {/* SECTION 1: The 4 Caching Layers */}
      <section id="architecture" className="space-y-8 scroll-mt-24">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white text-black font-mono font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-white">
              The 4 Architectural Layers
            </h2>
          </div>
          <p className="text-sm text-[#a1a4a5] leading-relaxed">
            Every customer request flows through a strict hierarchy of four caching checkpoints before reaching PostgreSQL disk storage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Layer 1 */}
          <div className="bg-[#000000] border border-frost rounded-2xl p-6 shadow-ring space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#3b9eff] font-semibold flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Layer 1
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#3b9eff]/10 border border-[#3b9eff]/30 text-[#3b9eff]">
                  0ms RAM
                </span>
              </div>
              <h3 className="font-display text-lg text-white">TanStack Browser Memory</h3>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                Lives inside the customer's browser memory via TanStack Query v5. Preserves query results for 30 seconds (<code className="text-white">staleTime: 30s</code>).
              </p>
            </div>
            <div className="pt-3 border-t border-frost-soft text-[11px] font-mono text-zinc-400 space-y-1">
              <div>Network Wire: <span className="text-[#11ff99]">0 bytes</span></div>
              <div>Latency: <span className="text-[#11ff99]">~0 ms</span></div>
              <div>Trigger: Back/forward or tab switch</div>
            </div>
          </div>

          {/* Layer 2 */}
          <div className="bg-[#000000] border border-frost rounded-2xl p-6 shadow-ring space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#11ff99] font-semibold flex items-center gap-1.5">
                  <Globe className="w-4 h-4" /> Layer 2
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#11ff99]/10 border border-[#11ff99]/30 text-[#11ff99]">
                  RFC 7232
                </span>
              </div>
              <h3 className="font-display text-lg text-white">HTTP ETag Transport</h3>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                When client cache expires, browser sends <code className="text-white">If-None-Match: W/"..."</code>. If data is unchanged, server returns <code className="text-[#11ff99]">304 Not Modified</code> with empty body.
              </p>
            </div>
            <div className="pt-3 border-t border-frost-soft text-[11px] font-mono text-zinc-400 space-y-1">
              <div>Payload Wire: <span className="text-[#11ff99]">0 payload bytes</span></div>
              <div>Header: <span className="text-white">ETag + Cache-Control</span></div>
              <div>Trigger: Re-fetch of unchanged data</div>
            </div>
          </div>

          {/* Layer 3 */}
          <div className="bg-[#000000] border border-frost rounded-2xl p-6 shadow-ring space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#ff801f] font-semibold flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Layer 3
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#ff801f]/10 border border-[#ff801f]/30 text-[#ff801f]">
                  2 - 5ms RAM
                </span>
              </div>
              <h3 className="font-display text-lg text-white">Redis 7 LRU Cache-Aside</h3>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                High-speed server RAM store. Uses Single-Flight Mutex locks to defeat Cache Stampedes, jittered TTLs to prevent expiration avalanches, and 30s negative sentinels.
              </p>
            </div>
            <div className="pt-3 border-t border-frost-soft text-[11px] font-mono text-zinc-400 space-y-1">
              <div>Storage: <span className="text-white">Redis 7 (allkeys-lru)</span></div>
              <div>Protection: <span className="text-[#ff801f]">Single-Flight Mutex</span></div>
              <div>Invalidation: <span className="text-[#11ff99]">O(1) listVer</span></div>
            </div>
          </div>

          {/* Layer 4 */}
          <div className="bg-[#000000] border border-frost rounded-2xl p-6 shadow-ring space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#a1a4a5] font-semibold flex items-center gap-1.5">
                  <Database className="w-4 h-4" /> Layer 4
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 border border-frost text-zinc-400">
                  Primary Truth
                </span>
              </div>
              <h3 className="font-display text-lg text-white">Supabase PostgreSQL</h3>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                Remote relational ACID database. Contains 520 seeded products across 8 categories with composite indexes. Queried strictly on cold misses or graceful bypasses.
              </p>
            </div>
            <div className="pt-3 border-t border-frost-soft text-[11px] font-mono text-zinc-400 space-y-1">
              <div>Latency: <span className="text-[#ff2047]">~3,500 - 4,000 ms</span></div>
              <div>Query Load: <span className="text-[#11ff99]">&gt; 90% eliminated</span></div>
              <div>Degradation: <span className="text-white">150ms fail-open</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: The Step-by-Step Request Lifecycle */}
      <section id="lifecycle" className="space-y-8 scroll-mt-24">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white text-black font-mono font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-white">
              The Step-by-Step Request Journey
            </h2>
          </div>
          <p className="text-sm text-[#a1a4a5] leading-relaxed">
            Follow what happens behind the scenes from the moment you click a product until the data appears on screen.
          </p>
        </div>

        {/* Ordered Steps Journey */}
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring flex flex-col md:flex-row gap-6 items-start">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-frost text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
              01
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-white">First Visit: The Cold Cache MISS</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-red-950/40 border border-red-500/30 text-[#ff2047]">
                  X-Cache: MISS
                </span>
              </div>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                When you navigate to <code className="text-white">/products/zenith-pro-earbuds-521</code> for the first time, your browser memory is empty. The request is dispatched over HTTP to NestJS.
              </p>
              <div className="p-3 bg-zinc-950 rounded-xl border border-frost-soft text-[11px] font-mono text-zinc-400 space-y-1">
                <div>1. NestJS checks Redis key: <code className="text-white">prod:detail:slug:zenith-pro-earbuds-521</code></div>
                <div>2. Redis returns <code className="text-[#ff2047]">null</code> (Key does not exist yet)</div>
                <div>3. Single-Flight Lock is acquired to prevent other concurrent requests from stampeding the DB</div>
                <div>4. NestJS issues SQL query to Supabase PostgreSQL over remote WAN (~3,500ms disk & transit)</div>
                <div>5. Data is returned, stored in Redis with jittered 300s TTL, and sent to client with header <code className="text-[#ff2047]">X-Cache: MISS</code></div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring flex flex-col md:flex-row gap-6 items-start">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-frost text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
              02
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-white">Second Visit: The High-Speed Cache HIT</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#11ff99]/10 border border-[#11ff99]/30 text-[#11ff99]">
                  X-Cache: HIT
                </span>
              </div>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                When you re-fetch or another user requests the same product, NestJS bypasses PostgreSQL completely.
              </p>
              <div className="p-3 bg-zinc-950 rounded-xl border border-frost-soft text-[11px] font-mono text-zinc-400 space-y-1">
                <div>1. NestJS checks Redis key: <code className="text-white">prod:detail:slug:zenith-pro-earbuds-521</code></div>
                <div>2. Redis returns cached JSON payload from RAM in <strong className="text-[#11ff99]">~2.8 ms</strong></div>
                <div>3. Database query count: <strong className="text-[#11ff99]">0 queries</strong> (PostgreSQL CPU load: 0%)</div>
                <div>4. Response returned immediately with header <code className="text-[#11ff99]">X-Cache: HIT</code></div>
                <div>5. Speedup: <strong className="text-[#11ff99]">137x faster</strong> than the initial cold request!</div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring flex flex-col md:flex-row gap-6 items-start">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-frost text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
              03
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-white">Subsequent Re-Fetch: HTTP 304 Validation</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#3b9eff]/10 border border-[#3b9eff]/30 text-[#3b9eff]">
                  HTTP 304 Not Modified
                </span>
              </div>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                When the browser already has the item but checks the server for updates via <code className="text-white">If-None-Match</code>:
              </p>
              <div className="p-3 bg-zinc-950 rounded-xl border border-frost-soft text-[11px] font-mono text-zinc-400 space-y-1">
                <div>1. Browser transmits tiny request header with entity tag: <code className="text-white">If-None-Match: W/"..."</code></div>
                <div>2. Server verifies ETag matches current cached hash</div>
                <div>3. Server returns <code className="text-[#3b9eff]">HTTP 304 Not Modified</code> with <strong className="text-[#11ff99]">0 payload bytes</strong></div>
                <div>4. Browser uses its local disk/memory cache. Saves 100% of egress bandwidth!</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Performance Metrics Encyclopedia */}
      <section id="metrics" className="space-y-8 scroll-mt-24">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white text-black font-mono font-bold text-xs flex items-center justify-center">
              3
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-white">
              Metrics Encyclopedia (How to Interpret Real Data)
            </h2>
          </div>
          <p className="text-sm text-[#a1a4a5] leading-relaxed">
            Every performance metric in ShopWindow explained in simple English, with why it matters and its actual project values.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Metric 1: Throughput */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#ff801f] uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> Throughput (RPS)
              </span>
              <span className="text-xs font-mono text-white font-bold">5.8 vs 850.7 req/s</span>
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-[#a1a4a5]">
              <p><strong className="text-white">What it means:</strong> Requests Per Second (RPS)—how many customer requests the server can complete in 1 second.</p>
              <p><strong className="text-white">Why it matters:</strong> If your throughput ceiling is 10 RPS, your 11th customer must wait in line. High throughput means your site stays fast during Black Friday.</p>
              <p><strong className="text-white">In this project:</strong> Uncached PostgreSQL bottlenecked at <code className="text-[#ff2047]">5.8 req/s</code>. With Redis, throughput jumped to <code className="text-[#11ff99]">850.7 req/s</code> (<strong className="text-[#11ff99]">+145.4x expansion</strong>).</p>
            </div>
          </div>

          {/* Metric 2: p50 Latency (Median) */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#11ff99] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> p50 Latency (Median)
              </span>
              <span className="text-xs font-mono text-white font-bold">3,844 ms vs 30 ms</span>
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-[#a1a4a5]">
              <p><strong className="text-white">What it means:</strong> The median latency. Exactly 50% of your users experienced a response faster than this number, and 50% experienced slower.</p>
              <p><strong className="text-white">Why it matters:</strong> Average latency is easily distorted by a few outliers. Median represents what the typical customer actually experiences.</p>
              <p><strong className="text-white">In this project:</strong> Dropped from <code className="text-[#ff2047]">3,844 ms</code> down to <code className="text-[#11ff99]">30 ms</code> (<strong className="text-[#11ff99]">-99.2% latency reduction</strong>).</p>
            </div>
          </div>

          {/* Metric 3: p90 Latency */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#ff801f] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> p90 Latency
              </span>
              <span className="text-xs font-mono text-white font-bold">4,881 ms vs 42 ms</span>
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-[#a1a4a5]">
              <p><strong className="text-white">What it means:</strong> 90% of all requests finished faster than this threshold. Only 10% took longer.</p>
              <p><strong className="text-white">Why it matters:</strong> Shows how performance behaves when the server starts to experience traffic pressure.</p>
              <p><strong className="text-white">In this project:</strong> Uncached p90 degraded to nearly 5 seconds (<code className="text-[#ff2047]">4,881 ms</code>). Cached p90 remained ultra-stable at <code className="text-[#11ff99]">42 ms</code>.</p>
            </div>
          </div>

          {/* Metric 4: p95 Latency (The Critical SLA) */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#ff2047] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> p95 Latency (Tail)
              </span>
              <span className="text-xs font-mono text-white font-bold">5,029 ms vs 51 ms</span>
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-[#a1a4a5]">
              <p><strong className="text-white">What it means:</strong> 95% of requests completed faster than this time. Represents the slowest 5% of users (the "tail").</p>
              <p><strong className="text-white">Why it matters:</strong> Standard enterprise Service Level Agreements (SLAs) are judged by p95. If p95 spikes, 1 in 20 customers experiences a freeze.</p>
              <p><strong className="text-white">In this project:</strong> Clamped from <code className="text-[#ff2047]">5,029 ms</code> down to <code className="text-[#11ff99]">51 ms</code> (<strong className="text-[#11ff99]">-99.0% reduction</strong>) thanks to Single-Flight mutex locks.</p>
            </div>
          </div>

          {/* Metric 5: p99 Latency (Worst-Case) */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> p99 Latency
              </span>
              <span className="text-xs font-mono text-white font-bold">5,085 ms vs 64 ms</span>
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-[#a1a4a5]">
              <p><strong className="text-white">What it means:</strong> 99% of requests finished faster. Only the single most unfortunate 1% of requests took longer.</p>
              <p><strong className="text-white">Why it matters:</strong> Reveals worst-case locks, thread contention, and garbage collection pauses.</p>
              <p><strong className="text-white">In this project:</strong> Capped at <code className="text-[#11ff99]">64 ms</code> under 25 concurrent connections with zero timeouts.</p>
            </div>
          </div>

          {/* Metric 6: Hit Ratio */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#11ff99] uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Hit Ratio (%)
              </span>
              <span className="text-xs font-mono text-white font-bold">0% vs &gt; 99%</span>
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-[#a1a4a5]">
              <p><strong className="text-white">What it means:</strong> <code className="text-white">Hits / (Hits + Misses)</code>—the percentage of total queries fulfilled from memory rather than disk.</p>
              <p><strong className="text-white">Why it matters:</strong> Every 1% increase in hit ratio exponentially decreases load on the database.</p>
              <p><strong className="text-white">In this project:</strong> Reaches <code className="text-[#11ff99]">&gt; 99%</code> in steady-state browsing, monitored live at <code className="text-white">GET /admin/cache/stats</code>.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Real Empirical Benchmark Evidence */}
      <section id="before-after" className="space-y-8 scroll-mt-24">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white text-black font-mono font-bold text-xs flex items-center justify-center">
              4
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-white">
              Real Benchmark Evidence: Cold Baseline vs Multi-Layer Cache
            </h2>
          </div>
          <p className="text-sm text-[#a1a4a5] leading-relaxed">
            These are the actual empirical numbers recorded in our comparative load testing harness (<code className="text-white">tests/load/baseline-result.json</code> and <code className="text-white">tests/load/cached-result.json</code>).
          </p>
        </div>

        <div className="bg-[#000000] border border-frost rounded-2xl overflow-hidden shadow-ring">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zinc-950 text-[#a1a4a5] uppercase tracking-wider border-b border-frost">
                <tr>
                  <th className="px-5 py-3.5">Metric Dimension</th>
                  <th className="px-5 py-3.5 text-[#ff2047]">State A: Baseline (PostgreSQL)</th>
                  <th className="px-5 py-3.5 text-[#11ff99]">State B: Multi-Layer Cache</th>
                  <th className="px-5 py-3.5 text-white">Real Measured Improvement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-frost-soft text-[#f0f0f0]">
                <tr className="hover:bg-zinc-950/60">
                  <td className="px-5 py-3.5 font-sans font-medium text-white">Throughput (Requests/sec)</td>
                  <td className="px-5 py-3.5 text-[#ff2047]">5.8 req/s</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-bold">850.7 req/s</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-semibold">+145.4x Throughput (+14,567%)</td>
                </tr>
                <tr className="hover:bg-zinc-950/60">
                  <td className="px-5 py-3.5 font-sans font-medium text-white">Median Latency (p50)</td>
                  <td className="px-5 py-3.5 text-[#ff2047]">3,844 ms</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-bold">30 ms</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-semibold">-99.2% Latency Reduction</td>
                </tr>
                <tr className="hover:bg-zinc-950/60">
                  <td className="px-5 py-3.5 font-sans font-medium text-white">Tail Latency (p95)</td>
                  <td className="px-5 py-3.5 text-[#ff2047]">5,029 ms</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-bold">51 ms</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-semibold">-99.0% Tail Clamped</td>
                </tr>
                <tr className="hover:bg-zinc-950/60">
                  <td className="px-5 py-3.5 font-sans font-medium text-white">99th Percentile (p99)</td>
                  <td className="px-5 py-3.5 text-[#ff2047]">5,085 ms</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-bold">64 ms</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-semibold">-98.7% Reduction</td>
                </tr>
                <tr className="hover:bg-zinc-950/60">
                  <td className="px-5 py-3.5 font-sans font-medium text-white">Requests Handled (20s)</td>
                  <td className="px-5 py-3.5 text-[#ff2047]">117 requests</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-bold">17,014 requests</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-semibold">+145.4x Volume Processed</td>
                </tr>
                <tr className="hover:bg-zinc-950/60">
                  <td className="px-5 py-3.5 font-sans font-medium text-white">HTTP 500 Server Errors</td>
                  <td className="px-5 py-3.5">0 (0.00%)</td>
                  <td className="px-5 py-3.5 text-[#11ff99]">0 (0.00%)</td>
                  <td className="px-5 py-3.5 text-[#11ff99]">100% Zero-Error Execution</td>
                </tr>
                <tr className="hover:bg-zinc-950/60">
                  <td className="px-5 py-3.5 font-sans font-medium text-white">Primary Database Query Load</td>
                  <td className="px-5 py-3.5 text-[#ff2047]">100% (Every request)</td>
                  <td className="px-5 py-3.5 text-[#11ff99] font-bold">&lt; 10%</td>
                  <td className="px-5 py-3.5 text-[#11ff99]">&gt; 90% Database Offload</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 5: 7 Hands-On Testing Scenarios */}
      <section id="scenarios" className="space-y-8 scroll-mt-24">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white text-black font-mono font-bold text-xs flex items-center justify-center">
              5
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-white">
              7 Hands-On Testing Scenarios
            </h2>
          </div>
          <p className="text-sm text-[#a1a4a5] leading-relaxed">
            Follow these concrete recipes on the website to trigger every cache invariant yourself.
          </p>
        </div>

        <div className="space-y-6">
          {/* Scenario 1 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-white font-bold">
                  Scenario 1
                </span>
                <h3 className="font-display text-lg text-white">Cold Cache Miss (First Lookups)</h3>
              </div>
              <span className="text-xs font-mono text-[#ff2047]">Target: X-Cache: MISS</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What to do</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Go to <Link to="/products" className="text-[#ff801f] underline">Catalog</Link> and enter a unique search filter (e.g. search for a random term or choose a new sort order).
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What you see</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  The initial response badge will show <span className="text-[#ff2047] font-bold">MISS</span> with latency between ~500ms - 3,500ms while PostgreSQL is queried.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">Why it happened</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Redis has no cached envelope for this parameter combination. The backend executes SQL on PostgreSQL and stores the serialized result in Redis.
                </p>
              </div>
            </div>
          </div>

          {/* Scenario 2 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-white font-bold">
                  Scenario 2
                </span>
                <h3 className="font-display text-lg text-white">Warm Cache Hit (Immediate Re-Visit)</h3>
              </div>
              <span className="text-xs font-mono text-[#11ff99]">Target: X-Cache: HIT</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What to do</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Open any product detail page, e.g. <Link to="/products/zenith-pro-earbuds-521" className="text-[#ff801f] underline">Zenith Pro Earbuds</Link>, and click <strong>"Re-Fetch Product (Test Caching)"</strong>.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What you see</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Cache status badge flips to <span className="text-[#11ff99] font-bold">HIT</span> and latency drops to <strong className="text-[#11ff99]">~2-5 ms</strong>.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">Why it happened</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  The key <code className="text-white">prod:detail:slug:...</code> is warm in Redis memory. NestJS returns the cached JSON in microseconds with 0 database queries.
                </p>
              </div>
            </div>
          </div>

          {/* Scenario 3 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-white font-bold">
                  Scenario 3
                </span>
                <h3 className="font-display text-lg text-white">HTTP 304 Validation (ETag Handshake)</h3>
              </div>
              <span className="text-xs font-mono text-[#3b9eff]">Target: HTTP 304 Not Modified</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What to do</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  On the Product Detail page, check Layer 2 of the Multi-Layer Inspector, or inspect DevTools Network tab on re-fetch.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What you see</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Look for <code className="text-[#3b9eff]">ETag: W/"..."</code> and notice response status is <strong className="text-[#3b9eff]">304 Not Modified</strong> with 0 payload bytes.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">Why it happened</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  RFC 7232 HTTP specification: the client proves it already possesses the exact data via <code className="text-white">If-None-Match</code>, so no bytes are re-transmitted.
                </p>
              </div>
            </div>
          </div>

          {/* Scenario 4 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-white font-bold">
                  Scenario 4
                </span>
                <h3 className="font-display text-lg text-white">TanStack Browser Memory (0ms Navigation)</h3>
              </div>
              <span className="text-xs font-mono text-[#3b9eff]">Target: Instantaneous UI</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What to do</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Navigate from <Link to="/products" className="text-[#ff801f] underline">Catalog</Link> to a product, then press your browser's <strong>Back</strong> button.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What you see</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  The catalog renders <strong className="text-[#11ff99]">instantaneously with zero loading spinners</strong> and zero network spinner flicker.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">Why it happened</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Layer 1 (TanStack Query v5) kept the query fresh in browser RAM (<code className="text-white">staleTime: 30s</code>), satisfying the view with 0 network calls.
                </p>
              </div>
            </div>
          </div>

          {/* Scenario 5 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-white font-bold">
                  Scenario 5
                </span>
                <h3 className="font-display text-lg text-white">Graceful Degradation / Redis Bypass</h3>
              </div>
              <span className="text-xs font-mono text-[#ffc53d]">Target: X-Cache: BYPASS</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What to do</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  In terminal, stop Redis: <code className="text-white">docker stop shopwindow-redis</code>, then refresh the catalog or run <code className="text-white">npm run test:simulation:chaos</code>.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What you see</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  The site stays 100% online! Header returns <span className="text-[#ffc53d] font-bold">X-Cache: BYPASS</span> with <strong className="text-[#11ff99]">0 HTTP 500 errors</strong>.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">Why it happened</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Phase 15 graceful degradation: a 150ms timeout prevents Redis from hanging the process. The API fails-open directly to PostgreSQL.
                </p>
              </div>
            </div>
          </div>

          {/* Scenario 6 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-white font-bold">
                  Scenario 6
                </span>
                <h3 className="font-display text-lg text-white">Active Invalidation & Scoped Cache Purge</h3>
              </div>
              <span className="text-xs font-mono text-[#ff801f]">Target: O(1) listVer Bump</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What to do</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Go to <Link to="/admin/cache" className="text-[#ff801f] underline">Admin Cache Console</Link> and click <strong>"Bump listVer (Purge Lists)"</strong>, or edit a product price in <Link to="/admin/products" className="text-[#ff801f] underline">Inventory</Link>.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What you see</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Return to <Link to="/products" className="text-white underline">Catalog</Link>. The very next catalog list query displays <span className="text-[#ff2047]">MISS</span> and rebuilds freshly.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">Why it happened</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Atomically incrementing <code className="text-white">prod:listVer</code> in O(1) time makes all previous list keys obsolete instantly without dangerous blocking <code className="text-[#ff2047]">KEYS *</code> scans.
                </p>
              </div>
            </div>
          </div>

          {/* Scenario 7 */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-frost text-white font-bold">
                  Scenario 7
                </span>
                <h3 className="font-display text-lg text-white">Comparative Benchmark Lab</h3>
              </div>
              <span className="text-xs font-mono text-[#11ff99]">Target: Empirical 145x Proof</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What to do</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Navigate to <Link to="/benchmark" className="text-[#ff801f] underline">Benchmark Lab</Link> to review Panel A vs Panel B side-by-side, or run <code className="text-white">npm run test:benchmark:comparative</code>.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">What you see</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Full comparative analytics comparing 5.8 req/s vs 850.7 req/s and latency percentile collapse from 3,844ms to 30ms.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1.5">
                <span className="text-white font-sans font-semibold block uppercase tracking-wider text-[10px]">Why it happened</span>
                <p className="text-[#a1a4a5] leading-relaxed">
                  Proves that when caching is architected with Single-Flight locks, jitter, and normalized keys, enterprise systems achieve 145x throughput safely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: Interactive Live Probe Sandbox */}
      <section id="live-sandbox" className="space-y-8 scroll-mt-24">
        <div className="p-8 rounded-3xl bg-[#000000] border-2 border-[#ff801f]/40 shadow-ring space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff801f]/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-frost pb-6">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[#ff801f] uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <Sparkles className="w-4 h-4" /> Live Interactive Probe Playground
              </span>
              <h3 className="font-display text-2xl text-white">
                Test the Live Backend from This Screen
              </h3>
              <p className="text-xs text-[#a1a4a5]">
                Dispatch real HTTP requests to the NestJS API right now and observe the response headers and cache transitions live.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => runLiveProbe('/products')}
                disabled={probeLoading}
                className="px-4 py-2.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-ring flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${probeLoading ? 'animate-spin' : ''}`} />
                <span>Probe Catalog List</span>
              </button>
              <button
                onClick={() => runLiveProbe('/products/zenith-pro-earbuds-521')}
                disabled={probeLoading}
                className="px-4 py-2.5 rounded-full text-xs font-semibold border border-frost bg-transparent text-white hover:bg-zinc-900 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${probeLoading ? 'animate-spin' : ''}`} />
                <span>Probe Product Detail</span>
              </button>
            </div>
          </div>

          {/* Probe Results Display */}
          {probeResult ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-[#a1a4a5]">
                <span>Telemetry Run #{probeCount} at {probeResult.timestamp}</span>
                <span>Endpoint: <code className="text-white">{probeResult.target}</code></span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#a1a4a5]">X-Cache Header</span>
                  <div>
                    <CacheBadge
                      status={probeResult.cacheHeader as any}
                      durationMs={probeResult.durationMs}
                    />
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#a1a4a5]">Round-Trip Time</span>
                  <div className="text-xl font-mono font-bold text-white">
                    {probeResult.durationMs} ms
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#a1a4a5]">HTTP Status</span>
                  <div className="text-xl font-mono font-bold text-[#11ff99]">
                    {probeResult.status} OK
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#a1a4a5]">ETag Tag</span>
                  <div className="text-xs font-mono text-zinc-300 truncate" title={probeResult.etag}>
                    {probeResult.etag.slice(0, 16)}...
                  </div>
                </div>
              </div>

              <div className="p-3 bg-zinc-950/80 rounded-xl border border-frost-soft text-[11px] font-mono text-zinc-400">
                <span className="text-white font-semibold">Diagnosis: </span>
                {probeResult.cacheHeader === 'HIT' && (
                  <span className="text-[#11ff99]">
                    Served directly from Redis RAM in {probeResult.durationMs}ms with 0 database queries! Subsequent re-fetches continue to hit memory.
                  </span>
                )}
                {probeResult.cacheHeader === 'MISS' && (
                  <span className="text-[#ff2047]">
                    Cache MISS. Data was queried from Supabase PostgreSQL and now saved in Redis. Click the probe button again to see it flip to HIT!
                  </span>
                )}
                {probeResult.cacheHeader === 'BYPASS' && (
                  <span className="text-[#ffc53d]">
                    Cache BYPASS. Redis is offline or timed out; request gracefully failed-open to PostgreSQL without throwing an HTTP 500.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <Terminal className="w-8 h-8 text-[#a1a4a5] mx-auto opacity-50" />
              <p className="text-xs font-mono text-[#a1a4a5]">
                Click either button above to trigger an active probe against the live server.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer Call-to-Action Links */}
      <section className="pt-8 border-t border-frost flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-display text-lg text-white">Ready to explore the live application?</h4>
          <p className="text-xs text-[#a1a4a5]">
            Browse products in the storefront or inspect real-time cluster telemetry in the Admin Console.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/products"
            viewTransition
            className="px-5 py-2.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-ring flex items-center gap-1.5"
          >
            <span>Open Storefront</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/admin/cache"
            viewTransition
            className="px-5 py-2.5 rounded-full text-xs font-semibold border border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]/50 transition-colors"
          >
            Admin Console
          </Link>
        </div>
      </section>
    </div>
  );
};
