'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, type DashboardData } from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';

type CouponType = 'FLAT' | 'PERCENTAGE' | 'FREE_DELIVERY' | 'FIRST_ORDER';

interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  description: string | null;
  minOrderValue: number;
  maxDiscount: number | null;
  perUserLimit: number;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  usageCount: number;
}

const TYPE_LABEL: Record<CouponType, string> = {
  FLAT: 'Flat ₹',
  PERCENTAGE: '% Off',
  FREE_DELIVERY: 'Free Delivery',
  FIRST_ORDER: 'First Order %',
};

const TYPE_TONE: Record<CouponType, string> = {
  FLAT: 'bg-orange-100 text-orange-900 border border-orange-200',
  PERCENTAGE: 'bg-blue-100 text-blue-900 border border-blue-200',
  FREE_DELIVERY: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  FIRST_ORDER: 'bg-purple-100 text-purple-900 border border-purple-200',
};

function typeSummary(c: CouponRow): string {
  if (c.type === 'FLAT') return `₹${c.value} off`;
  if (c.type === 'PERCENTAGE') return `${c.value}%${c.maxDiscount ? ` (max ₹${c.maxDiscount})` : ''}`;
  if (c.type === 'FREE_DELIVERY') return 'Delivery fee waived';
  return `${c.value}% (max ₹${c.maxDiscount ?? '—'}) · 1st order`;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [branches, setBranches] = useState<DashboardData['branches']>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<CouponType>('PERCENTAGE');
  const [formValue, setFormValue] = useState<number | ''>(20);
  const [formDesc, setFormDesc] = useState('');
  const [formMinOrder, setFormMinOrder] = useState<number | ''>(0);
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | ''>('');
  const [formPerUser, setFormPerUser] = useState<number | ''>(1);
  const [formBranchId, setFormBranchId] = useState('global');
  const [formExpiry, setFormExpiry] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const q = params.toString();
      const [coup, dash] = await Promise.all([
        adminApi<{ coupons: CouponRow[] }>(`/api/admin/coupons${q ? `?${q}` : ''}`),
        adminApi<DashboardData>('/api/admin/dashboard'),
      ]);
      setCoupons(coup.coupons ?? []);
      setBranches(dash.branches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const openAddModal = () => {
    setEditing(null);
    setFormCode('SNACK' + Math.floor(100 + Math.random() * 900));
    setFormType('PERCENTAGE');
    setFormValue(20);
    setFormDesc('');
    setFormMinOrder(0);
    setFormMaxDiscount('');
    setFormPerUser(1);
    setFormBranchId('global');
    setFormExpiry('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (c: CouponRow) => {
    setEditing(c);
    setFormCode(c.code);
    setFormType(c.type);
    setFormValue(c.value);
    setFormDesc(c.description ?? '');
    setFormMinOrder(c.minOrderValue);
    setFormMaxDiscount(c.maxDiscount ?? '');
    setFormPerUser(c.perUserLimit);
    setFormBranchId(c.branchId ?? 'global');
    setFormExpiry(c.expiresAt ? c.expiresAt.slice(0, 10) : '');
    setFormIsActive(c.isActive);
    setIsModalOpen(true);
  };

  const toggleActive = async (c: CouponRow) => {
    setActingId(c.id);
    setError(null);
    try {
      await adminApi(`/api/admin/coupons/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setActingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        code: formCode.trim().toUpperCase(),
        type: formType,
        value: Number(formValue) || 0,
        description: formDesc.trim() || null,
        minOrderValue: Number(formMinOrder) || 0,
        maxDiscount:
          formType === 'PERCENTAGE' || formType === 'FIRST_ORDER'
            ? formMaxDiscount === ''
              ? null
              : Number(formMaxDiscount)
            : null,
        perUserLimit: Number(formPerUser) || 1,
        branchId: formBranchId === 'global' ? null : formBranchId,
        expiresAt: formExpiry ? new Date(formExpiry + 'T23:59:59').toISOString() : null,
        isActive: formIsActive,
      };
      if (editing) {
        await adminApi(`/api/admin/coupons/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await adminApi('/api/admin/coupons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setError(null);
    try {
      await adminApi(`/api/admin/coupons/${deleteConfirmId}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deactivate failed');
    }
  };

  const filtered = coupons.filter((c) => {
    const ms = search.toLowerCase();
    const matchesSearch =
      !ms || c.code.toLowerCase().includes(ms) || (c.description ?? '').toLowerCase().includes(ms);
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Promotions &amp; Discounts
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Coupons &amp; Offers Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Flat, percentage, free-delivery and first-order coupons. Every rule is enforced
            server-side at checkout.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-primary text-primary-foreground font-extrabold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <Icon name="Plus" className="w-4 h-4" /> Create Coupon
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Icon name="Search" className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or description..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-primary"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
        >
          <option value="all">All Types ({coupons.length})</option>
          <option value="FLAT">₹ Flat</option>
          <option value="PERCENTAGE">% Percentage</option>
          <option value="FREE_DELIVERY">🛵 Free Delivery</option>
          <option value="FIRST_ORDER">🎉 First Order</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Code</th>
                  <th className="px-4 py-3.5">Discount</th>
                  <th className="px-4 py-3.5">Min Order</th>
                  <th className="px-4 py-3.5">Scope</th>
                  <th className="px-4 py-3.5">Per-User</th>
                  <th className="px-4 py-3.5">Used</th>
                  <th className="px-4 py-3.5">Expiry</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <Icon name="Tag" className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 text-sm">No coupons found.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const isExpired = c.expiresAt ? new Date(c.expiresAt).getTime() < Date.now() : false;
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !c.isActive || isExpired ? 'opacity-60 bg-slate-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-sm tracking-wider">
                            {c.code}
                          </span>
                          {c.description && (
                            <div className="text-[11px] text-slate-400 mt-1 max-w-[220px] truncate">
                              {c.description}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${TYPE_TONE[c.type]}`}
                          >
                            {TYPE_LABEL[c.type]}
                          </span>
                          <div className="text-[11px] font-semibold text-slate-800 mt-1">
                            {typeSummary(c)}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {c.minOrderValue > 0 ? `₹${c.minOrderValue}` : '—'}
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-800">
                          {c.branchName ? (
                            <span className="text-[11px] bg-orange-50 text-orange-800 px-2 py-0.5 rounded font-bold">
                              🏬 {c.branchName}
                            </span>
                          ) : (
                            <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold">
                              🌍 Global
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-600">{c.perUserLimit}</td>
                        <td className="px-4 py-3 text-slate-600 font-bold">{c.usageCount}</td>

                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {c.expiresAt ? (
                            <span className={isExpired ? 'text-rose-600 font-bold' : ''}>
                              {new Date(c.expiresAt).toLocaleDateString('en-IN')}
                              {isExpired && (
                                <span className="ml-1 text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-extrabold uppercase">
                                  Expired
                                </span>
                              )}
                            </span>
                          ) : (
                            'Never'
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            disabled={actingId === c.id}
                            onClick={() => toggleActive(c)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-50 ${
                              !c.isActive
                                ? 'bg-slate-200 text-slate-700 border-slate-300'
                                : isExpired
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {!c.isActive ? 'Inactive' : isExpired ? 'Expired' : 'Active'}
                          </button>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(c)}
                              className="p-1.5 text-slate-600 hover:text-primary rounded-lg"
                              title="Edit Coupon"
                            >
                              <Icon name="Pencil" className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(c.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                              title="Deactivate Coupon"
                            >
                              <Icon name="Trash2" className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* ── Create / Edit Modal ─────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">
              {editing ? 'Edit Coupon' : 'Create New Coupon'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              All rules below are enforced server-side at checkout — never by the frontend.
            </p>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SNACK20"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Type *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as CouponType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="PERCENTAGE">Percentage Off (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                    <option value="FREE_DELIVERY">Free Delivery</option>
                    <option value="FIRST_ORDER">First Order Only (%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. 20% off your first order"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Value ({formType === 'FLAT' ? '₹' : formType === 'FREE_DELIVERY' ? '(n/a)' : '%'})
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={formType === 'FREE_DELIVERY'}
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Min Order (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900"
                  />
                </div>
              </div>

              {(formType === 'PERCENTAGE' || formType === 'FIRST_ORDER') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Discount Cap (₹, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMaxDiscount}
                    onChange={(e) =>
                      setFormMaxDiscount(e.target.value ? Number(e.target.value) : '')
                    }
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Per-User Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formPerUser}
                    onChange={(e) => setFormPerUser(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Scope</label>
                <select
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="global">🌍 Global — all branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      🏬 {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>Active &amp; Redeemable</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-primary text-primary-foreground font-extrabold text-xs rounded-xl hover:bg-primary/90"
                  >
                    Save Coupon
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center border border-slate-200 shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base">Deactivate this coupon?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Customers will no longer be able to redeem it. Usage history is preserved.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700"
              >
                Confirm Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
