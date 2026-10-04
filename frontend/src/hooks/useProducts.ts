import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  ProductQueryParams,
  ApiResponse,
  PaginatedProducts,
  Product,
  Category,
  CacheStats,
  HealthStatus,
  PurgeResult,
} from '../api/client';

export const QUERY_KEYS = {
  products: (params: ProductQueryParams) => ['products', params] as const,
  productDetail: (idOrSlug: string) => ['product', idOrSlug] as const,
  categories: ['categories'] as const,
  health: ['health'] as const,
  cacheStats: ['admin', 'cache-stats'] as const,
};

export function useProductsQuery(params: ProductQueryParams) {
  return useQuery<ApiResponse<PaginatedProducts>, Error>({
    queryKey: QUERY_KEYS.products(params),
    queryFn: () => api.getProducts(params),
    staleTime: 30_000, // 30s in-memory client freshness (Dual-layer caching demonstration)
  });
}

export function useProductDetailQuery(idOrSlug: string) {
  return useQuery<ApiResponse<Product>, Error>({
    queryKey: QUERY_KEYS.productDetail(idOrSlug),
    queryFn: () => api.getProduct(idOrSlug),
    enabled: Boolean(idOrSlug),
    staleTime: 30_000,
  });
}

export function useCategoriesQuery() {
  return useQuery<ApiResponse<Category[]>, Error>({
    queryKey: QUERY_KEYS.categories,
    queryFn: () => api.getCategories(),
    staleTime: 60_000,
  });
}

export function useHealthQuery() {
  return useQuery<ApiResponse<HealthStatus>, Error>({
    queryKey: QUERY_KEYS.health,
    queryFn: () => api.getHealth(),
    refetchInterval: 10_000, // Heartbeat poll every 10s
  });
}

export function useCacheStatsQuery(adminSecret: string = 'mock-secret') {
  return useQuery<ApiResponse<CacheStats>, Error>({
    queryKey: QUERY_KEYS.cacheStats,
    queryFn: () => api.getCacheStats(adminSecret),
    refetchInterval: 3_000, // Auto-refresh telemetry every 3s
  });
}

export function usePurgeCacheMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<PurgeResult>,
    Error,
    { scope: 'product' | 'lists' | 'all'; id?: string; adminSecret?: string }
  >({
    mutationFn: ({ scope, id, adminSecret }) =>
      api.purgeCache(scope, id, adminSecret),
    onSuccess: (_, variables) => {
      // Invalidate relevant TanStack client cache queries immediately
      if (variables.scope === 'product' && variables.id) {
        queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['product'] });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cacheStats });
    },
  });
}

export function useResetCacheStatsMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<{ success: boolean; message: string }>,
    Error,
    string | undefined
  >({
    mutationFn: (adminSecret) => api.resetCacheStats(adminSecret),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cacheStats });
    },
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Product>,
    Error,
    { id: string; payload: { price?: number; stock?: number; name?: string }; adminSecret?: string }
  >({
    mutationFn: ({ id, payload, adminSecret }) =>
      api.updateProduct(id, payload, adminSecret),
    onSuccess: (result) => {
      // Invalidate client caches
      queryClient.invalidateQueries({ queryKey: ['product', result.data.id] });
      queryClient.invalidateQueries({ queryKey: ['product', result.data.slug] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cacheStats });
    },
  });
}
