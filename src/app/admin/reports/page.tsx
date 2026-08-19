'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { adminApi, type DashboardData, type ReportData } from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';

type Range = 'today' | '7days' | '30days' | 'all';

function rangeToParams(range: Range): { from?: string; to?: string } {
  if (range === 'all') return {};
  const to = new Date();
  const from = new Date();
  if (range === 'today') from.setHours(0, 0, 0, 0);
  else from.setDate(from.getDate() - (range === '7days' ? 7 : 30));
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AdminReportsPage() {
  const { role } = useAdmin();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [timeRange, setTimeRange] = useState<Range>('30days');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [branches, setBranches] = useState<DashboardData['branches']>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const r = rangeToParams(timeRange);
      if (r.from) params.set('from', r.from);
      if (r.to) params.set('to', r.to);
      if (isSuperAdmin && selectedBranch !== 'all') params.set('branchId', selectedBranch);
      const q = params.toString();
      const [rep, dash] = await Promise.all([
        adminApi<ReportData>(`/api/admin/reports${q ? `?${q}` : ''}`),
        isSuperAdmin ? adminApi<DashboardData>('/api/admin/dashboard') : Promise.resolve(null),
      ]);
      setReport(rep);
      if (dash) setBranches(dash.branches);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedBranch, isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = report?.summary;
  const maxDailyRevenue = Math.max(1, ...(report?.daily ?? []).map((d) => d.revenue));
  const maxTopItem = Math.max(1, ...(report?.topItems ?? []).map((t) => t.quantity));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Executive Analytics
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            Reports &amp; Revenue Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Revenue counts settled money only (paid via gateway or collected on COD delivery).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-700 border border-slate-200">
            {(['today', '7days', '30days', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === t ? 'bg-white text-slate-900 shadow-xs font-black' : 'hover:text-slate-900'
                }`}
              >
                {t === 'today' ? 'Today' : t === '7days' ? '7 Days' : t === '30days' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          {isSuperAdmin && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="all">All Outlets</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Total Sales Revenue
              </p>
              <h2 className="text-3xl font-black text-slate-900 mt-2">
                ₹{(summary?.revenue ?? 0).toLocaleString('en-IN')}
              </h2>
              <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <Icon name="TrendingUp" className="w-3.5 h-3.5" /> Settled revenue in range
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Order Volume
              </p>
              <h2 className="text-3xl font-black text-slate-900 mt-2">
                {summary?.orderCount ?? 0} Orders
              </h2>
              <p className="text-xs text-blue-600 font-semibold mt-1">
                {summary?.cancelledOrFailed ?? 0} cancelled / failed / refunded
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Average Order Value (AOV)
              </p>
              <h2 className="text-3xl font-black text-slate-900 mt-2">₹{summary?.avgOrderValue ?? 0}</h2>
              <p className="text-xs text-purple-600 font-semibold mt-1">
                Revenue ÷ {summary?.paidOrderCount ?? 0} paid orders
              </p>
            </div>
          </div>

          {/* Daily Revenue Series */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Daily Revenue</h3>
              <p className="text-xs text-slate-500">Settled revenue per day (last {report?.daily.length ?? 0} days in range)</p>
            </div>
            {report && report.daily.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No sales data for the selected filters.</div>
            ) : (
              <div className="flex items-end gap-1.5 h-40 pt-2 overflow-x-auto">
                {report?.daily.map((d) => (
                  <div key={d.date} className="flex flex-col items-center gap-1 min-w-[34px] flex-1" title={`${d.date} · ₹${d.revenue}`}>
                    <div className="w-full max-w-[42px] bg-primary/80 hover:bg-primary rounded-t-md transition-all" style={{ height: `${Math.max(4, (d.revenue / maxDailyRevenue) * 110)}px` }} />
                    <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Per-branch breakdown */}
            {isSuperAdmin && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Outlet Performance</h3>
                  <p className="text-xs text-slate-500">Orders &amp; settled revenue by outlet</p>
                </div>
                {report && report.byBranch.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">No data for the selected filters.</div>
                ) : (
                  <div className="space-y-3">
                    {report?.byBranch.map((b) => (
                      <div key={b.branchId} className="flex items-center justify-between bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{b.branchName}</p>
                          <p className="text-[11px] text-slate-500">{b.orderCount} orders</p>
                        </div>
                        <p className="font-black text-slate-900">₹{b.revenue.toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Top items */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Top Selling Items</h3>
                <p className="text-xs text-slate-500">By units sold</p>
              </div>
              {report && report.topItems.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No items sold in this range.</div>
              ) : (
                <div className="space-y-3 pt-1">
                  {report?.topItems.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="truncate pr-2">{item.name}</span>
                        <span className="font-mono shrink-0">{item.quantity} sold</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${(item.quantity / maxTopItem) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
