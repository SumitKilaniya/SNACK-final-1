'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { adminApi, type AdminApiError } from '@/lib/admin-api';
import { useToast } from '@/lib/toast-context';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  basePrice: number;
  isAvailable: boolean;
  isVeg: boolean | null;
  imageUrl: string | null;
  isBestseller: boolean;
  badge: string | null;
  rating: number;
  reviewCount: number;
  // Fields from resolveItems() used in the overrides view
  price?: number;
  priceOverridden?: boolean;
}

interface Branch {
  id: string;
  name: string;
  city: string | null;
  isActive: boolean;
}

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

const CATEGORY_OPTIONS = [
  { id: 'main-course', name: 'Main Courses', emoji: '🍛' },
  { id: 'burgers', name: 'Burgers', emoji: '🍔' },
  { id: 'seafood', name: 'Seafood', emoji: '🦐' },
  { id: 'vegetarian', name: 'Vegetarian', emoji: '🥦' },
  { id: 'soups', name: 'Soups', emoji: '🍲' },
  { id: 'grilled-meat', name: 'Grilled Meat', emoji: '🥩' },
  { id: 'salads', name: 'Salads', emoji: '🥙' },
  { id: 'beverages', name: 'Beverages', emoji: '🥤' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'speciality', name: 'Speciality', emoji: '✨' },
  { id: 'pasta', name: 'Pasta', emoji: '🍝' },
  { id: 'side-dishes', name: 'Side Dishes', emoji: '🍟' },
  { id: 'starters', name: 'Starters', emoji: '🍢' },
];

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function AdminMenuPage() {
  const { user } = useAdmin();
  const { showToast } = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // ── Master Catalog State ──
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'outOfStock'>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBasePrice, setFormBasePrice] = useState<number | ''>(199);
  const [formCategory, setFormCategory] = useState('main-course');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formIsBestseller, setFormIsBestseller] = useState(false);
  const [formBadge, setFormBadge] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsAvailable, setFormIsAvailable] = useState(true);

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);

  // ── Per-branch Override State ──
  const [view, setView] = useState<'catalog' | 'overrides'>('catalog');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [overrideItems, setOverrideItems] = useState<MenuItem[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState<Record<string, boolean>>({});

  // ── Fetch Master Catalog ──
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi<{ items: MenuItem[] }>('/api/admin/menu-items');
      setItems(data.items);
    } catch (e) {
      console.error('Failed to load menu items', e);
      setError('Failed to load menu items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ── Fetch Branches (for override view) ──
  const fetchBranches = useCallback(async () => {
    try {
      const data = await adminApi<{ branches: Branch[] }>('/api/admin/branches');
      setBranches(data.branches);
      if (data.branches.length > 0 && !selectedBranchId) {
        if (isSuperAdmin) {
          setSelectedBranchId(data.branches[0].id);
        } else if (user?.branchId) {
          setSelectedBranchId(user.branchId);
        }
      } else if (!isSuperAdmin && user?.branchId) {
        setSelectedBranchId(user.branchId);
      }
    } catch (e) {
      console.error('Failed to load branches', e);
    }
  }, [isSuperAdmin, user?.branchId, selectedBranchId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // ── Fetch Branch Overrides ──
  const fetchOverrides = useCallback(async () => {
    if (!selectedBranchId) return;
    try {
      setOverridesLoading(true);
      const data = await adminApi<{ items: MenuItem[] }>(
        `/api/admin/branches/${selectedBranchId}/menu-overrides`
      );
      setOverrideItems(data.items);
    } catch (e) {
      console.error('Failed to load branch overrides', e);
      showToast('Failed to load branch menu', 'error');
    } finally {
      setOverridesLoading(false);
    }
  }, [selectedBranchId, showToast]);

  useEffect(() => {
    if (view === 'overrides' && selectedBranchId) {
      fetchOverrides();
    }
  }, [view, selectedBranchId, fetchOverrides]);

  // ── Master Catalog: Filtered Items ──
  const filteredItems = useMemo(() => {
    return items.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.description?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || d.category === selectedCategory;
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'instock' && d.isAvailable) ||
        (stockFilter === 'outOfStock' && !d.isAvailable);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [items, search, selectedCategory, stockFilter]);

  // ── Image Upload ──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Only JPEG, PNG, and WebP images are supported', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Step 1: Get presigned URL
      const presignData = await adminApi<PresignResponse>('/api/admin/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });

      // Step 2: Upload directly to storage (browser → bucket, never through Next.js)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('PUT', presignData.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setFormImageUrl(presignData.publicUrl);
      showToast('Image uploaded successfully ✨');
    } catch (e) {
      const err = e as AdminApiError;
      if (err.code === 'STORAGE_NOT_CONFIGURED') {
        setStorageAvailable(false);
        showToast('Direct upload not configured. Paste an image URL below.', 'info');
      } else {
        showToast(err.message || 'Image upload failed', 'error');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Detect storage availability on first presign attempt ──
  useEffect(() => {
    if (storageAvailable === null && isModalOpen) {
      // Probe silently — we'll catch STORAGE_NOT_CONFIGURED during actual upload
    }
  }, [storageAvailable, isModalOpen]);

  // ── Open Add Modal ──
  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormDesc('');
    setFormBasePrice(199);
    setFormCategory('main-course');
    setFormIsVeg(true);
    setFormIsBestseller(false);
    setFormBadge('');
    setFormImageUrl('');
    setFormIsAvailable(true);
    setStorageAvailable(null);
    setIsModalOpen(true);
  };

  // ── Open Edit Modal ──
  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDesc(item.description || '');
    setFormBasePrice(item.basePrice);
    setFormCategory(item.category);
    setFormIsVeg(item.isVeg ?? true);
    setFormIsBestseller(item.isBestseller);
    setFormBadge(item.badge || '');
    setFormImageUrl(item.imageUrl || '');
    setFormIsAvailable(item.isAvailable);
    setStorageAvailable(null);
    setIsModalOpen(true);
  };

  // ── Save (Create / Update) ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Please provide a dish name', 'error');
      return;
    }
    if (!formBasePrice || Number(formBasePrice) <= 0) {
      showToast('Please enter a valid base price', 'error');
      return;
    }

    const payload: Record<string, unknown> = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      category: formCategory,
      basePrice: Number(formBasePrice),
      isVeg: formIsVeg,
      isBestseller: formIsBestseller,
      badge: formBadge.trim() || null,
      imageUrl: formImageUrl.trim() || null,
      isAvailable: formIsAvailable,
    };

    try {
      setSaving(true);
      if (editingItem) {
        await adminApi<{ item: MenuItem }>(`/api/admin/menu-items/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast(`Updated "${formName}" ✨`);
      } else {
        await adminApi<{ item: MenuItem }>('/api/admin/menu-items', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Added "${formName}" to catalog 🍔`);
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (e) {
      const err = e as AdminApiError;
      showToast(err.message || 'Failed to save dish', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (item: MenuItem) => {
    try {
      await adminApi(`/api/admin/menu-items/${item.id}`, { method: 'DELETE' });
      showToast(`Deleted "${item.name}"`);
      setDeleteConfirmItem(null);
      fetchItems();
    } catch (e) {
      const err = e as AdminApiError;
      showToast(err.message || 'Failed to delete dish', 'error');
    }
  };

  // ── Override: Toggle Availability ──
  const handleOverrideAvailability = async (item: MenuItem) => {
    if (!selectedBranchId) return;
    const currentAvail = item.isAvailable;
    try {
      setOverrideSaving((prev) => ({ ...prev, [item.id]: true }));
      await adminApi(`/api/admin/branches/${selectedBranchId}/menu-overrides`, {
        method: 'PUT',
        body: JSON.stringify({
          itemId: item.id,
          isAvailable: !currentAvail,
        }),
      });
      showToast(`${item.name}: ${!currentAvail ? 'Made available' : 'Marked out of stock'}`);
      fetchOverrides();
    } catch (e) {
      const err = e as AdminApiError;
      showToast(err.message || 'Failed to update availability', 'error');
    } finally {
      setOverrideSaving((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // ── Override: Set Price Override ──
  const handleOverridePrice = async (itemId: string, priceStr: string) => {
    if (!selectedBranchId) return;
    const price = priceStr === '' ? null : Number(priceStr);
    try {
      setOverrideSaving((prev) => ({ ...prev, [itemId]: true }));
      await adminApi(`/api/admin/branches/${selectedBranchId}/menu-overrides`, {
        method: 'PUT',
        body: JSON.stringify({
          itemId,
          priceOverride: price,
        }),
      });
      showToast(price !== null ? 'Price override set' : 'Price override cleared — using base price');
      fetchOverrides();
    } catch (e) {
      const err = e as AdminApiError;
      showToast(err.message || 'Failed to update price', 'error');
    } finally {
      setOverrideSaving((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // ── Override: Clear Override ──
  const handleClearOverride = async (itemId: string) => {
    if (!selectedBranchId) return;
    try {
      setOverrideSaving((prev) => ({ ...prev, [itemId]: true }));
      await adminApi(`/api/admin/branches/${selectedBranchId}/menu-overrides`, {
        method: 'DELETE',
        body: JSON.stringify({ itemId }),
      });
      showToast('Override cleared — using base price');
      fetchOverrides();
    } catch (e) {
      const err = e as AdminApiError;
      showToast(err.message || 'Failed to clear override', 'error');
    } finally {
      setOverrideSaving((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // ── Override: Reset to Base Price (alias for clear) ──
  const handleResetToBasePrice = handleClearOverride;

  // ── Branch selector (locked for BRANCH_ADMIN) ──
  const effectiveBranchId = isSuperAdmin ? selectedBranchId : user?.branchId || '';
  const selectedBranchName = branches.find((b) => b.id === effectiveBranchId)?.name || '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Menu Management
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            {view === 'catalog' ? 'Master Catalog' : 'Branch Overrides'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {view === 'catalog'
              ? `${items.length} items • Global catalog (affects all branches)`
              : `Branch-scoped pricing & availability for ${selectedBranchName || '...'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {view === 'catalog' && isSuperAdmin && (
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-extrabold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2"
            >
              <Icon name="Plus" className="w-4 h-4" /> Add New Dish
            </button>
          )}
        </div>
      </div>

      {/* View Toggle Tabs */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-xs flex gap-1">
        <button
          onClick={() => setView('catalog')}
          className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            view === 'catalog'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="Package" className="w-4 h-4 inline mr-1.5" />
          Master Catalog
        </button>
        <button
          onClick={() => setView('overrides')}
          className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            view === 'overrides'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="Store" className="w-4 h-4 inline mr-1.5" />
          Per-Branch Overrides
        </button>
      </div>

      {/* ── Catalog View ──────────────────────────────────────────────── */}
      {view === 'catalog' && (
        <>
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Icon name="Search" className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dish name..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-primary focus:bg-white transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-primary"
              >
                <option value="all">All Categories ({items.length})</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as 'all' | 'instock' | 'outOfStock')}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-primary"
              >
                <option value="all">Stock: All</option>
                <option value="instock">In Stock Only</option>
                <option value="outOfStock">Out of Stock Only</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-xs font-semibold text-slate-500">Loading catalog...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 px-6">
                <Icon name="AlertTriangle" className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">{error}</p>
                <button
                  onClick={fetchItems}
                  className="mt-3 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Dish</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Base Price</th>
                      <th className="px-4 py-3.5">Rating</th>
                      <th className="px-4 py-3.5">Type & Badges</th>
                      <th className="px-4 py-3.5">Stock</th>
                      {isSuperAdmin && <th className="px-4 py-3.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-12 text-center text-slate-400">
                          <Icon name="Utensils" className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600 text-sm">No dishes match your filters.</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Try adjusting search or click &quot;Add New Dish&quot;.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const categoryName =
                          CATEGORY_OPTIONS.find((c) => c.id === item.category)?.name || item.category;
                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              !item.isAvailable ? 'bg-slate-50/50 opacity-75' : ''
                            }`}
                          >
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-3">
                                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                  <AppImage
                                    src={item.imageUrl || '/images/dishes/dish_48.webp'}
                                    alt={item.name}
                                    fill
                                    className={`object-cover ${!item.isAvailable ? 'grayscale' : ''}`}
                                    sizes="48px"
                                  />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                    {item.name}
                                    {item.isVeg ? (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                                        🟢 Veg
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded border border-rose-300">
                                        🔴 Non-Veg
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5">
                                    {item.description || 'No description provided.'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-semibold text-slate-800">
                              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200">
                                {categoryName}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-extrabold text-slate-900 text-sm">₹{item.basePrice}</span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className="text-amber-500">★</span>
                                <span className="font-bold text-slate-900 text-sm">
                                  {item.rating.toFixed(1)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  · {item.reviewCount} reviews
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                {item.isBestseller && (
                                  <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded">
                                    ★ Bestseller
                                  </span>
                                )}
                                {item.badge && (
                                  <span className="bg-primary/10 text-primary font-bold text-[10px] px-2 py-0.5 rounded">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                  item.isAvailable
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                              </span>
                            </td>

                            {isSuperAdmin && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEditModal(item)}
                                    className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Edit Dish"
                                  >
                                    <Icon name="Pencil" className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmItem(item)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Dish"
                                  >
                                    <Icon name="Trash2" className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Overrides View ────────────────────────────────────────────── */}
      {view === 'overrides' && (
        <>
          {/* Branch Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icon name="Store" className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700">Branch:</span>
            </div>
            {isSuperAdmin ? (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-primary"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.city ? ` (${b.city})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-bold text-slate-900">{selectedBranchName}</span>
            )}
          </div>

          {/* Overrides Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {overridesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-xs font-semibold text-slate-500">Loading branch menu...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Dish</th>
                      <th className="px-4 py-3.5">Base Price</th>
                      <th className="px-4 py-3.5">Branch Price</th>
                      <th className="px-4 py-3.5">Override Input</th>
                      <th className="px-4 py-3.5">Availability</th>
                      <th className="px-4 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overrideItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                          <Icon name="Store" className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600 text-sm">
                            No menu items available for this branch.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      overrideItems.map((item) => {
                        const hasOverride = item.priceOverridden ?? false;
                        const effectivePrice = item.price ?? item.basePrice;
                        const priceOverridden = item.priceOverridden ?? false;

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              overrideSaving[item.id] ? 'opacity-60' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                  <AppImage
                                    src={item.imageUrl || '/images/dishes/dish_48.webp'}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                  />
                                </div>
                                <div>
                                  <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                                  <p className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px]">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 text-sm">₹{item.basePrice}</span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-slate-900 text-sm">
                                  ₹{effectivePrice}
                                </span>
                                {priceOverridden && (
                                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    OVERRIDE
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <span className="absolute left-2 top-2 text-[10px] text-slate-400 font-bold">
                                    ₹
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.priceOverridden ? (item.price ?? '') : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      // Update local state optimistically
                                      setOverrideItems((prev) =>
                                        prev.map((it) =>
                                          it.id === item.id
                                            ? {
                                                ...it,
                                                priceOverridden: val !== '',
                                                price: val === '' ? it.basePrice : Number(val),
                                              }
                                            : it
                                        )
                                      );
                                    }}
                                    onBlur={(e) => handleOverridePrice(item.id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleOverridePrice(item.id, (e.target as HTMLInputElement).value);
                                    }}
                                    placeholder={String(item.basePrice)}
                                    className="w-24 pl-5 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-primary"
                                  />
                                </div>
                                {hasOverride && item.priceOverridden && (
                                  <button
                                    onClick={() => handleResetToBasePrice(item.id)}
                                    className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-primary bg-slate-100 hover:bg-primary/10 rounded-lg transition-colors whitespace-nowrap"
                                    title="Clear override → use base price"
                                  >
                                    Reset to base
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleOverrideAvailability(item)}
                                disabled={overrideSaving[item.id]}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 border shadow-2xs ${
                                  item.isAvailable
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    item.isAvailable
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-500'
                                  }`}
                                />
                                {item.isAvailable
                                  ? 'Available'
                                  : 'Unavailable'}
                              </button>
                            </td>

                            <td className="px-4 py-3">
                              {overrideSaving[item.id] ? (
                                <span className="text-[10px] text-slate-400 font-medium">Saving...</span>
                              ) : hasOverride ? (
                                <span className="text-[10px] text-emerald-600 font-bold">Saved</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Add / Edit Dish Modal ───────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">
              {editingItem ? 'Edit Dish' : 'Add New Dish'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              {editingItem
                ? 'Edit the global catalog entry. Changes apply to ALL branches.'
                : 'Add a new item to the global catalog. Per-branch overrides are configured separately.'}
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Gourmet Truffle Burger"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-primary focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Short appetizing description..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-primary focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Base Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-primary"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Custom Badge</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="e.g. Chef Special"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dish Image</label>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    {formImageUrl ? (
                      <AppImage src={formImageUrl} alt="Preview" fill className="object-cover" sizes="64px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Icon name="Image" className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {storageAvailable !== false && (
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer disabled:opacity-50"
                        />
                        {uploading && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">{uploadProgress}%</span>
                          </div>
                        )}
                      </div>
                    )}
                    <input
                      type="url"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder={
                        storageAvailable === false
                          ? 'Paste an image URL'
                          : 'Or paste an image URL'
                      }
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 outline-none"
                    />
                    {storageAvailable === false && (
                      <p className="text-[10px] text-amber-600 font-medium">
                        Direct upload isn&apos;t set up yet — paste a hosted image URL for now.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rating Display (Read-Only) */}
              {editingItem && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-amber-500 text-sm">★</span>
                  <span className="text-xs font-bold text-slate-900">
                    {editingItem.rating.toFixed(1)} · {editingItem.reviewCount} reviews
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto">Computed from reviews — read only</span>
                </div>
              )}

              {/* Toggles */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formIsVeg}
                    onChange={(e) => setFormIsVeg(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>Vegetarian Dish</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formIsBestseller}
                    onChange={(e) => setFormIsBestseller(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>Bestseller</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formIsAvailable}
                    onChange={(e) => setFormIsAvailable(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className={formIsAvailable ? 'text-emerald-700' : 'text-slate-500'}>
                    In Stock
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-primary-foreground font-extrabold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center border border-slate-200 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Icon name="Trash2" className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">Delete &quot;{deleteConfirmItem.name}&quot;?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-2">
              This will remove the item from the customer menu and all branches immediately.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-left">
              <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                <Icon name="AlertTriangle" className="w-3.5 h-3.5 shrink-0" />
                Cascade warning
              </p>
              <p className="text-[11px] text-amber-700 mt-1">
                This item&apos;s branch price overrides and customer reviews will also be permanently deleted.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmItem)}
                className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
