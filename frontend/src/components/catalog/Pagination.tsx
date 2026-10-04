import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  // Compute displayed page numbers
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-frost">
      <div className="text-xs font-mono text-[#a1a4a5]">
        Showing page <strong className="text-white">{currentPage}</strong> of{' '}
        <strong className="text-white">{totalPages}</strong> ({totalItems} total products)
      </div>

      <div className="flex items-center gap-1.5">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-full text-xs font-medium border border-frost bg-transparent text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-900 transition-colors flex items-center gap-1"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>

        {/* Page buttons */}
        {start > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="w-8 h-8 rounded-full text-xs font-mono border border-frost hover:bg-zinc-900 text-[#a1a4a5]"
            >
              1
            </button>
            {start > 2 && <span className="text-[#a1a4a5] px-1 font-mono text-xs">...</span>}
          </>
        )}

        {pages.map((p) => {
          const isCurrent = p === currentPage;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-full text-xs font-mono transition-colors ${
                isCurrent
                  ? 'bg-white text-black font-bold shadow-ring'
                  : 'border border-frost text-[#a1a4a5] hover:text-white hover:bg-zinc-900'
              }`}
            >
              {p}
            </button>
          );
        })}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && (
              <span className="text-[#a1a4a5] px-1 font-mono text-xs">...</span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className="w-8 h-8 rounded-full text-xs font-mono border border-frost hover:bg-zinc-900 text-[#a1a4a5]"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded-full text-xs font-medium border border-frost bg-transparent text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-900 transition-colors flex items-center gap-1"
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
