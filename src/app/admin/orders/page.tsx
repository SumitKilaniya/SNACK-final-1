'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-context';
import {
  adminApi,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type AdminOrder,
  type DashboardData,
} from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'PLACED', label: '⏳ Placed' },
  { id: 'ACCEPTED_BY_BRANCH', label: '✅ Accepted' },
  { id: 'PREPARING', label: '👨‍🍳 Preparing' },
  { id: 'READY_OR_OUT_FOR_DELIVERY', label: '🛵 Out for Delivery' },
  { id: 'DELIVERED', label: '🎉 Delivered' },
  { id: 'REJECTED_BY_BRANCH', label: '❌ Rejected' },
  { id: 'CANCELLED_BY_CUSTOMER', label: '🚫 Cancelled' },
  { id: 'PAYMENT_FAILED', label: '💳 Payment Failed' },
  { id: 'REFUNDED', label: '↩️ Refunded' },
];

const REFUNDABLE = ['REJECTED_BY_BRANCH', 'CANCELLED_BY_CUSTOMER', 'PAYMENT_FAILED'];

export default function AdminOrdersPage() {
  const { role } = useAdmin();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [branches, setBranches] = useState<DashboardData['branches']>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (isSuperAdmin && selectedBranchId !== 'all') params.set('branchId', selectedBranchId);
      const q = params.toString();
      const [ord, dash] = await Promise.all([
        adminApi<{ orders: AdminOrder[] }>(`/api/admin/orders${q ? `?${q}` : ''}`),
        isSuperAdmin ? adminApi<DashboardData>('/api/admin/dashboard') : Promise.resolve(null),
      ]);
      setOrders(ord.orders ?? []);
      if (dash) setBranches(dash.branches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedBranchId, isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  // Near-real-time: silently refresh the queue every 12s so new customer
  // orders appear without a manual reload (no skeleton flash, no loss of
  // in-flight actions).
  useEffect(() => {
    const t = setInterval(() => {
      if (!actingId) load({ silent: true });
    }, 12_000);
    return () => clearInterval(t);
  }, [load, actingId]);

  const act = async (id: string, status: string, note?: string) => {
    setActingId(id);
    setError(null);
    try {
      await adminApi(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      });
      setRejectOrderId(null);
      setRejectReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  const refund = async (id: string) => {
    setActingId(id);
    setError(null);
    try {
      await adminApi(`/api/admin/orders/${id}/refund`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Kitchen &amp; Dispatch Queue
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Live Orders Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Every transition is validated against the order state machine server-side.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-xl text-xs font-bold text-emerald-700 border border-emerald-200"
            title="Auto-refreshes every 12s — new customer orders appear automatically"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE
          </span>
          <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-slate-200">
            Total Queue: {orders.length}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter Branch:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="all">All Outlets ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
              <div className="skeleton h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
          <Icon name="Inbox" className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No orders in this view.</h3>
          <p className="text-xs text-slate-400 mt-1">
            New incoming customer orders will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      #{order.id.slice(0, 10)}
                    </span>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      {new Date(order.createdAt).toLocaleString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      · {order.branch.name}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                      ORDER_STATUS_TONE[order.status] ?? 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {ORDER_STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>

                <div className="space-y-1 mb-3 text-xs">
                  <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                    <Icon name="User" className="w-3.5 h-3.5 text-slate-400" />
                    {order.user.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <Icon name="Phone" className="w-3.5 h-3.5 text-slate-400" />
                    {order.user.phone ?? '—'}
                  </div>
                  {order.address && (
                    <div className="flex items-start gap-1.5 text-slate-500 text-[11px] line-clamp-2">
                      <Icon name="MapPin" className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                      {order.address.line1}, {order.address.city} ({order.address.pincode})
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 mb-3 text-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Ordered Items
                  </p>
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between font-semibold text-slate-800 text-xs"
                    >
                      <span>
                        <strong className="text-primary">{item.quantity}x</strong> {item.name}
                      </span>
                      <span>₹{item.total}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 font-medium">
                    {order.paymentMethod.toUpperCase()}{' '}
                    {order.payments?.[0] && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          order.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.paymentStatus === 'failed'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    )}
                  </span>
                  <span className="text-base font-black text-slate-900">₹{order.total}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {order.status === 'PLACED' && (
                  <>
                    <button
                      disabled={actingId === order.id}
                      onClick={() => setRejectOrderId(order.id)}
                      className="flex-1 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl border border-rose-200 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      disabled={actingId === order.id}
                      onClick={() => act(order.id, 'ACCEPTED_BY_BRANCH')}
                      className="flex-1 py-2 bg-emerald-600 text-white font-extrabold text-xs rounded-xl hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
                    >
                      {actingId === order.id ? '…' : 'Accept & Cook'}
                    </button>
                  </>
                )}

                {order.status === 'ACCEPTED_BY_BRANCH' && (
                  <button
                    disabled={actingId === order.id}
                    onClick={() => act(order.id, 'PREPARING')}
                    className="w-full py-2 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {actingId === order.id ? '…' : 'Start Preparing'}
                  </button>
                )}

                {order.status === 'PREPARING' && (
                  <button
                    disabled={actingId === order.id}
                    onClick={() => act(order.id, 'READY_OR_OUT_FOR_DELIVERY')}
                    className="w-full py-2 bg-purple-600 text-white font-extrabold text-xs rounded-xl hover:bg-purple-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {actingId === order.id ? '…' : 'Dispatch / Out for Delivery'}
                  </button>
                )}

                {order.status === 'READY_OR_OUT_FOR_DELIVERY' && (
                  <button
                    disabled={actingId === order.id}
                    onClick={() => act(order.id, 'DELIVERED')}
                    className="w-full py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {actingId === order.id ? '…' : 'Mark Delivered'}
                  </button>
                )}

                {REFUNDABLE.includes(order.status) && order.paymentStatus !== 'refunded' && (
                  <button
                    disabled={actingId === order.id}
                    onClick={() => refund(order.id)}
                    className="w-full py-2 bg-amber-500 text-white font-extrabold text-xs rounded-xl hover:bg-amber-600 transition-all shadow-md disabled:opacity-50"
                  >
                    {actingId === order.id ? '…' : 'Process Refund'}
                  </button>
                )}

                {!['PLACED', 'ACCEPTED_BY_BRANCH', 'PREPARING', 'READY_OR_OUT_FOR_DELIVERY'].includes(
                  order.status
                ) &&
                  !(REFUNDABLE.includes(order.status) && order.paymentStatus !== 'refunded') && (
                    <span className="w-full text-center py-1 text-xs text-slate-400 font-medium">
                      Order finalized ({ORDER_STATUS_LABEL[order.status]})
                    </span>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base mb-1">
              Reject Order #{rejectOrderId.slice(0, 10)}?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              A rejection reason is required — it is stored on the order timeline for the customer.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (rejectReason.trim()) act(rejectOrderId, 'REJECTED_BY_BRANCH', rejectReason.trim());
              }}
              className="space-y-4"
            >
              <input
                type="text"
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Item out of stock / High rush hour"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectOrderId(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 shadow-md"
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
