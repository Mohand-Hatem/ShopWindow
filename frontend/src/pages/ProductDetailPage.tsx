import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProductDetailQuery } from '../hooks/useProducts';
import { CacheBadge } from '../components/telemetry/CacheBadge';
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Layers,
  Zap,
  Database,
  Globe,
  ShieldAlert,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: response, isLoading, isError, error, refetch, isFetching } =
    useProductDetailQuery(slug);

  const [clientFetchCount, setClientFetchCount] = useState(1);

  const product = response?.data;
  const cacheStatus = response?.headers?.cacheStatus || 'UNKNOWN';
  const durationMs = response?.durationMs || 0;
  const etag = response?.headers?.etag;
  const cacheControl = response?.headers?.cacheControl;

  const handleTestClientBypass = async () => {
    setClientFetchCount((prev) => prev + 1);
    await refetch();
  };

  if (isLoading) {
    return (
      <div className="py-16 max-w-5xl mx-auto space-y-8 animate-pulse">
        <div className="h-6 w-32 bg-zinc-900 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="aspect-[4/3] bg-zinc-950 rounded-2xl border border-frost"></div>
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-zinc-900 rounded"></div>
            <div className="h-6 w-1/4 bg-zinc-800 rounded"></div>
            <div className="h-24 w-full bg-zinc-950 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-red-950/40 border border-red-500/30 text-[#ff2047] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-3xl text-white">Product Not Found</h2>
          <p className="text-sm text-[#a1a4a5]">
            {(error as any)?.message || `We could not locate any product matching "${slug}".`}
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-zinc-950 border border-frost text-[#a1a4a5]">
              Negative Cache Penetration Guard Active (Phase 11)
            </span>
          </div>
        </div>
        <div className="pt-4">
          <Link
            to="/products"
            viewTransition
            className="px-6 py-2.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Catalog</span>
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = `https://picsum.photos/seed/${product.slug}/800/600`;

  return (
    <div className="space-y-12">
      {/* Breadcrumb Back Link */}
      <div>
        <Link
          to="/products"
          viewTransition
          className="inline-flex items-center gap-2 text-xs font-mono text-[#a1a4a5] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      {/* Main Product Showcase Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        {/* Left Column: Visual Showcase */}
        <div className="space-y-4">
          <div className="relative aspect-[4/3] bg-zinc-950 border border-frost rounded-2xl overflow-hidden shadow-ring">
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 rounded-full text-xs font-mono tracking-wider uppercase bg-[#000000]/80 backdrop-blur-md border border-frost text-white">
                {product.category?.name}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#a1a4a5] px-1">
            <span>SKU: {product.sku}</span>
            <span>ID: {product.id.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Right Column: Information & Actions */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-[#ff801f]">
                {product.status}
              </span>
              <span className="text-zinc-700">·</span>
              <CacheBadge status={cacheStatus} durationMs={durationMs} />
            </div>

            <h1 className="font-display text-3xl sm:text-4xl text-white font-normal leading-tight">
              {product.name}
            </h1>
          </div>

          {/* Pricing Row */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono text-[#a1a4a5]">$</span>
            <span className="text-3xl font-mono font-semibold text-white tracking-tight">
              {Number(product.price).toFixed(2)}
            </span>
            <span className="text-xs font-mono text-[#a1a4a5] ml-1">{product.currency}</span>
          </div>

          {/* Description */}
          <div className="pt-4 border-t border-frost-soft space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-white">
              Description
            </h3>
            <p className="text-sm text-[#a1a4a5] leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Stock & Availability */}
          <div className="p-4 bg-zinc-950 border border-frost rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-[#11ff99]" />
              <span className="text-white">Inventory Status:</span>
              <span className="text-[#11ff99]">Available in Stock</span>
            </div>
            <span className="text-xs font-mono text-white font-bold">{product.stock} units</span>
          </div>

          {/* Interactive Re-fetch Button */}
          <div className="pt-2 flex items-center gap-4">
            <button
              onClick={handleTestClientBypass}
              disabled={isFetching}
              className="flex-1 px-6 py-3 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-ring flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Re-Fetch Product (Test Caching)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive 4-Layer Resolution Trace Inspector */}
      <section className="pt-8 border-t border-frost space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#ff801f]" />
            <h2 className="font-mono text-sm uppercase tracking-wider text-white font-bold">
              Multi-Layer Resolution Inspector
            </h2>
          </div>
          <span className="text-xs font-mono text-[#a1a4a5]">
            Telemetry Inspection Run #{clientFetchCount}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Layer 1: Client Memory Cache */}
          <div className="p-4 rounded-xl border border-frost bg-[#000000] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#3b9eff] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Layer 1
              </span>
              <span className="text-[10px] text-[#a1a4a5]">TanStack Query</span>
            </div>
            <h4 className="text-sm font-semibold text-white">Browser Memory</h4>
            <p className="text-xs text-[#a1a4a5]">
              Keeps responses fresh in browser RAM for 30s. Zero wire bytes.
            </p>
          </div>

          {/* Layer 2: HTTP Transport (ETag) */}
          <div className="p-4 rounded-xl border border-frost bg-[#000000] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#11ff99] flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" /> Layer 2
              </span>
              <span className="text-[10px] text-[#a1a4a5]">RFC 7232</span>
            </div>
            <h4 className="text-sm font-semibold text-white">HTTP 304 ETag</h4>
            <p className="text-xs text-[#a1a4a5] font-mono truncate" title={etag || 'None'}>
              Tag: {etag ? etag.slice(0, 18) + '...' : 'W/"none"'}
            </p>
            {cacheControl && (
              <p className="text-[10px] text-zinc-500 font-mono truncate" title={cacheControl}>
                {cacheControl}
              </p>
            )}
          </div>

          {/* Layer 3: Server Redis Cache-Aside */}
          <div className="p-4 rounded-xl border border-frost bg-[#000000] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#ff801f] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Layer 3
              </span>
              <span className="text-[10px] text-[#a1a4a5]">Redis Cluster</span>
            </div>
            <h4 className="text-sm font-semibold text-white">
              Status: <span className={cacheStatus === 'HIT' ? 'text-[#11ff99]' : 'text-[#ff2047]'}>{cacheStatus}</span>
            </h4>
            <p className="text-xs text-[#a1a4a5]">
              Server memory lookup. Hit latency ~2-4ms. Jittered 300s TTL.
            </p>
          </div>

          {/* Layer 4: PostgreSQL Database */}
          <div className="p-4 rounded-xl border border-frost bg-[#000000] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#a1a4a5] flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Layer 4
              </span>
              <span className="text-[10px] text-[#a1a4a5]">Source of Truth</span>
            </div>
            <h4 className="text-sm font-semibold text-white">Supabase SQL</h4>
            <p className="text-xs text-[#a1a4a5]">
              Primary disk store. Queried only when cache is cold or bypassed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
