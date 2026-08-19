'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { adminApi, ADMIN_ROLE_LABEL, type AdminUserRow, type DashboardData } from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';

const ROLE_TONE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-900 border border-purple-200',
  BRANCH_ADMIN: 'bg-blue-100 text-blue-900 border border-blue-200',
  CUSTOMER: 'bg-slate-100 text-slate-700',
};

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAdmin();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [branches, setBranches] = useState<DashboardData['branches']>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'branch_admin' | 'super_admin'>('branch_admin');
  const [formBranchId, setFormBranchId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (search.trim()) params.set('search', search.trim());
      const q = params.toString();
      const [usr, dash] = await Promise.all([
        adminApi<{ users: AdminUserRow[] }>(`/api/admin/users${q ? `?${q}` : ''}`),
        adminApi<DashboardData>('/api/admin/dashboard'),
      ]);
      setUsers(usr.users ?? []);
      setBranches(dash.branches);
      if (!formBranchId && dash.branches[0]) setFormBranchId(dash.branches[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search, formBranchId]);

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const toggleActive = async (u: AdminUserRow) => {
    if (u.id === currentAdmin?.id) {
      setError('You cannot deactivate your own account');
      return;
    }
    setActingId(u.id);
    setError(null);
    try {
      await adminApi(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deactivated: u.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setActingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (formRole === 'branch_admin' && !formBranchId) {
      setError('Please select an assigned outlet for branch admin');
      return;
    }
    try {
      await adminApi('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          role: formRole === 'super_admin' ? 'SUPER_ADMIN' : 'BRANCH_ADMIN',
          branchId: formRole === 'branch_admin' ? formBranchId : undefined,
        }),
      });
      setIsModalOpen(false);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creation failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Staff &amp; Access Control
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">User &amp; Admin Accounts</h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision branch admins, assign outlets &amp; deactivate accounts — every action is
            audit-logged.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-primary text-primary-foreground font-extrabold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-md flex items-center gap-2"
        >
          <Icon name="UserPlus" className="w-4 h-4" /> Provision Admin Account
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-500">Filter Role:</span>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
        >
          <option value="all">All Roles ({users.length})</option>
          <option value="SUPER_ADMIN">👑 Super Admins</option>
          <option value="BRANCH_ADMIN">🏬 Branch Admins</option>
          <option value="CUSTOMER">👤 Customers</option>
        </select>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 min-w-[180px] px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Assigned Outlet</th>
                  <th className="px-4 py-3.5">Orders</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                      No accounts match the current filters.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !u.isActive ? 'opacity-60 bg-slate-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ''}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded font-bold text-[10px] uppercase ${
                          ROLE_TONE[u.role] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ADMIN_ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {u.role === 'BRANCH_ADMIN' ? u.branchName ?? '—' : 'Global Access'}
                    </td>

                    <td className="px-4 py-3 text-slate-500">{u.orderCount}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {u.id === currentAdmin?.id ? (
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded-lg border border-slate-200">
                          Current Account
                        </span>
                      ) : u.role === 'SUPER_ADMIN' && u.isActive ? (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Protect super admin
                        </span>
                      ) : (
                        <button
                          disabled={actingId === u.id}
                          onClick={() => toggleActive(u)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
                            u.isActive
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {actingId === u.id ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black text-slate-900 mb-1">Provision Admin Account</h2>
            <p className="text-xs text-slate-500 mb-5">
              Create a branch manager or super admin account. Passwords are Argon2id-hashed.
            </p>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Vikram Singh"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. admin.whitefield@snackpod.in"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Temporary Password * (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Set an initial password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as 'branch_admin' | 'super_admin')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="branch_admin">Branch Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                {formRole === 'branch_admin' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Assigned Outlet *
                    </label>
                    <select
                      value={formBranchId}
                      onChange={(e) => setFormBranchId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
