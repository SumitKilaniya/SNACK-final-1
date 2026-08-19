'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiClientError } from '@/lib/api-client';
import * as api from '@/lib/api-client';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  preferredAddressId,
  updateAddress,
  formValuesToInput,
  type Address,
  type AddressFormValues,
} from '@/lib/addresses';
import type { CheckoutResponse, CouponPreview } from '@/lib/order-types';
import { DELIVERY_FEE } from '@/lib/menu-data';
import OrderSummary from '@/app/checkout/components/OrderSummary';
import DeliveryOptions from '@/app/checkout/components/DeliveryOptions';
import PaymentSection from '@/app/checkout/components/PaymentSection';

/** Full-page empty state — shown when checkout is reached with nothing in the cart. */
function EmptyCartState() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-16 sm:py-24 flex justify-center">
      <div className="w-full max-w-md bg-white rounded-3xl border border-border shadow-sm p-10 text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-orange-50 flex items-center justify-center text-4xl">
          🛒
        </div>
        <h1 className="text-xl font-extrabold text-foreground mb-2">Your cart is empty</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-7">
          Nothing here yet — add something tasty from the menu and it&apos;ll show up in your cart.
        </p>
        <Link
          href="/menu"
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-accent transition-colors btn-spring"
        >
          Browse Menu
          <Icon name="ArrowRightIcon" size={16} />
        </Link>
        <Link href="/offers" className="inline-block mt-4 text-xs font-semibold text-primary hover:underline">
          Or grab a coupon first →
        </Link>
      </div>
    </main>
  );
}

/** Signed-out gate — the middleware normally redirects, this is defense in depth. */
function SignedOutState() {
  return (
    <main className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 bg-orange-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
        🔐
      </div>
      <h1 className="text-2xl font-black text-foreground mb-2">Sign in to check out</h1>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Your guest cart is saved — sign in and it will be merged into your account cart before you
        place the order.
      </p>
      <Link
        href="/auth?returnUrl=/checkout"
        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-extrabold text-sm rounded-xl hover:bg-accent transition-all shadow-lg shadow-primary/25"
      >
        <Icon name="UserIcon" size={18} />
        <span>Sign In to Continue</span>
      </Link>
    </main>
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Idempotency key — created once per checkout attempt and held in sessionStorage
 * so a page reload keeps the same key (a reloaded submit returns the SAME order
 * instead of creating a duplicate). It is only regenerated after a fully
 * successful placement, so a double-click or a retry never creates two orders.
 */
const IDEMPOTENCY_KEY_STORAGE = 'snackpod_checkout_idempotency_key';

function loadOrCreateIdempotencyKey(): string {
  try {
    const existing = window.sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
    if (existing && existing.length >= 8) return existing;
  } catch {
    /* storage unavailable — fall through to a fresh key */
  }
  const key = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, key);
  } catch {
    /* sessionStorage unavailable — the in-flight disable still prevents double-submit */
  }
  return key;
}

