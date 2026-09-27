import { normalizeProductQuery, buildCanonicalListCacheKey } from './query-normalizer';

describe('Query Normalizer & Canonical Cache Key Generator (Unit Tests)', () => {
  describe('normalizeProductQuery()', () => {
    it('should assign standard defaults when query is empty', () => {
      const normalized = normalizeProductQuery({});
      expect(normalized).toEqual({
        page: 1,
        limit: 20,
        sort: 'newest',
      });
    });

    it('should sanitize, trim, lowercase, and collapse whitespace in search queries', () => {
      const normalized = normalizeProductQuery({
        q: '   Pro   GAMING    Headset   ',
      });
      expect(normalized.q).toBe('pro gaming headset');
    });

    it('should ignore non-operative minPrice <= 0', () => {
      const norm1 = normalizeProductQuery({ minPrice: 0 });
      const norm2 = normalizeProductQuery({ minPrice: -50 });
      expect(norm1.minPrice).toBeUndefined();
      expect(norm2.minPrice).toBeUndefined();
    });

    it('should round prices to two decimal places', () => {
      const normalized = normalizeProductQuery({
        minPrice: 19.999,
        maxPrice: 99.441,
      });
      expect(normalized.minPrice).toBe(20.0);
      expect(normalized.maxPrice).toBe(99.44);
    });
  });

  describe('buildCanonicalListCacheKey()', () => {
    it('should partition cache keys by version counter', () => {
      const keyV1 = buildCanonicalListCacheKey({ page: 1 }, 1);
      const keyV2 = buildCanonicalListCacheKey({ page: 1 }, 2);

      expect(keyV1).toBe('prod:list:v=1:lim=20:p=1:sort=newest');
      expect(keyV2).toBe('prod:list:v=2:lim=20:p=1:sort=newest');
      expect(keyV1).not.toBe(keyV2);
    });

    it('should guarantee parameter order invariance', () => {
      // Different order of properties in the query object
      const keyA = buildCanonicalListCacheKey({ page: 2, limit: 15, sort: 'price_asc' });
      const keyB = buildCanonicalListCacheKey({ sort: 'price_asc', limit: 15, page: 2 });
      const keyC = buildCanonicalListCacheKey({ limit: 15, page: 2, sort: 'price_asc' });

      expect(keyA).toBe(keyB);
      expect(keyB).toBe(keyC);
      expect(keyA).toBe('prod:list:v=1:lim=15:p=2:sort=price_asc');
    });

    it('should guarantee default value invariance', () => {
      // Empty query vs explicit default query
      const defaultKey = buildCanonicalListCacheKey({});
      const explicitKey = buildCanonicalListCacheKey({
        page: 1,
        limit: 20,
        sort: 'newest',
      });

      expect(defaultKey).toBe(explicitKey);
      expect(defaultKey).toBe('prod:list:v=1:lim=20:p=1:sort=newest');
    });

    it('should normalize casing and spaces in search queries into identical keys', () => {
      const key1 = buildCanonicalListCacheKey({ q: '  WIRELESS   Earbuds  ' });
      const key2 = buildCanonicalListCacheKey({ q: 'wireless earbuds' });

      expect(key1).toBe(key2);
      expect(key1).toContain('q=wireless earbuds');
      expect(key1.startsWith('prod:list:v=1:')).toBe(true);
    });

    it('should ignore minPrice=0 so it matches default queries', () => {
      const keyWithoutPrice = buildCanonicalListCacheKey({});
      const keyWithZeroPrice = buildCanonicalListCacheKey({ minPrice: 0 });

      expect(keyWithZeroPrice).toBe(keyWithoutPrice);
    });

    it('should hash excessively long queries with SHA-256 to prevent key bloat', () => {
      const longSearch = 'extremely long search query intended to overflow standard url bounds '.repeat(3);
      const key = buildCanonicalListCacheKey({ q: longSearch });

      expect(key.startsWith('prod:list:v=1:h:')).toBe(true);
      expect(key.length).toBe('prod:list:v=1:h:'.length + 24);
    });

    it('should produce distinct keys for different queries', () => {
      const keyA = buildCanonicalListCacheKey({ page: 1 });
      const keyB = buildCanonicalListCacheKey({ page: 2 });
      const keyC = buildCanonicalListCacheKey({ sort: 'price_desc' });

      expect(keyA).not.toBe(keyB);
      expect(keyA).not.toBe(keyC);
    });
  });
});
