'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/lib/admin-context';
import {
  adminApi,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type AdminOrder,
  type DashboardData,
} from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';

export default function AdminDashboardPage() {
  const { role } = useAdmin();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [dash, ord] = await Promise.all([
        adminApi<DashboardData>('/api/admin/dashboard'),
        adminApi<{ orders: AdminOrder[] }>('/api/admin/orders?status=all'),
      ]);
      setDashboard(dash);
      setOrders(ord.orders ?? []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Near-real-time polling — matches the 12s interval used in orders/page.tsx.
  // Pauses when the browser tab is hidden to avoid wasted requests.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadRef.current({ silent: true });
      }
    }, 12_000);
    return () => clearInterval(t);
  }, []);

  // Tick the "last updated" counter every second.
  useEffect(() => {
    if (!lastUpdated) return;
    const t = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1_000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  const advance = async (id: string, status: string, note?: string) => {
    setActingId(id);
    try {
      await adminApi(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  const kpis = dashboard?.kpis;
  const activeOrders = orders.filter((o) =>
    ['PLACED', 'ACCEPTED_BY_BRANCH', 'PREPARING', 'READY_OR_OUT_FOR_DELIVERY'].includes(o.status)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
            {isSuperAdmin ? '👑 Super Admin Control' : '🏬 Branch Operations'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2 leading-tight">Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isSuperAdmin
              ? 'Live KPIs across every outlet, real-time orders and the full admin toolkit.'
              : 'Your branch queue, live order flow and outlet performance.'}
          </p>
        </div>          <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] font-medium text-slate-400">
              Updated {secondsAgo}s ago
            </span>
          )}
          <button
            onClick={() => load()}
            className="px-3 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold rounded-xl text-sm transition-all border border-slate-700 flex items-center gap-2"
          >
            <Icon name="RefreshCw" className="w-4 h-4" />
            Refresh
          </button>
          <Link
            href="/admin/orders"
            className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition-all shadow-md flex items-center gap-2"
          >
            <Icon name="ShoppingBag" className="w-4 h-4" />
            Live Orders ({activeOrders.length})
          </Link>
          <Link
            href="/admin/menu"
            className="px-4 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold rounded-xl text-sm transition-all border border-slate-700 flex items-center gap-2"
          >
            <Icon name="Utensils" className="w-4 h-4" />
            Menu Catalog
          </Link>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Total Sales
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              ₹{(kpis?.totalRevenue ?? 0).toLocaleString('en-IN')}
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <Icon name="TrendingUp" className="w-3.5 h-3.5" /> ₹
              {(kpis?.todayRevenue ?? 0).toLocaleString('en-IN')} today
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Icon name="IndianRupee" className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Active Queue
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {kpis?.activeQueue ?? 0} Orders
            </h3>
            <p className="text-xs text-amber-600 font-medium mt-1">
              {kpis?.pendingAcceptance ?? 0} awaiting acceptance
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Icon name="Clock" className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Orders Today
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {kpis?.todayOrders ?? 0} Orders
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {kpis?.totalOrders ?? 0} all-time
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Icon name="ShoppingBag" className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Network
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {isSuperAdmin ? `${kpis?.totalBranches ?? 0} Outlets` : '1 Outlet'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {kpis?.totalCustomers ?? 0} customers · {kpis?.totalMenuItems ?? 0} menu items
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Icon name="Building2" className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Icon name="Sparkles" className="w-5 h-5 text-primary" /> Quick Operations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/orders"
            className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Icon name="ShoppingBag" className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-primary transition-colors">
              Process Orders
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Accept, reject or advance orders through the kitchen queue.
            </p>
          </Link>

          <Link
            href="/admin/menu"
            className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Icon name="PlusCircle" className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-primary transition-colors">
              Menu Catalog
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Master items, branch price overrides and availability.
            </p>
          </Link>

          {isSuperAdmin ? (
            <>
              <Link
                href="/admin/branches"
                className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon name="Building2" className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base group-hover:text-primary transition-colors">
                  Manage Outlets
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Branches, service pincodes and operating status.
                </p>
              </Link>

              <Link
                href="/admin/users"
                className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon name="Users" className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base group-hover:text-primary transition-colors">
                  Staff &amp; Access
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Provision branch admins, deactivate accounts.
                </p>
              </Link>
            </>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 opacity-80">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center mb-3">
                <Icon name="Lock" className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-700 text-base">Super Admin Features</h3>
              <p className="text-xs text-slate-500 mt-1">
                Outlets, users, reports &amp; coupons are managed by Super Admin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Order Queue</h3>
            <p className="text-xs text-slate-500">
              {loading ? 'Loading…' : `${orders.length} orders in scope`}
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            View All ({orders.length}) →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <Icon name="Inbox" className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-sm">No orders yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Customer orders placed on the store will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-900">
                        #{order.id.slice(0, 8)}
                      </span>
                      <div className="text-[11px] text-slate-400">
                        {order.branch.name} ·{' '}
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{order.user.name}</div>
                      <div className="text-[11px] text-slate-500">{order.user.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      ₹{order.total}
                      <div className="text-[10px] font-medium text-slate-400 uppercase">
                        {order.paymentMethod}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                          ORDER_STATUS_TONE[order.status] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {order.status === 'PLACED' && (
                        <button
                          disabled={actingId === order.id}
                          onClick={() => advance(order.id, 'ACCEPTED_BY_BRANCH')}
                          className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          Accept
                        </button>
                      )}
                      {order.status === 'ACCEPTED_BY_BRANCH' && (
                        <button
                          disabled={actingId === order.id}
                          onClick={() => advance(order.id, 'PREPARING')}
                          className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          Start Prep
                        </button>
                      )}
                      {order.status === 'PREPARING' && (
                        <button
                          disabled={actingId === order.id}
                          onClick={() => advance(order.id, 'READY_OR_OUT_FOR_DELIVERY')}
                          className="px-2.5 py-1 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          Dispatch
                        </button>
                      )}
                      {order.status === 'READY_OR_OUT_FOR_DELIVERY' && (
                        <button
                          disabled={actingId === order.id}
                          onClick={() => advance(order.id, 'DELIVERED')}
                          className="px-2.5 py-1 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          Deliver
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
    </div>
  );
}
