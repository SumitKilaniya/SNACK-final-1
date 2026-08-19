'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';

interface BranchRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  servicePincodes: string[];
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('Bengaluru');
  const [formPincodes, setFormPincodes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi<{ branches: BranchRow[] }>('/api/admin/branches');
      setBranches(res.branches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAddModal = () => {
    setEditingBranch(null);
    setFormName('');
    setFormAddress('');
    setFormCity('Bengaluru');
    setFormPincodes('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (b: BranchRow) => {
    setEditingBranch(b);
    setFormName(b.name);
    setFormAddress(b.address ?? '');
    setFormCity(b.city ?? 'Bengaluru');
    setFormPincodes(b.servicePincodes.join(', '));
    setFormIsActive(b.isActive);
    setIsModalOpen(true);
  };

  const toggleActive = async (b: BranchRow) => {
    setActingId(b.id);
    setError(null);
    try {
      await adminApi(`/api/admin/branches/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !b.isActive }),
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
    const pincodes = [...new Set(
      formPincodes
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    )];
    const badPin = pincodes.find((p) => !/^\d{6}$/.test(p));
    if (badPin) {
      setError(`"${badPin}" is not a valid 6-digit pincode`);
      return;
    }
    try {
      if (editingBranch) {
        await adminApi(`/api/admin/branches/${editingBranch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: formName.trim(),
            city: formCity.trim(),
            address: formAddress.trim(),
            servicePincodes: pincodes,
            isActive: formIsActive,
          }),
        });
      } else {
        await adminApi('/api/admin/branches', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            city: formCity.trim(),
            address: formAddress.trim(),
            servicePincodes: pincodes,
          }),
        });
      }
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Outlet Operations
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Branch Outlets Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Outlet details, service pincodes (6-digit) &amp; operating status.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-primary text-primary-foreground font-extrabold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-md flex items-center gap-2"
        >
          <Icon name="Plus" className="w-4 h-4" /> Add New Outlet
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Outlets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
          <Icon name="Building2" className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No outlets yet.</h3>
          <p className="text-xs text-slate-400 mt-1">Create your first branch to start serving.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                b.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                      <Icon name="Building2" className="w-4 h-4 text-primary" /> {b.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Icon name="MapPin" className="w-3.5 h-3.5 text-orange-500" /> {b.address},{' '}
                      {b.city}
                    </p>
                  </div>

                  <button
                    disabled={actingId === b.id}
                    onClick={() => toggleActive(b)}
                    className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border shrink-0 disabled:opacity-50 ${
                      b.isActive
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {b.isActive ? 'Open' : 'Closed'}
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-700 my-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Branch Users:</span>
                    <strong className="text-slate-900">{b.userCount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block mb-1">Service Pincodes:</span>
                    <div className="flex flex-wrap gap-1">
                      {b.servicePincodes.length === 0 ? (
                        <span className="text-[11px] text-slate-400">No pincodes set</span>
                      ) : (
                        b.servicePincodes.map((pin) => (
                          <span
                            key={pin}
                            className="bg-white border border-slate-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded text-slate-800"
                          >
                            {pin}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(b)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                >
                  <Icon name="Pencil" className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">
              {editingBranch ? 'Edit Branch' : 'Add New Branch Outlet'}
            </h2>
            <p className="text-xs text-slate-500 mb-5">Configure outlet details and delivery area.</p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Outlet Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Indiranagar Flagship"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  required
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. 100 Feet Rd, 12th Main"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setFormIsActive(e.target.value === 'active')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="active">Active Outlet</option>
                    <option value="inactive">Temporarily Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service Pincodes (comma-separated 6-digit)
                </label>
                <input
                  type="text"
                  value={formPincodes}
                  onChange={(e) => setFormPincodes(e.target.value)}
                  placeholder="560038, 560008, 560075"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground font-extrabold text-xs rounded-xl shadow-md"
                >
                  {editingBranch ? 'Save Branch' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
