'use client';
import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface PaymentSectionProps {
  /** True while POST /api/checkout is in flight (blocks double-submit). */
  placing: boolean;
  /** False until an address is chosen and the cart has no unavailable lines. */
  canPlace: boolean;
  /** Specific error message/code from the checkout API (never a generic fallback). */
  error: string | null;
  onPlaceOrder: () => void;
}

/**
 * Phase 4: Cash on Delivery only. Card/Stripe is deliberately deferred — the
 * submit flow lives in CheckoutClient (idempotency key, coupon code, real
 * POST /api/checkout); this component only renders the payment method, the
 * error surface, and the guarded submit button.
 */
export default function PaymentSection({ placing, canPlace, error, onPlaceOrder }: PaymentSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-base font-extrabold text-foreground">Payment Method</h2>
      </div>

      <div className="p-5 space-y-3">
        {/* COD — the only available method this phase */}
        <div className="w-full text-left p-4 rounded-xl border-2 border-primary bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
            <span className="text-lg">💵</span>
            <div>
              <p className="text-sm font-bold text-foreground">Cash on Delivery</p>
              <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground px-1">
          Online card payments are coming soon — for now, all orders are Cash on Delivery.
        </p>
      </div>

      {/* Security note */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="LockClosedIcon" size={14} />
          <span>Your payment details are handled securely</span>
        </div>
      </div>

      {/* Place Order Button */}
      <div className="px-5 pb-6">
        {error && (
          <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-3 py-2.5">
            <Icon name="ExclamationTriangleIcon" size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <button
          onClick={onPlaceOrder}
          disabled={placing || !canPlace}
          className="w-full py-4 bg-primary text-primary-foreground font-extrabold text-base rounded-xl hover:bg-accent transition-colors btn-spring disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {placing ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
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
              Placing Order...
            </>
          ) : (
            <>
              <Icon name="ShoppingBagIcon" size={20} />
              Place Order (COD)
            </>
          )}
        </button>
        <p className="text-xs text-center text-muted-foreground mt-3">
          By placing this order, you agree to our{' '}
          <Link href="/terms" className="text-primary hover:underline">
            Terms & Conditions
          </Link>
        </p>
      </div>
    </div>
  );
}
