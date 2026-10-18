'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';

interface CustomerOrderSummary {
  id: string;
  status: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
  branch: { name: string } | null;
}

interface CustomerOrder extends CustomerOrderSummary {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  items: { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orders: CustomerOrderSummary[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [orderHistories, setOrderHistories] = useState<Record<string, CustomerOrder[]>>({});
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({});

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi<{ customers: Customer[] }>('/api/admin/customers');
      setCustomers(result.customers ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const query = search.trim().toLowerCase();
  const filteredCustomers = customers.filter((customer) =>
    [customer.name, customer.email, customer.phone ?? ''].some((value) =>
      value.toLowerCase().includes(query)
    )
  );
  const orderCount = customers.reduce((total, customer) => total + customer.orders.length, 0);
  const orderValue = customers.reduce(
    (total, customer) =>
      total + customer.orders.reduce((customerTotal, order) => customerTotal + order.total, 0),
    0
  );
  const returningCustomers = customers.filter((customer) => customer.orders.length > 0).length;

  const downloadExcel = async () => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const headers = [
      'Customer Name',
      'Email',
      'Phone',
      'Joined',
      'Orders',
      'Total Spent (INR)',
      'Latest Order',
      'Latest Order Status',
    ];
    const rows = filteredCustomers.map((customer) => {
      const latestOrder = customer.orders[0];
      return [
        customer.name,
        customer.email,
        customer.phone ?? '',
        new Date(customer.createdAt),
        customer.orders.length,
        customer.orders.reduce((total, order) => total + order.total, 0),
        latestOrder ? new Date(latestOrder.createdAt) : '',
        latestOrder ? latestOrder.status.replaceAll('_', ' ') : 'No orders',
      ];
    });
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet['!cols'] = [
      { wch: 24 },
      { wch: 32 },
      { wch: 18 },
      { wch: 16 },
      { wch: 10 },
      { wch: 20 },
      { wch: 16 },
      { wch: 28 },
    ];
    sheet['!autofilter'] = { ref: `A1:H${Math.max(rows.length + 1, 1)}` };
    for (let row = 2; row <= rows.length + 1; row += 1) {
      for (const column of ['D', 'G']) {
        const cell = sheet[`${column}${row}`];
        if (cell?.t === 'd') cell.z = 'dd mmm yyyy';
      }
      const amountCell = sheet[`F${row}`];
      if (amountCell) amountCell.z = '₹#,##0';
    }
    XLSX.utils.book_append_sheet(workbook, sheet, 'Customers');

    const file = new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `snack-pod-customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  const loadOrderHistory = async (customerId: string) => {
    setHistoryErrors((errors) => {
      const remaining = { ...errors };
      delete remaining[customerId];
      return remaining;
    });
    if (orderHistories[customerId]) return;

    setLoadingHistoryId(customerId);
    try {
      const result = await adminApi<{ orders: CustomerOrder[] }>(
        `/api/admin/customers/${encodeURIComponent(customerId)}/orders`
      );
      setOrderHistories((histories) => ({ ...histories, [customerId]: result.orders }));
    } catch (loadError) {
      setHistoryErrors((errors) => ({
        ...errors,
        [customerId]:
          loadError instanceof Error ? loadError.message : 'Failed to load order history',
      }));
    } finally {
      setLoadingHistoryId((currentId) => (currentId === customerId ? null : currentId));
    }
  };

  const toggleOrderHistory = (customerId: string) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null);
      return;
    }

    setExpandedCustomerId(customerId);
    void loadOrderHistory(customerId);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Customer Records
          </span>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Customer Data</h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer contact details and order history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => {
              void downloadExcel().catch((exportError: unknown) => {
                setError(
                  exportError instanceof Error
                    ? `Failed to create Excel export: ${exportError.message}`
                    : 'Failed to create Excel export'
                );
              });
            }}
            disabled={loading || filteredCustomers.length === 0}
            title={`Download ${filteredCustomers.length} customer records${query ? ' matching your search' : ''}`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Excel
          </button>
          <button
            type="button"
            onClick={() => void loadCustomers()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          <span>{error}</span>
          <button type="button" onClick={() => void loadCustomers()} className="font-bold underline">
            Try again
          </button>
        </div>
      )}

      <section aria-label="Customer statistics" className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total customers', value: customers.length.toLocaleString('en-IN') },
          { label: 'Customers with orders', value: returningCustomers.toLocaleString('en-IN') },
          { label: 'Orders recorded', value: orderCount.toLocaleString('en-IN') },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {loading ? '—' : stat.value}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Customers</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Recorded order value: {loading ? '—' : formatCurrency(orderValue)}
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, or phone"
            aria-label="Search customers"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3">Orders</th>
                <th scope="col" className="px-4 py-3">Order value</th>
                <th scope="col" className="px-4 py-3">Latest order</th>
                <th scope="col" className="px-4 py-3 text-right">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Loading customer records…
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {customers.length ? 'No customers match your search.' : 'No customer records yet.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const customerOrderValue = customer.orders.reduce(
                    (total, order) => total + order.total,
                    0
                  );
                  const isExpanded = expandedCustomerId === customer.id;

                  return (
                    <React.Fragment key={customer.id}>
                      <tr className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{customer.name}</p>
                          <p className="text-xs text-slate-500">{customer.email}</p>
                          {customer.phone && <p className="text-xs text-slate-500">{customer.phone}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(customer.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-semibold">{customer.orders.length}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {formatCurrency(customerOrderValue)}
                        </td>
                        <td className="px-4 py-3">
                          {customer.orders[0] ? (
                            <>
                              <p className="font-medium text-slate-800">
                                {customer.orders[0].status.replaceAll('_', ' ')}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatDate(customer.orders[0].createdAt)}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-400">No orders</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleOrderHistory(customer.id)}
                            disabled={customer.orders.length === 0}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
                          >
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="space-y-3">
                              {loadingHistoryId === customer.id ? (
                                <p className="py-3 text-center text-sm text-slate-500">
                                  Loading order history…
                                </p>
                              ) : historyErrors[customer.id] && !orderHistories[customer.id] ? (
                                <div
                                  role="alert"
                                  className="flex items-center justify-between gap-3 text-sm text-rose-700"
                                >
                                  <span>{historyErrors[customer.id]}</span>
                                  <button
                                    type="button"
                                    onClick={() => void loadOrderHistory(customer.id)}
                                    className="font-bold underline"
                                  >
                                    Try again
                                  </button>
                                </div>
                              ) : (
                                (orderHistories[customer.id] ?? []).map((order) => (
                                  <article
                                    key={order.id}
                                    className="rounded-lg border border-slate-200 bg-white p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="font-bold text-slate-900">
                                          {order.status.replaceAll('_', ' ')} ·{' '}
                                          {formatCurrency(order.total)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {formatDate(order.createdAt)}
                                          {order.branch ? ` · ${order.branch.name}` : ''}
                                          {` · ${order.paymentMethod.replaceAll('_', ' ')}`}
                                        </p>
                                      </div>
                                      <span className="font-mono text-xs text-slate-400">
                                        {order.id.slice(-8)}
                                      </span>
                                    </div>
                                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                      {order.items.map((item) => (
                                        <li key={item.id}>
                                          {item.quantity} × {item.name} ·{' '}
                                          {formatCurrency(item.total)}
                                        </li>
                                      ))}
                                    </ul>
                                  </article>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
