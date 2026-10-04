import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProductsQuery, useCategoriesQuery } from '../hooks/useProducts';
import { ProductCard } from '../components/catalog/ProductCard';
import { FilterSidebar } from '../components/catalog/FilterSidebar';
import { Pagination } from '../components/catalog/Pagination';
import type { ProductQueryParams } from '../api/client';
import { Sparkles, Layers, ArrowRight } from 'lucide-react';

export const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL search params
  const params: ProductQueryParams = useMemo(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '12', 10);
    const category = searchParams.get('category') || undefined;
    const q = searchParams.get('q') || undefined;
    const minPrice = searchParams.get('minPrice')
      ? parseFloat(searchParams.get('minPrice')!)
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? parseFloat(searchParams.get('maxPrice')!)
      : undefined;
    const sort = (searchParams.get('sort') as any) || 'newest';

    return { page, limit, category, q, minPrice, maxPrice, sort };
  }, [searchParams]);

  const { data: productsResponse, isLoading, isFetching } = useProductsQuery(params);
  const { data: categoriesResponse } = useCategoriesQuery();

  const handleParamChange = (newParams: Partial<ProductQueryParams>) => {
    const updated = new URLSearchParams(searchParams);

    Object.entries(newParams).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') {
        updated.delete(key);
      } else {
        updated.set(key, val.toString());
      }
    });

    setSearchParams(updated);
  };

  const handleResetFilters = () => {
    setSearchParams({});
  };

  const productsData = productsResponse?.data;
  const categories = categoriesResponse?.data || [];
  const cacheStatus = productsResponse?.headers.cacheStatus || 'UNKNOWN';
  const durationMs = productsResponse?.durationMs;

  return (
    <div className="space-y-12">
      {/* Editorial Cinematic Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-12 border-b border-frost">
        <div className="max-w-4xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#000000] border border-frost text-[#f0f0f0]">
            <Sparkles className="w-3.5 h-3.5 text-[#ff801f]" />
            <span>Dual-Layer Caching Architecture</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white font-normal tracking-tight leading-[1.05]">
            The Caching Laboratory.
          </h1>

          <p className="text-base sm:text-lg text-[#a1a4a5] max-w-[65ch] leading-relaxed">
            Experience real-world caching in action: from browser-side TanStack in-memory state, to HTTP 304 conditional transport, down to distributed Redis clusters and PostgreSQL.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#catalog-grid"
              className="px-6 py-2.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-ring inline-flex items-center gap-2"
            >
              <span>Explore Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="/benchmark"
              className="px-6 py-2.5 rounded-full text-sm font-semibold border border-frost bg-transparent text-white hover:bg-zinc-900 transition-colors inline-flex items-center gap-2"
            >
              <Layers className="w-4 h-4 text-[#ff801f]" />
              <span>Inspect Benchmarks</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section id="catalog-grid" className="scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Filter Sidebar */}
          <div className="lg:col-span-1">
            <FilterSidebar
              categories={categories}
              params={params}
              onParamChange={handleParamChange}
              onReset={handleResetFilters}
            />
          </div>

          {/* Right Column: Products Grid */}
          <div className="lg:col-span-3 space-y-6">
            {/* Top Grid Status Header */}
            <div className="flex items-center justify-between pb-3 border-b border-frost-soft">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-mono uppercase tracking-wider text-white">
                  Live Catalog Stream
                </h2>
                {isFetching && (
                  <span className="w-2 h-2 rounded-full bg-[#ff801f] animate-ping"></span>
                )}
              </div>

              {/* Cache Layer Resolution Indicator for Current List */}
              <div className="flex items-center gap-2 text-xs font-mono text-[#a1a4a5]">
                <span>List Cache Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    cacheStatus === 'HIT'
                      ? 'bg-[#11ff99]/10 text-[#11ff99] border border-[#11ff99]/30'
                      : cacheStatus === 'CLIENT_CACHE'
                      ? 'bg-[#3b9eff]/10 text-[#3b9eff] border border-[#3b9eff]/30'
                      : 'bg-[#ff2047]/10 text-[#ff2047] border border-[#ff2047]/30'
                  }`}
                >
                  {cacheStatus} ({durationMs || 0}ms)
                </span>
              </div>
            </div>

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="aspect-[4/3] bg-zinc-950/60 border border-frost rounded-2xl animate-pulse flex flex-col p-5 justify-end"
                  >
                    <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-zinc-900 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && productsData?.items?.length === 0 && (
              <div className="p-12 text-center border border-dashed border-frost rounded-2xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-zinc-900 mx-auto flex items-center justify-center text-[#ff801f]">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-display text-xl text-white">No products found</h3>
                <p className="text-sm text-[#a1a4a5] max-w-sm mx-auto">
                  No catalog items match your search or filter criteria. Try adjusting your price range or clearing filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Product Cards Grid */}
            {!isLoading && productsData && productsData.items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {productsData.items.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    cacheStatus={cacheStatus}
                    durationMs={durationMs}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {productsData && productsData.totalPages > 1 && (
              <Pagination
                currentPage={productsData.page}
                totalPages={productsData.totalPages}
                totalItems={productsData.total}
                onPageChange={(page) => handleParamChange({ page })}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
