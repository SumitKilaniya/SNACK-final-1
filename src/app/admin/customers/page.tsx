'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { adminApi } from '@/lib/admin-api';

interface CustomerOrder {
  id: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  items: { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
  branch: { name: string } | null;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orders: CustomerOrder[];
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

  const downloadExcel = () => {
    const workbook = XLSX.utils.book_new();
    const customerRows = customers.map((customer) => ({
      'Customer ID': customer.id,
      Name: customer.name,
      Email: customer.email,
      Phone: customer.phone ?? '',
      'Joined At': new Date(customer.createdAt),
      'Order Count': customer.orders.length,
      'Recorded Order Value (INR)': customer.orders.reduce(
        (total, order) => total + order.total,
        0
      ),
    }));
    const orderRows = customers.flatMap((customer) =>
      customer.orders.map((order) => ({
        'Customer ID': customer.id,
        'Customer Name': customer.name,
        'Customer Email': customer.email,
        'Order ID': order.id,
        'Order Date': new Date(order.createdAt),
        Status: order.status,
        'Payment Method': order.paymentMethod,
        Branch: order.branch?.name ?? '',
        'Subtotal (INR)': order.subtotal,
        'Delivery Fee (INR)': order.deliveryFee,
        'Discount (INR)': order.discount,
        'Total (INR)': order.total,
      }))
    );
    const itemRows = customers.flatMap((customer) =>
      customer.orders.flatMap((order) =>
        order.items.map((item) => ({
          'Customer Name': customer.name,
          'Customer Email': customer.email,
          'Order ID': order.id,
          'Order Date': new Date(order.createdAt),
          'Item Name': item.name,
          Quantity: item.quantity,
          'Unit Price (INR)': item.unitPrice,
          'Line Total (INR)': item.total,
        }))
      )
    );

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customerRows), 'Customers');
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(orderRows, {
        header: [
          'Customer ID',
          'Customer Name',
          'Customer Email',
          'Order ID',
          'Order Date',
          'Status',
          'Payment Method',
          'Branch',
          'Subtotal (INR)',
          'Delivery Fee (INR)',
          'Discount (INR)',
          'Total (INR)',
        ],
      }),
      'Orders'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(itemRows, {
        header: [
          'Customer Name',
          'Customer Email',
          'Order ID',
          'Order Date',
          'Item Name',
          'Quantity',
          'Unit Price (INR)',
          'Line Total (INR)',
        ],
      }),
      'Order Items'
    );

    const file = new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `snack-pod-customer-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
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
            onClick={downloadExcel}
            disabled={loading || customers.length === 0}
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
                            onClick={() => setExpandedCustomerId(isExpanded ? null : customer.id)}
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
                              {customer.orders.map((order) => (
                                <article
                                  key={order.id}
                                  className="rounded-lg border border-slate-200 bg-white p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="font-bold text-slate-900">
                                        {order.status.replaceAll('_', ' ')} · {formatCurrency(order.total)}
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
                                        {item.quantity} × {item.name} · {formatCurrency(item.total)}
                                      </li>
                                    ))}
                                  </ul>
                                </article>
                              ))}
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