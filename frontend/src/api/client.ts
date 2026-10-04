/**
 * ShopWindow API Client with Header Telemetry & Cache Inspection
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  data: T;
  status: number;
  durationMs: number;
  headers: {
    cacheStatus: 'HIT' | 'MISS' | 'BYPASS' | 'CLIENT_CACHE' | 'UNKNOWN';
    etag?: string | null;
    cacheControl?: string | null;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  _count?: {
    products: number;
  };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  currency: string;
  stock: number;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc';
}

export interface CacheStats {
  hits: number;
  misses: number;
  bypasses: number;
  hitRatio: string;
  avgHitLatencyMs: number;
  avgMissLatencyMs: number;
  totalKeysEstimated: number;
}

export interface PurgeResult {
  success: boolean;
  scope: 'product' | 'lists' | 'all';
  target?: string;
  unlinkedKeys?: number;
  newVersion?: number;
  message: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
  cache: 'connected' | 'disconnected';
  queries: {
    total: number;
    productDetail: number;
  };
  timestamp: string;
  uptimeSeconds: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  adminSecret?: string,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const start = performance.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (adminSecret) {
    headers['x-admin-auth'] = adminSecret;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const durationMs = Math.round(performance.now() - start);

  const xCache = response.headers.get('x-cache') as 'HIT' | 'MISS' | 'BYPASS' | null;
  const etag = response.headers.get('etag');
  const cacheControl = response.headers.get('cache-control');

  let data: any = null;
  if (response.status !== 204 && response.status !== 304) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).data = data;
    throw err;
  }

  return {
    data: data as T,
    status: response.status,
    durationMs,
    headers: {
      cacheStatus: xCache || 'UNKNOWN',
      etag,
      cacheControl,
    },
  };
}

export const api = {
  // Public Catalog
  async getProducts(params: ProductQueryParams = {}): Promise<ApiResponse<PaginatedProducts>> {
    const search = new URLSearchParams();
    if (params.page) search.set('page', params.page.toString());
    if (params.limit) search.set('limit', params.limit.toString());
    if (params.category) search.set('category', params.category);
    if (params.q) search.set('q', params.q);
    if (params.minPrice !== undefined) search.set('minPrice', params.minPrice.toString());
    if (params.maxPrice !== undefined) search.set('maxPrice', params.maxPrice.toString());
    if (params.sort) search.set('sort', params.sort);

    const query = search.toString() ? `?${search.toString()}` : '';
    return request<PaginatedProducts>(`/products${query}`);
  },

  async getProduct(idOrSlug: string): Promise<ApiResponse<Product>> {
    return request<Product>(`/products/${idOrSlug}`);
  },

  async getCategories(): Promise<ApiResponse<Category[]>> {
    return request<Category[]>('/categories');
  },

  async getHealth(): Promise<ApiResponse<HealthStatus>> {
    return request<HealthStatus>('/health');
  },

  // Admin Operations
  async getCacheStats(adminSecret: string = 'mock-secret'): Promise<ApiResponse<CacheStats>> {
    return request<CacheStats>('/admin/cache/stats', {}, adminSecret);
  },

  async resetCacheStats(adminSecret: string = 'mock-secret'): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return request<{ success: boolean; message: string }>(
      '/admin/cache/reset-stats',
      { method: 'POST' },
      adminSecret,
    );
  },

  async purgeCache(
    scope: 'product' | 'lists' | 'all',
    id?: string,
    adminSecret: string = 'mock-secret',
  ): Promise<ApiResponse<PurgeResult>> {
    return request<PurgeResult>(
      '/admin/cache/purge',
      {
        method: 'POST',
        body: JSON.stringify({ scope, ...(id ? { id } : {}) }),
      },
      adminSecret,
    );
  },

  async updateProduct(
    id: string,
    payload: { price?: number; stock?: number; name?: string },
    adminSecret: string = 'mock-secret',
  ): Promise<ApiResponse<Product>> {
    return request<Product>(
      `/admin/products/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      adminSecret,
    );
  },

  async createProduct(
    payload: {
      sku: string;
      name: string;
      slug: string;
      description: string;
      price: number;
      categoryId: string;
      stock: number;
    },
    adminSecret: string = 'mock-secret',
  ): Promise<ApiResponse<Product>> {
    return request<Product>(
      '/admin/products',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      adminSecret,
    );
  },

  async archiveProduct(
    id: string,
    adminSecret: string = 'mock-secret',
  ): Promise<ApiResponse<{ success: boolean; status: string }>> {
    return request<{ success: boolean; status: string }>(
      `/admin/products/${id}`,
      {
        method: 'DELETE',
      },
      adminSecret,
    );
  },
};
