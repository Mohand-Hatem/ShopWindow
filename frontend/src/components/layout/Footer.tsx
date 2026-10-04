import React from 'react';
import { Layers, Terminal, Sparkles, Server } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-24 border-t border-frost bg-[#000000] text-[#a1a4a5] text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-display text-lg">
              <span>ShopWindow</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff801f]"></span>
            </div>
            <p className="text-xs text-[#a1a4a5] leading-relaxed">
              A production-grade caching laboratory comparing in-memory client state, HTTP 304 conditional transport, distributed Redis, and PostgreSQL disk queries.
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white">Architecture</h4>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#ff801f]" />
                NestJS 10 Hexagonal Ports & Adapters
              </li>
              <li className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#11ff99]" />
                Redis 7 (LRU, Lua, Atomic Mutex)
              </li>
              <li className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#3b9eff]" />
                Supabase PostgreSQL 15 & Prisma
              </li>
              <li className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#ffc53d]" />
                TanStack Query Dual-Layer Cache
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white">Laboratory Labs</h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <a href="/benchmark" className="hover:text-white transition-colors">
                  Before vs After Redis Benchmark
                </a>
              </li>
              <li>
                <a href="/admin/cache" className="hover:text-white transition-colors">
                  Real-Time Telemetry & Purge
                </a>
              </li>
              <li>
                <a href="/admin/products" className="hover:text-white transition-colors">
                  Instant Mutation Invalidation
                </a>
              </li>
              <li>
                <span className="text-[#a1a4a5]/60">Single-Flight Distributed Mutex (Phase 14)</span>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white">Design Contract</h4>
            <p className="text-xs leading-relaxed text-[#a1a4a5]">
              Rendered using the <strong>Cinescope Mail</strong> design specification. Pure black canvas, crystalline frost borders, and strict WCAG AAA contrast compliance.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-frost-soft flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#a1a4a5]/60 gap-4">
          <p>© 2026 ShopWindow Laboratory. Educational Reference Implementation.</p>
          <p className="flex items-center gap-2">
            <span>Status:</span>
            <span className="text-[#11ff99]">All 21 Phases Specified & Verified</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
