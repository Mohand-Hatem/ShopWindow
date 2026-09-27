import { createHash } from 'crypto';
import { FindProductsQueryDto } from '../products/dto/find-products-query.dto';

export interface NormalizedProductQuery {
  page: number;
  limit: number;
  sort: 'newest' | 'price_asc' | 'price_desc';
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Normalizes query parameters by applying defaults, trimming whitespace,
 * lowercasing text, and eliminating redundant zero/empty filters.
 */
export function normalizeProductQuery(query: FindProductsQueryDto = {}): NormalizedProductQuery {
  const page = query.page && Number(query.page) > 1 ? Number(query.page) : 1;
  const limit = query.limit && Number(query.limit) > 0 ? Number(query.limit) : 20;
  const sort = query.sort && ['newest', 'price_asc', 'price_desc'].includes(query.sort)
    ? query.sort
    : 'newest';

  const normalized: NormalizedProductQuery = {
    page,
    limit,
    sort,
  };

  if (query.category) {
    const trimmedCat = query.category.trim().toLowerCase();
    if (trimmedCat.length > 0) {
      normalized.category = trimmedCat;
    }
  }

  if (query.q) {
    const sanitizedQ = query.q
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (sanitizedQ.length > 0) {
      normalized.q = sanitizedQ;
    }
  }

  if (query.minPrice !== undefined && query.minPrice !== null) {
    const min = Number(query.minPrice);
    if (!isNaN(min) && min > 0) {
      normalized.minPrice = Math.round(min * 100) / 100;
    }
  }

  if (query.maxPrice !== undefined && query.maxPrice !== null) {
    const max = Number(query.maxPrice);
    if (!isNaN(max) && max > 0) {
      normalized.maxPrice = Math.round(max * 100) / 100;
    }
  }

  return normalized;
}

/**
 * Builds a canonical, deterministic, versioned cache key for catalog listings:
 * 1. Embeds current list version (e.g. v=1, v=2) for O(1) mass invalidation.
 * 2. Normalizes parameters and removes non-operative defaults.
 * 3. Alphabetically sorts all key-value segments so URL parameter order is irrelevant.
 * 4. Hashes overly long query representations to prevent Redis key explosion.
 */
export function buildCanonicalListCacheKey(
  query: FindProductsQueryDto = {},
  listVer: number = 1,
): string {
  const norm = normalizeProductQuery(query);

  const kvPairs: Array<[string, string | number]> = [
    ['p', norm.page],
    ['lim', norm.limit],
    ['sort', norm.sort],
  ];

  if (norm.category) {
    kvPairs.push(['cat', norm.category]);
  }
  if (norm.q) {
    kvPairs.push(['q', norm.q]);
  }
  if (norm.minPrice !== undefined) {
    kvPairs.push(['min', norm.minPrice]);
  }
  if (norm.maxPrice !== undefined) {
    kvPairs.push(['max', norm.maxPrice]);
  }

  // Sort alphabetically by tag name for deterministic key invariance
  kvPairs.sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  const serialized = kvPairs.map(([k, v]) => `${k}=${v}`).join(':');

  // Prevent memory explosion if query text is long (e.g. long search string)
  if (serialized.length > 120) {
    const hash = createHash('sha256').update(serialized).digest('hex').substring(0, 24);
    return `prod:list:v=${listVer}:h:${hash}`;
  }

  return `prod:list:v=${listVer}:${serialized}`;
}
