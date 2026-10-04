import React from 'react';
import type { Category, ProductQueryParams } from '../../api/client';
import { Search, RotateCcw, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface FilterSidebarProps {
  categories: Category[];
  params: ProductQueryParams;
  onParamChange: (newParams: Partial<ProductQueryParams>) => void;
  onReset: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  categories,
  params,
  onParamChange,
  onReset,
}) => {
  const currentCategory = params.category || '';
  const currentSort = params.sort || 'newest';
  const searchQuery = params.q || '';
  const minPrice = params.minPrice !== undefined ? params.minPrice : '';
  const maxPrice = params.maxPrice !== undefined ? params.maxPrice : '';

  const hasActiveFilters =
    Boolean(params.category) ||
    Boolean(params.q) ||
    params.minPrice !== undefined ||
    params.maxPrice !== undefined ||
    (params.sort && params.sort !== 'newest');

  return (
    <div className="bg-[#000000] border border-frost rounded-2xl p-5 shadow-ring space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-frost-soft">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#ff801f]" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
            Catalog Filters
          </h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-[#a1a4a5] hover:text-[#ff801f] transition-colors"
            title="Reset all filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="space-y-2">
        <label className="text-xs font-mono text-[#a1a4a5] uppercase tracking-wider block">
          Search Products
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a4a5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onParamChange({ q: e.target.value || undefined, page: 1 })}
            placeholder="Search keywords..."
            className="w-full bg-zinc-950 border border-frost rounded-lg pl-9 pr-3 py-2 text-sm text-[#f0f0f0] placeholder:text-[#a1a4a5]/40 focus:outline-none focus:border-[#ff801f] transition-colors"
          />
        </div>
      </div>

      {/* Sort Selector */}
      <div className="space-y-2">
        <label className="text-xs font-mono text-[#a1a4a5] uppercase tracking-wider block flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#ff801f]" />
          Sort Order
        </label>
        <select
          value={currentSort}
          onChange={(e) =>
            onParamChange({
              sort: e.target.value as 'newest' | 'price_asc' | 'price_desc',
              page: 1,
            })
          }
          className="w-full bg-zinc-950 border border-frost rounded-lg px-3 py-2 text-sm text-[#f0f0f0] focus:outline-none focus:border-[#ff801f] transition-colors"
        >
          <option value="newest">Newest Arrivals (Default)</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Categories */}
      <div className="space-y-2.5">
        <label className="text-xs font-mono text-[#a1a4a5] uppercase tracking-wider block">
          Categories
        </label>
        <div className="space-y-1">
          <button
            onClick={() => onParamChange({ category: undefined, page: 1 })}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
              currentCategory === ''
                ? 'bg-white text-black font-semibold'
                : 'text-[#a1a4a5] hover:text-white hover:bg-zinc-900/60'
            }`}
          >
            <span>All Categories</span>
          </button>
          {categories.map((cat) => {
            const isSelected = currentCategory === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => onParamChange({ category: cat.slug, page: 1 })}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#a1a4a5] hover:text-white hover:bg-zinc-900/60'
                }`}
              >
                <span>{cat.name}</span>
                {cat._count?.products !== undefined && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-black text-white' : 'bg-zinc-900 text-[#a1a4a5]'
                    }`}
                  >
                    {cat._count.products}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range Filter */}
      <div className="space-y-2.5 pt-2 border-t border-frost-soft">
        <label className="text-xs font-mono text-[#a1a4a5] uppercase tracking-wider block">
          Price Range ($)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] font-mono text-[#a1a4a5] mb-1 block">Min Price</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={minPrice}
              onChange={(e) =>
                onParamChange({
                  minPrice: e.target.value ? Number(e.target.value) : undefined,
                  page: 1,
                })
              }
              className="w-full bg-zinc-950 border border-frost rounded-lg px-2.5 py-1.5 text-xs text-[#f0f0f0] placeholder:text-[#a1a4a5]/40 focus:outline-none focus:border-[#ff801f]"
            />
          </div>
          <div>
            <span className="text-[10px] font-mono text-[#a1a4a5] mb-1 block">Max Price</span>
            <input
              type="number"
              min="0"
              placeholder="999"
              value={maxPrice}
              onChange={(e) =>
                onParamChange({
                  maxPrice: e.target.value ? Number(e.target.value) : undefined,
                  page: 1,
                })
              }
              className="w-full bg-zinc-950 border border-frost rounded-lg px-2.5 py-1.5 text-xs text-[#f0f0f0] placeholder:text-[#a1a4a5]/40 focus:outline-none focus:border-[#ff801f]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
