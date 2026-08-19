'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import AddressForm from '@/components/ui/AddressForm';
import { useAuth } from '@/lib/auth-context';
import { useOrders } from '@/lib/orders-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useToast } from '@/lib/toast-context';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
  formValuesToInput,
  type Address,
  type AddressFormValues,
} from '@/lib/addresses';

export default function AccountPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const { orders } = useOrders();
  const { count: wishlistCount } = useWishlist();
  const { showToast } = useToast();
  const router = useRouter();

  // ── Real saved addresses (GET /api/addresses) ──────────────────────────
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refreshAddresses = useCallback(async () => {
    try {
      setAddresses(await listAddresses());
    } catch {
      showToast("Couldn't load your saved addresses.", 'error');
    } finally {
      setAddressesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  const handleAddAddress = useCallback(
    async (values: AddressFormValues) => {
      await createAddress(formValuesToInput(values));
      await refreshAddresses();
      setShowAddAddr(false);
      showToast('New address saved! 📍');
    },
    [refreshAddresses, showToast]
  );

  const handleUpdateAddress = useCallback(
    async (id: string, values: AddressFormValues) => {
      await updateAddress(id, formValuesToInput(values));
      await refreshAddresses();
      setEditingId(null);
      showToast('Address updated.');
    },
    [refreshAddresses, showToast]
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      await updateAddress(id, { isDefault: true });
      await refreshAddresses();
      showToast('Default delivery address updated!');
    },
    [refreshAddresses, showToast]
  );

  const removeAddress = useCallback(
    async (id: string) => {
      await deleteAddress(id);
      await refreshAddresses();
      showToast('Address removed');
    },
    [refreshAddresses, showToast]
  );

  // Neutral state while the session is being hydrated from the refresh
  // cookie — prevents flashing the signed-out screen to a logged-in user.
  // (The middleware already redirects truly signed-out visitors to /auth.)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <main className="flex-1 flex items-center justify-center py-24">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <Header />
        <main className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-orange-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
            👤
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2">My Account</h1>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Please sign in to view your profile, manage saved delivery addresses, and track order
            receipts.
          </p>
          <Link
            href="/signin?returnUrl=/account"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-extrabold text-sm rounded-xl hover:bg-accent transition-all shadow-lg shadow-primary/25"
          >
            <Icon name="UserIcon" size={18} />
            <span>Sign In to Continue</span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Card Header */}
        <section className="bg-white rounded-3xl border border-border shadow-sm p-6 sm:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-100/50 rounded-full blur-3xl -z-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                user?.name?.[0]?.toUpperCase() || 'U'
              )}
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-foreground">{user?.name}</h1>
                <span className="px-2.5 py-0.5 bg-orange-100 text-primary text-[11px] font-extrabold rounded-full">
                  Verified Foodie 🍔
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {user?.email || user?.phone}
              </p>
              <p className="text-[11px] text-stone-400 mt-2">
                Member since August 2026 · {orders.length} orders placed
              </p>
            </div>

            <button
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Icon name="ArrowRightOnRectangleIcon" size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </section>

        {/* Quick Navigation Stats Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <Link
            href="/orders"
            className="p-5 bg-white rounded-2xl border border-border shadow-sm hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🛍️</span>
              <span className="text-xs font-black text-primary group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
            <p className="text-lg font-black text-foreground">{orders.length}</p>
            <p className="text-xs text-muted-foreground font-semibold">Total Orders</p>
          </Link>

          <Link
            href="/favourites"
            className="p-5 bg-white rounded-2xl border border-border shadow-sm hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">❤️</span>
              <span className="text-xs font-black text-primary group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
            <p className="text-lg font-black text-foreground">{wishlistCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">Saved Favourites</p>
          </Link>

          <Link
            href="/offers"
            className="p-5 bg-white rounded-2xl border border-border shadow-sm hover:border-primary/50 transition-all group col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🎟️</span>
              <span className="text-xs font-black text-primary group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
            <p className="text-lg font-black text-foreground">WELCOME20</p>
            <p className="text-xs text-muted-foreground font-semibold">Active Coupons</p>
          </Link>
        </section>

        {/* Saved Addresses Section */}
        <section className="bg-white rounded-3xl border border-border p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-black text-foreground">Saved Delivery Addresses</h2>
              <p className="text-xs text-muted-foreground">Manage addresses for fast checkout</p>
            </div>
            <button
              onClick={() => {
                setShowAddAddr(!showAddAddr);
                setEditingId(null);
              }}
              className="px-3.5 py-2 bg-orange-50 text-primary font-bold text-xs rounded-xl hover:bg-orange-100 transition-colors flex items-center gap-1"
            >
              <Icon name="PlusIcon" size={16} />
              <span>Add New</span>
            </button>
          </div>

          {/* Add Address Form */}
          {showAddAddr && (
            <div className="mb-6 p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3 animate-fade-in-up">
              <p className="text-sm font-bold text-foreground">New Address</p>
              <AddressForm
                submitLabel="Save Address"
                cancelLabel="Cancel"
                onCancel={() => setShowAddAddr(false)}
                onSubmit={handleAddAddress}
              />
            </div>
          )}

          {/* Address List */}
          {addressesLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Loading your addresses…</span>
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">📍</p>
              <p className="text-sm font-bold text-foreground mb-1">No saved addresses</p>
              <p className="text-xs text-muted-foreground">
                Add one for faster checkout.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => {
                const addressLine = [addr.line1, addr.line2].filter(Boolean).join(', ');
                const location = [addr.city, addr.state].filter(Boolean).join(', ');
                const icon =
                  (addr.label || '').toLowerCase().includes('work') ||
                  (addr.label || '').toLowerCase().includes('office')
                    ? '💼'
                    : (addr.label || '').toLowerCase().includes('home')
                      ? '🏠'
                      : '📍';
                return (
                  <div key={addr.id}>
                    <div className="p-4 rounded-2xl border border-stone-200 flex items-start justify-between gap-3 bg-stone-50/50">
                      <div className="flex items-start gap-3">
                        <span className="p-2 bg-white rounded-xl text-lg shadow-sm border border-stone-100">
                          {icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-foreground">
                              {addr.label || 'Address'}
                            </span>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                            {addressLine}, {location} — {addr.pincode}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!addr.isDefault && (
                          <button
                            onClick={() => void setDefaultAddress(addr.id)}
                            className="text-xs font-bold text-primary hover:underline px-1.5"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => setEditingId(editingId === addr.id ? null : addr.id)}
                          aria-label={`Edit ${addr.label || 'address'}`}
                          className="p-1.5 text-stone-400 hover:text-primary rounded-lg transition-colors"
                        >
                          <Icon name="PencilIcon" size={16} />
                        </button>
                        <button
                          onClick={() => void removeAddress(addr.id)}
                          aria-label={`Delete ${addr.label || 'address'}`}
                          className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Icon name="TrashIcon" size={16} />
                        </button>
                      </div>
                    </div>
                    {editingId === addr.id && (
                      <div className="mt-2 p-4 bg-white rounded-2xl border border-stone-200">
                        <p className="text-sm font-bold text-foreground mb-3">Edit Address</p>
                        <AddressForm
                          initial={addr}
                          submitLabel="Save Changes"
                          cancelLabel="Cancel"
                          onCancel={() => setEditingId(null)}
                          onSubmit={(values) => handleUpdateAddress(addr.id, values)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
