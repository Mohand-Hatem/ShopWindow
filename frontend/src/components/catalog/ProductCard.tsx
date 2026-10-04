import React from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../api/client';
import { CacheBadge } from '../telemetry/CacheBadge';
import { ArrowUpRight, PackageCheck, AlertCircle } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  cacheStatus?: 'HIT' | 'MISS' | 'BYPASS' | 'CLIENT_CACHE' | 'UNKNOWN';
  durationMs?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cacheStatus = 'UNKNOWN',
  durationMs,
}) => {
  // Generate consistent deterministic placeholder image seeded by product slug
  const imageUrl = `https://picsum.photos/seed/${product.slug}/600/400`;

  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock <= 0;

  return (
    <Link
      to={`/products/${product.slug}`}
      viewTransition
      className="group relative flex flex-col bg-[#000000] border border-frost rounded-2xl overflow-hidden shadow-ring hover:-translate-y-1 hover:border-[#ff801f]/40 transition-all duration-300"
    >
      {/* Top Media Container */}
      <div className="relative aspect-[4/3] bg-zinc-950 overflow-hidden">
        <img
          src={imageUrl}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
        />

        {/* Category Pill Tag */}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wider uppercase bg-[#000000]/80 backdrop-blur-md border border-frost text-[#f0f0f0]">
            {product.category?.name || 'General'}
          </span>
        </div>

        {/* Cache Telemetry Badge on Card */}
        <div className="absolute top-3 right-3">
          <CacheBadge status={cacheStatus} durationMs={durationMs} />
        </div>

        {/* Stock warning pill if applicable */}
        {isLowStock && (
          <div className="absolute bottom-3 left-3">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#ff801f]/20 border border-[#ff801f]/50 text-[#ff801f]">
              <AlertCircle className="w-3 h-3" /> Only {product.stock} left
            </span>
          </div>
        )}
      </div>

      {/* Body Information */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-sans font-medium text-base text-[#f0f0f0] group-hover:text-white transition-colors line-clamp-1">
              {product.name}
            </h3>
            <ArrowUpRight className="w-4 h-4 text-[#a1a4a5] group-hover:text-[#ff801f] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-0.5" />
          </div>

          <p className="mt-1 text-xs text-[#a1a4a5] line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Pricing and SKU row */}
        <div className="pt-3 border-t border-frost-soft flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-mono text-[#a1a4a5]">$</span>
            <span className="text-lg font-mono font-semibold text-white tracking-tight">
              {Number(product.price).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#a1a4a5]">
            {isOutOfStock ? (
              <span className="text-[#ff2047] font-medium">Out of stock</span>
            ) : (
              <>
                <PackageCheck className="w-3.5 h-3.5 text-[#11ff99]" />
                <span>In Stock ({product.stock})</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
