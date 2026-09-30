'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type CustomerOrder = {
  id: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
  branch: {
    name: string;
  };
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orders: CustomerOrder[];
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await adminApi<{ customers: Customer[] }>(
        '/api/admin/customers'
      );

      setCustomers(data.customers ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load customer data'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusLabel = (status: string) =>
    status.replaceAll('_', ' ');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Customer Management
          </span>

          <h1 className="text-2xl font-black text-slate-900 mt-1">
            Customer Data
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            Customer profiles with complete order history.
          </p>
        </div>

        <button
          type="button"
          className="px-4 py-2.5 bg-primary text-primary-foreground font-extrabold text-sm rounded-xl shadow-md flex items-center gap-2"
        >
          <Icon name="Download" className="w-4 h-4" />
          Download Excel
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
            >
              <div className="skeleton h-8 w-64 rounded-xl" />
              <div className="skeleton h-12 w-full rounded-xl" />
              <div className="skeleton h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Icon
            name="Users"
            className="w-10 h-10 mx-auto text-slate-300"
          />

          <h2 className="font-black text-slate-800 mt-3">
            No customers found
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Customer orders will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {customers.map((customer) => (
            <section
              key={customer.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
            >

              {/* Customer Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {customer.name}
                    </h2>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                      <span>
                        Mobile: {customer.phone || 'Not provided'}
                      </span>

                      <span>
                        Email: {customer.email}
                      </span>

                      <span className="font-bold text-slate-700">
                        Total Orders: {customer.orders.length}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-500">
                    Customer since{' '}
                    {new Date(customer.createdAt).toLocaleDateString('en-IN')}
                  </div>

                </div>
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">
                        Order ID
                      </th>

                      <th className="px-4 py-3.5">
                        Date & Time
                      </th>

                      <th className="px-4 py-3.5">
                        Items Ordered
                      </th>

                      <th className="px-4 py-3.5">
                        Amount
                      </th>

                      <th className="px-4 py-3.5">
                        Payment
                      </th>

                      <th className="px-4 py-3.5">
                        Outlet
                      </th>

                      <th className="px-4 py-3.5">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {customer.orders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50 transition-colors"
                      >

                        <td className="px-4 py-4">
                          <span className="font-bold text-slate-800">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                          {formatDate(order.createdAt)}
                        </td>

                        <td className="px-4 py-4 min-w-[280px]">
                          <div className="space-y-1">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-4"
                              >
                                <span className="font-semibold text-slate-800">
                                  {item.name}
                                </span>

                                <span className="text-slate-500 whitespace-nowrap">
                                  × {item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-black text-slate-900">
                            ₹{order.total.toLocaleString('en-IN')}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="uppercase text-[10px] font-bold text-slate-600">
                            {order.paymentMethod}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                          {order.branch.name}
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                            {statusLabel(order.status)}
                          </span>
                        </td>

                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>

            </section>
          ))}

        </div>
      )}

    </div>
  );
}