function resetIdempotencyKey(): void {
  try {
    window.sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export default function CheckoutClient() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const {
    itemCount,
    isHydrated,
    subtotal,
    hasUnavailableItems,
    cartBranchId,
    appliedOffer,
    clearOffer,
    clearCart,
  } = useCart();

  // ── Addresses (real GET /api/addresses) ────────────────────────────────
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // ── Coupon (POST /api/coupons/validate — preview only, labeled as estimate) ──
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponValidatedSubtotal, setCouponValidatedSubtotal] = useState<number | null>(null);

  // ── Checkout submission ────────────────────────────────────────────────
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerPrefilledRef = useRef(false);

  // Load saved addresses once; preselect the default.
  useEffect(() => {
    let cancelled = false;
    listAddresses()
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        setSelectedAddressId(preferredAddressId(list));
      })
      .catch(() => {
        if (cancelled) return;
        setError("We couldn't load your saved addresses. Please refresh and try again.");
      })
      .finally(() => {
        if (!cancelled) setAddressesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAddresses = useCallback(async (): Promise<Address[]> => {
    const list = await listAddresses();
    setAddresses(list);
    setSelectedAddressId((prev) => {
      if (prev && list.some((a) => a.id === prev)) return prev;
      return preferredAddressId(list);
    });
    return list;
  }, []);

  const handleCreateAddress = useCallback(
    async (values: AddressFormValues) => {
      await createAddress(formValuesToInput(values));
      await refreshAddresses();
      showToast('Address saved!');
    },
    [refreshAddresses, showToast]
  );

  const handleUpdateAddress = useCallback(
    async (id: string, values: AddressFormValues) => {
      await updateAddress(id, formValuesToInput(values));
      await refreshAddresses();
      showToast('Address updated.');
    },
    [refreshAddresses, showToast]
  );

  const handleDeleteAddress = useCallback(
    async (id: string) => {
      await deleteAddress(id);
      await refreshAddresses();
      showToast('Address removed.');
    },
    [refreshAddresses, showToast]
  );

  /* ── Coupon: validate against the real API (estimate only) ────────────── */

  const validateCoupon = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || !cartBranchId) return;
      setCouponBusy(true);
      setCouponError(null);
      try {
        const res = await api.authenticatedFetch<CouponPreview>('/api/coupons/validate', {
          method: 'POST',
          body: JSON.stringify({
            code: trimmed,
            branchId: cartBranchId,
            subtotal,
            deliveryFee: DELIVERY_FEE,
          }),
        });
        setCouponCode(trimmed);
        setCouponPreview(res);
        setCouponValidatedSubtotal(subtotal);
      } catch (e) {
        setCouponCode(trimmed);
        setCouponPreview(null);
        setCouponValidatedSubtotal(null);
        setCouponError(errorMessage(e));
      } finally {
        setCouponBusy(false);
      }
    },
    [cartBranchId, subtotal]
  );

  // If the customer applied an offer on the Offers page, prefill + validate it
  // once so the checkout box reflects it honestly (the real DB coupon wins).
  useEffect(() => {
    if (offerPrefilledRef.current || !appliedOffer?.code || !cartBranchId) return;
    offerPrefilledRef.current = true;
    setCouponCode(appliedOffer.code);
    void validateCoupon(appliedOffer.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedOffer?.code, cartBranchId]);

  const handleClearCoupon = useCallback(() => {
    setCouponCode('');
    setCouponPreview(null);
    setCouponError(null);
    setCouponValidatedSubtotal(null);
  }, []);

  const couponStale =
    couponPreview !== null &&
    couponValidatedSubtotal !== null &&
    couponValidatedSubtotal !== subtotal;

  /* ── Real checkout submission ─────────────────────────────────────────── */

  const handlePlaceOrder = useCallback(async () => {
    if (placing || !user) return;
    if (!selectedAddressId) {
      setError('Please choose a delivery address first.');
      return;
    }
    setError(null);
    setPlacing(true);
    try {
      const idempotencyKey = loadOrCreateIdempotencyKey();
      const res = await api.authenticatedFetch<CheckoutResponse>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod: 'cod',
          notes: notes.trim() ? notes.trim() : undefined,
          idempotencyKey,
          couponCode: couponCode.trim() ? couponCode.trim() : undefined,
        }),
      });
      // Success: the order is real. Regenerate the key so the next checkout
      // starts fresh; sync the cart UI (the server already cleared the cart).
      resetIdempotencyKey();
      clearOffer();
      clearCart();
      showToast(
        res.duplicated ? 'Your order was already placed — taking you to it.' : 'Order placed! 🎉'
      );
      router.push(`/orders/${res.order.id}`);
    } catch (e) {
      // Surface the API's actual reason (rate limit, invalid coupon, address
      // not found, item unavailable…) — never a generic fallback.
      setError(errorMessage(e));
      setPlacing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing, user, selectedAddressId, notes, couponCode, clearOffer, clearCart, showToast, router]);

  if (authLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-16 flex justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading your session…</p>
        </div>
      </main>
    );
  }

  if (!isHydrated) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-16 flex justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading your cart…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <SignedOutState />;
  }

  if (itemCount === 0) {
    return <EmptyCartState />;
  }

  const canPlace =
    itemCount > 0 && selectedAddressId !== null && !hasUnavailableItems && !placing;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-foreground mb-6">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Delivery + Payment */}
        <div className="lg:col-span-2 space-y-6">
          {hasUnavailableItems && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl px-3 py-2.5">
              <Icon name="ExclamationTriangleIcon" size={16} className="shrink-0 mt-0.5" />
              <span>
                Some items in your cart are no longer available at this branch — remove them to
                place your order.
              </span>
            </div>
          )}
          <DeliveryOptions
            addresses={addresses}
            loading={addressesLoading}
            selectedAddressId={selectedAddressId}
            onSelectAddress={(id) => {
              setSelectedAddressId(id);
              setError(null);
            }}
            notes={notes}
            onNotesChange={setNotes}
            onCreateAddress={handleCreateAddress}
            onUpdateAddress={handleUpdateAddress}
            onDeleteAddress={handleDeleteAddress}
          />
          <PaymentSection
            placing={placing}
            canPlace={canPlace}
            error={error}
            onPlaceOrder={() => void handlePlaceOrder()}
          />
        </div>
        {/* Right: Order Summary */}
        <div className="lg:col-span-1">
          <OrderSummary
            couponCode={couponCode}
            couponPreview={couponPreview}
            couponError={couponError}
            couponBusy={couponBusy}
            couponStale={couponStale}
            onApplyCoupon={(code) => void validateCoupon(code)}
            onClearCoupon={handleClearCoupon}
          />
        </div>
      </div>
    </main>
  );
}
