import React, { useState } from 'react';
import {
  useCacheStatsQuery,
  usePurgeCacheMutation,
  useResetCacheStatsMutation,
} from '../../hooks/useProducts';
import {
  Trash2,
  RotateCcw,
  Zap,
  Clock,
  Key,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  Shield,
} from 'lucide-react';

export const AdminCachePage: React.FC = () => {
  const [adminSecret, setAdminSecret] = useState(
    localStorage.getItem('sw_admin_secret') || 'mock-secret',
  );
  const [targetIdOrSlug, setTargetIdOrSlug] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: statsResponse, isLoading: statsLoading, refetch: refetchStats } =
    useCacheStatsQuery(adminSecret);

  const purgeMutation = usePurgeCacheMutation();
  const resetStatsMutation = useResetCacheStatsMutation();

  const stats = statsResponse?.data;

  const handleSaveSecret = (secret: string) => {
    setAdminSecret(secret);
    localStorage.setItem('sw_admin_secret', secret);
    refetchStats();
  };

  const handlePurge = async (scope: 'product' | 'lists' | 'all') => {
    setActionMessage(null);
    setErrorMessage(null);

    try {
      const res = await purgeMutation.mutateAsync({
        scope,
        id: scope === 'product' ? targetIdOrSlug : undefined,
        adminSecret,
      });

      setActionMessage(res.data.message);
      if (scope === 'product') setTargetIdOrSlug('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Purge operation failed');
    }
  };

  const handleResetStats = async () => {
    setActionMessage(null);
    setErrorMessage(null);

    try {
      const res = await resetStatsMutation.mutateAsync(adminSecret);
      setActionMessage(res.data.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Reset stats failed');
    }
  };

  return (
    <div className="space-y-12">
      {/* Header & Token Input */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-frost">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#000000] border border-frost text-[#f0f0f0]">
            <Shield className="w-3.5 h-3.5 text-[#ff801f]" />
            <span>Administrative Telemetry & Control</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-white font-normal">
            Cache Operations Console
          </h1>
          <p className="text-sm text-[#a1a4a5]">
            Real-time cluster telemetry, hit-ratio analysis, and production-safe scoped cache invalidation.
          </p>
        </div>

        {/* Admin Secret Token Config */}
        <div className="p-3 bg-zinc-950 border border-frost rounded-xl space-y-1.5 min-w-[280px]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#a1a4a5] flex items-center gap-1">
            <Key className="w-3 h-3 text-[#ff801f]" /> Admin Auth Secret
          </span>
          <input
            type="text"
            value={adminSecret}
            onChange={(e) => handleSaveSecret(e.target.value)}
            className="w-full bg-black border border-frost rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#ff801f]"
            placeholder="mock-secret"
          />
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Real-Time Telemetry Counters */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-white">
            Real-Time Metrics Overview (GET /admin/cache/stats)
          </h2>
          <button
            onClick={() => refetchStats()}
            disabled={statsLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border border-frost hover:border-[#ff801f]/50 text-[#a1a4a5] hover:text-white transition-colors"
          >
            <RotateCcw className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} />
            <span>{statsLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Hit Ratio Card */}
          <div className="p-5 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-2">
            <span className="text-[11px] font-mono text-[#a1a4a5] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#11ff99]" />
              Hit Ratio
            </span>
            <div className="text-3xl font-mono font-bold text-[#11ff99]">
              {stats?.hitRatio || '0.00%'}
            </div>
            <p className="text-[10px] text-[#a1a4a5] font-mono">
              Hits: {stats?.hits || 0} · Misses: {stats?.misses || 0}
            </p>
          </div>

          {/* Average Hit Latency */}
          <div className="p-5 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-2">
            <span className="text-[11px] font-mono text-[#a1a4a5] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#11ff99]" />
              Avg Hit Latency
            </span>
            <div className="text-3xl font-mono font-bold text-white">
              {stats?.avgHitLatencyMs !== undefined ? `${stats.avgHitLatencyMs} ms` : '—'}
            </div>
            <p className="text-[10px] text-[#a1a4a5] font-mono">Served from Redis RAM</p>
          </div>

          {/* Average Miss Latency */}
          <div className="p-5 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-2">
            <span className="text-[11px] font-mono text-[#a1a4a5] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#ff2047]" />
              Avg Miss Latency
            </span>
            <div className="text-3xl font-mono font-bold text-[#ff2047]">
              {stats?.avgMissLatencyMs !== undefined ? `${stats.avgMissLatencyMs} ms` : '—'}
            </div>
            <p className="text-[10px] text-[#a1a4a5] font-mono">PostgreSQL Disk Query</p>
          </div>

          {/* Estimated Redis Keys */}
          <div className="p-5 rounded-2xl bg-[#000000] border border-frost shadow-ring space-y-2">
            <span className="text-[11px] font-mono text-[#a1a4a5] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#3b9eff]" />
              Keys in Redis
            </span>
            <div className="text-3xl font-mono font-bold text-[#3b9eff]">
              {stats?.totalKeysEstimated || 0}
            </div>
            <p className="text-[10px] text-[#a1a4a5] font-mono">Via non-blocking DBSIZE</p>
          </div>
        </div>
      </section>

      {/* Scoped Purge Operations Controls */}
      <section className="pt-6 border-t border-frost space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-white">
            Scoped Cache Invalidation Operations (POST /admin/cache/purge)
          </h2>
          <button
            onClick={handleResetStats}
            disabled={resetStatsMutation.isPending}
            className="px-3 py-1.5 rounded-full text-xs font-mono border border-frost text-[#a1a4a5] hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Stats Baseline</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Operation 1: Surgical Product Purge */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#ff801f] uppercase tracking-wider block">
                Scope: Product
              </span>
              <h3 className="text-base font-semibold text-white">Surgical Item Eviction</h3>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                Purges a specific product by ID or slug without touching catalog list caches or other products.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Product ID or Slug (e.g. classic-tee)"
                value={targetIdOrSlug}
                onChange={(e) => setTargetIdOrSlug(e.target.value)}
                className="w-full bg-zinc-950 border border-frost rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#ff801f]"
              />
              <button
                onClick={() => handlePurge('product')}
                disabled={!targetIdOrSlug.trim() || purgeMutation.isPending}
                className="w-full px-4 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 disabled:opacity-40 transition-colors"
              >
                Purge Single Product
              </button>
            </div>
          </div>

          {/* Operation 2: List Invalidation via listVer */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#11ff99] uppercase tracking-wider block">
                Scope: Lists (O(1))
              </span>
              <h3 className="text-base font-semibold text-white">Invalidate All Lists</h3>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                Atomically bumps <code className="text-[#11ff99]">prod:listVer</code>. All cached paginated list collections are invalidated instantaneously with 0 keys scanned.
              </p>
            </div>

            <button
              onClick={() => handlePurge('lists')}
              disabled={purgeMutation.isPending}
              className="w-full px-4 py-2 rounded-full text-xs font-semibold border border-frost bg-transparent text-white hover:bg-zinc-900 transition-colors"
            >
              Bump listVer (Purge Lists)
            </button>
          </div>

          {/* Operation 3: Total Cache Purge */}
          <div className="p-6 rounded-2xl bg-[#000000] border border-frost shadow-ring flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#ff2047] uppercase tracking-wider block">
                Scope: All
              </span>
              <h3 className="text-base font-semibold text-white">Purge Entire Cache</h3>
              <p className="text-xs text-[#a1a4a5] leading-relaxed">
                Bumps version and reclaims memory using non-blocking Redis <code className="text-white">SCAN</code> and asynchronous background <code className="text-[#ff2047]">UNLINK</code>.
              </p>
            </div>

            <button
              onClick={() => handlePurge('all')}
              disabled={purgeMutation.isPending}
              className="w-full px-4 py-2 rounded-full text-xs font-semibold bg-[#ff2047] text-white hover:bg-[#ff2047]/80 transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge All Cache (UNLINK)</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
