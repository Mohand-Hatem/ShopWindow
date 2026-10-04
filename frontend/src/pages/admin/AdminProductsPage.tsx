import React, { useState } from 'react';
import { useProductsQuery, useCategoriesQuery, useUpdateProductMutation } from '../../hooks/useProducts';
import { api } from '../../api/client';
import type { Product } from '../../api/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Zap,
} from 'lucide-react';

export const AdminProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const adminSecret = localStorage.getItem('sw_admin_secret') || 'mock-secret';

  const [page, setPage] = useState(1);
  const { data: response, isLoading } = useProductsQuery({ page, limit: 10 });
  const { data: categoriesResponse } = useCategoriesQuery();

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editStock, setEditStock] = useState<string>('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSku, setCreateSku] = useState('');
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createStock, setCreateStock] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  const [notification, setNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateMutation = useUpdateProductMutation();

  const products = response?.data?.items || [];
  const categories = categoriesResponse?.data || [];

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditPrice(p.price.toString());
    setEditStock(p.stock.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setNotification(null);
    setErrorMessage(null);

    try {
      await updateMutation.mutateAsync({
        id: editingProduct.id,
        payload: {
          price: parseFloat(editPrice),
          stock: parseInt(editStock, 10),
        },
        adminSecret,
      });

      setNotification(
        `Successfully updated "${editingProduct.name}". Dual-layer cache actively evicted in Redis and TanStack Query!`,
      );
      setEditingProduct(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update product');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setErrorMessage(null);

    try {
      await api.createProduct(
        {
          sku: createSku,
          name: createName,
          slug: createSlug,
          price: parseFloat(createPrice),
          stock: parseInt(createStock, 10),
          categoryId: createCategory || categories[0]?.id,
          description: createDescription || 'Test product created via Admin Control Center',
        },
        adminSecret,
      );

      setNotification(`Created product "${createName}". listVer bumped in O(1)!`);
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create product');
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive "${name}"?`)) return;

    try {
      await api.archiveProduct(id, adminSecret);
      setNotification(`Archived "${name}". Cache keys actively evicted.`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to archive');
    }
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-frost">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-white font-normal">
            Product Catalog Inventory
          </h1>
          <p className="text-sm text-[#a1a4a5] mt-1">
            Manage inventory and witness real-time active cache invalidation across Redis and client memory.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-5 py-2.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-ring flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Product</span>
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#11ff99] shrink-0" />
          <span>{notification}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-[#000000] border border-frost rounded-2xl overflow-hidden shadow-ring">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-950 text-[#a1a4a5] uppercase tracking-wider border-b border-frost">
              <tr>
                <th className="px-5 py-3.5">SKU / ID</th>
                <th className="px-5 py-3.5">Product Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-frost-soft text-[#f0f0f0]">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#a1a4a5]">
                    Loading inventory...
                  </td>
                </tr>
              )}

              {!isLoading &&
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-950/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white">{p.sku}</td>
                    <td className="px-5 py-3.5 font-sans font-medium text-sm text-white">
                      {p.name}
                    </td>
                    <td className="px-5 py-3.5 text-[#a1a4a5]">
                      <span className="px-2 py-0.5 rounded-full border border-frost text-[10px]">
                        {p.category?.name || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#11ff99]">
                      ${Number(p.price).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">{p.stock}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] uppercase text-[#ff801f]">{p.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-lg border border-frost text-[#a1a4a5] hover:text-white hover:border-[#ff801f]"
                        title="Edit Price & Stock"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(p.id, p.name)}
                        className="p-1.5 rounded-lg border border-frost text-[#a1a4a5] hover:text-[#ff2047] hover:border-[#ff2047]"
                        title="Archive Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Simple Page Controls */}
        <div className="p-4 border-t border-frost flex items-center justify-between text-xs font-mono text-[#a1a4a5]">
          <span>Page {page}</span>
          <div className="space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-full border border-frost disabled:opacity-30 hover:text-white"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-full border border-frost hover:text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#000000] border border-frost rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-frost-soft pb-4">
              <h3 className="font-display text-xl text-white">Edit Product</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-[#a1a4a5] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3 bg-zinc-950 rounded-xl border border-frost text-[#a1a4a5] space-y-1">
                <span className="text-white font-sans font-medium block">
                  {editingProduct.name}
                </span>
                <span>SKU: {editingProduct.sku}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#a1a4a5] block">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded-lg p-2.5 text-white focus:outline-none focus:border-[#ff801f]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[#a1a4a5] block">Stock Units</label>
                <input
                  type="number"
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded-lg p-2.5 text-white focus:outline-none focus:border-[#ff801f]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setEditingProduct(null)}
                className="flex-1 px-4 py-2.5 rounded-full text-xs font-medium border border-frost text-[#a1a4a5] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200"
              >
                {updateMutation.isPending ? 'Updating...' : 'Save & Evict Cache'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateProduct}
            className="bg-[#000000] border border-frost rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-frost-soft pb-4">
              <h3 className="font-display text-xl text-white">Create New Catalog Product</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-[#a1a4a5] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[#a1a4a5]">SKU</label>
                <input
                  required
                  placeholder="SKU-9901"
                  value={createSku}
                  onChange={(e) => setCreateSku(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded p-2 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[#a1a4a5]">Slug</label>
                <input
                  required
                  placeholder="item-slug"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded p-2 text-white"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[#a1a4a5]">Product Name</label>
                <input
                  required
                  placeholder="Product display title"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded p-2 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[#a1a4a5]">Price ($)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="49.99"
                  value={createPrice}
                  onChange={(e) => setCreatePrice(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded p-2 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[#a1a4a5]">Stock</label>
                <input
                  required
                  type="number"
                  placeholder="25"
                  value={createStock}
                  onChange={(e) => setCreateStock(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded p-2 text-white"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[#a1a4a5]">Category</label>
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded p-2 text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[#a1a4a5]">Description</label>
                <textarea
                  rows={2}
                  placeholder="Product description"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-frost rounded p-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-frost-soft">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 px-4 py-2 rounded-full text-xs font-medium border border-frost text-[#a1a4a5]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-neutral-200"
              >
                Create Product
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
