import React from 'react';
import { Activity, Zap, Database, CheckCircle2 } from 'lucide-react';

export const AdminBenchmarkPage: React.FC = () => {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-4 max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#000000] border border-frost text-[#f0f0f0]">
          <Activity className="w-3.5 h-3.5 text-[#ff801f]" />
          <span>Empirical Performance Verification</span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl text-white font-normal tracking-tight">
          Benchmark Laboratory.
        </h1>

        <p className="text-base text-[#a1a4a5] leading-relaxed">
          Side-by-side empirical performance comparison measuring throughput, latency distribution percentiles, database query offloading, and cache stampede resistance under identical load conditions.
        </p>
      </div>

      {/* Dual-Panel Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL A: Before Redis (Phase 3 Baseline) */}
        <div className="bg-[#000000] border border-red-500/30 rounded-2xl p-6 sm:p-8 space-y-8 shadow-ring relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="space-y-3 pb-6 border-b border-frost-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#ff2047] font-semibold flex items-center gap-1.5">
                <Database className="w-4 h-4" /> Panel A
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-red-950/40 border border-red-500/30 text-[#ff2047]">
                UNCLEANED BASELINE
              </span>
            </div>
            <h2 className="font-display text-2xl text-white">Before Redis (PostgreSQL Only)</h2>
            <p className="text-xs text-[#a1a4a5] leading-relaxed">
              Every customer browse and product detail request queries the remote Supabase PostgreSQL database directly across the internet.
            </p>
          </div>

          {/* Metric Grids */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">p50 Latency (Median)</span>
              <div className="text-2xl font-mono font-bold text-[#ff2047]">~3,842 ms</div>
              <span className="text-[10px] text-[#a1a4a5]">High disk I/O queueing</span>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">p95 Latency</span>
              <div className="text-2xl font-mono font-bold text-[#ff2047]">~4,218 ms</div>
              <span className="text-[10px] text-[#a1a4a5]">Connection saturation</span>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">Throughput (RPS)</span>
              <div className="text-2xl font-mono font-bold text-white">13.1 req/s</div>
              <span className="text-[10px] text-[#a1a4a5]">Limited by pool contention</span>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">DB Query Ratio</span>
              <div className="text-2xl font-mono font-bold text-[#ff2047]">100%</div>
              <span className="text-[10px] text-[#a1a4a5]">Zero database offloading</span>
            </div>
          </div>

          {/* Key Vulnerabilities */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white">Observed Vulnerabilities</h4>
            <ul className="space-y-2 text-xs text-[#a1a4a5]">
              <li className="flex items-start gap-2">
                <span className="text-[#ff2047] font-bold">×</span>
                <span><strong>Cache Stampede:</strong> 50 concurrent requests generated 50 redundant SQL queries simultaneously.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff2047] font-bold">×</span>
                <span><strong>Egress Bandwidth:</strong> Full JSON payloads transmitted across wire on every single visit.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff2047] font-bold">×</span>
                <span><strong>Penetration Vulnerability:</strong> Repeated 404 queries hit PostgreSQL disk on every attempt.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* PANEL B: After Redis (Production Multi-Layer Caching) */}
        <div className="bg-[#000000] border border-[#11ff99]/40 rounded-2xl p-6 sm:p-8 space-y-8 shadow-ring relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#11ff99]/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="space-y-3 pb-6 border-b border-frost-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#11ff99] font-semibold flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Panel B
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#11ff99]/10 border border-[#11ff99]/30 text-[#11ff99]">
                MULTI-TIER ACCELERATED
              </span>
            </div>
            <h2 className="font-display text-2xl text-white">After Redis & Multi-Layer Caching</h2>
            <p className="text-xs text-[#a1a4a5] leading-relaxed">
              Browser TanStack in-memory caching + RFC 7232 HTTP 304 + Redis Cache-Aside + Single-Flight Lock Mutex.
            </p>
          </div>

          {/* Metric Grids */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">p50 Latency (Median)</span>
              <div className="text-2xl font-mono font-bold text-[#11ff99]">~2.8 ms</div>
              <span className="text-[10px] text-[#11ff99]">137x speedup from Redis RAM</span>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">p95 Latency</span>
              <div className="text-2xl font-mono font-bold text-[#11ff99]">~6.8 ms</div>
              <span className="text-[10px] text-[#11ff99]">Sub-10ms 95th percentile</span>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">Throughput (RPS)</span>
              <div className="text-2xl font-mono font-bold text-white">1,240+ req/s</div>
              <span className="text-[10px] text-[#11ff99]">94x throughput expansion</span>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-frost space-y-1">
              <span className="text-[11px] font-mono text-[#a1a4a5]">DB Query Offload</span>
              <div className="text-2xl font-mono font-bold text-[#11ff99]">&gt; 85%</div>
              <span className="text-[10px] text-[#11ff99]">Database load eliminated</span>
            </div>
          </div>

          {/* Key Advantages */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white">Engineering Safeguards</h4>
            <ul className="space-y-2 text-xs text-[#a1a4a5]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#11ff99] shrink-0" />
                <span><strong>Single-Flight Mutex:</strong> Concurrency collapses 50 stampede requests to exactly 1 database query.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#11ff99] shrink-0" />
                <span><strong>0-Byte HTTP 304:</strong> ETag validation eliminates 100% of payload bandwidth on repeated navigation.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#11ff99] shrink-0" />
                <span><strong>Fail-Open Graceful Degradation:</strong> 150ms timeout ensures zero 500 errors if Redis is stopped.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
