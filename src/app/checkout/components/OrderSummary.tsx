'use client';
import React from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { DELIVERY_FEE } from '@/lib/menu-data';
import type { CouponPreview } from '@/lib/order-types';

interface OrderSummaryProps {
  couponCode: string;
  couponPreview: CouponPreview | null;
  couponError: string | null;
  /** True while POST /api/coupons/validate is in flight. */
  couponBusy: boolean;
  /** Cart subtotal changed since the preview was computed — refresh before trusting it. */
  couponStale: boolean;
  onApplyCoupon: (code: string) => void;
  onClearCoupon: () => void;
}

export default function OrderSummary({
  couponCode,
  couponPreview,
  couponError,
  couponBusy,
  couponStale,
  onApplyCoupon,
  onClearCoupon,
}: OrderSummaryProps) {
  const { items, updateQty, itemCount, subtotal } = useCart();
  const [codeInput, setCodeInput] = React.useState(couponCode);

  // Keep the input in sync when the parent clears the applied coupon.
  React.useEffect(() => {
    if (!couponCode) setCodeInput('');
  }, [couponCode]);

  const cartEntries = Object.values(items);
  const deliveryFee = DELIVERY_FEE;

  // Display math mirrors what the server will charge (subtotal + fee − coupon).
  // The discount shown is the /api/coupons/validate ESTIMATE; the real charge
  // always comes from the POST /api/checkout response. No client-side tax is
  // added because the backend does not charge one — server totals win.
  const discount = couponPreview?.discount ?? 0;
  const total = couponPreview ? couponPreview.finalTotal : subtotal + deliveryFee;

  const handleApply = () => {
    const code = codeInput.trim();
    if (!code) return;
    onApplyCoupon(code);
  };

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden sticky top-24 isolate">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-base font-extrabold text-foreground">Order Summary</h2>
        <Link href="/menu" className="text-xs text-primary font-semibold hover:underline">
          + Add items
        </Link>
      </div>

      {cartEntries.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-3xl mb-2">🛒</p>
          <p className="text-sm font-bold text-foreground mb-1">Your cart is empty</p>
          <p className="text-xs text-muted-foreground mb-4">
            Add something tasty from the menu to get started.
          </p>
          <Link
            href="/menu"
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-full hover:bg-accent transition-colors btn-spring"
          >
            Browse Menu
          </Link>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="p-5 space-y-4">
            {cartEntries.map((item) => (
              <div key={item.key} className="flex items-center gap-3 relative z-0">
                <div className="relative z-0 w-14 h-14 rounded-lg overflow-hidden shrink-0">
                  {item.image ? (
                    <AppImage
                      src={item.image}
                      alt={item.imageAlt || item.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center text-muted-foreground">
                      <Icon name="ShoppingBagIcon" size={18} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground leading-tight">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.variant}</p>
                </div>
                {/* Inline qty controls + remove */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.key, -1)}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors text-foreground"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Icon name="MinusIcon" size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.key, 1)}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors text-foreground"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Icon name="PlusIcon" size={12} />
                    </button>
                  </div>
                  <p className="text-sm font-extrabold text-foreground">₹{item.price * item.qty}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon / promo code — validated against the real API */}
          <div className="relative z-0 px-5 pb-4">
            {couponCode ? (
              <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="TagIcon" size={16} className="text-green-700 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-green-700 truncate">{couponCode} applied</p>
                    <p className="text-[11px] text-green-600/80">
                      {couponBusy
                        ? 'Checking code…'
                        : couponPreview
                          ? `You save ₹${couponPreview.discount} (estimate)`
                          : couponError
                            ? couponError
                            : 'Pending validation'}
                    </p>
                    {couponStale && couponPreview && (
                      <p className="text-[11px] text-amber-600 font-semibold">
                        Cart changed — re-apply to refresh the estimate.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClearCoupon}
                  aria-label="Remove coupon"
                  className="text-green-700 hover:text-green-900"
                >
                  <Icon name="XMarkIcon" size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApply();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-secondary text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleApply}
                    disabled={couponBusy || !codeInput.trim()}
                    className="px-4 py-2 bg-secondary text-foreground font-semibold text-sm rounded-lg border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {couponBusy ? '…' : 'Apply'}
                  </button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-600 font-semibold mt-1.5">{couponError}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Coupon discounts are applied when your order is placed — the amount shown is an
                  estimate and the final charge always comes from the confirmed order.
                </p>
              </>
            )}
          </div>

          {/* Price breakdown — mirrors what the server will actually charge */}
          <div className="relative z-0 px-5 pb-5 space-y-2 border-t border-border pt-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal ({itemCount} items)</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery fee</span>
              <span>₹{deliveryFee}</span>
            </div>
            {couponPreview && discount > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-semibold">
                <span>Coupon ({couponCode}) — estimate</span>
                <span>-₹{discount}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-foreground pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">₹{total}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {couponPreview
                ? 'Total is an estimate — the confirmed total on your order receipt is final.'
                : 'Total shown here may differ slightly from your confirmed order total.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
