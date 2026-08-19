'use client';
import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/lib/cart-context';

/**
 * Persistent floating cart summary — rendered globally from the root layout so it
 * appears on every page once the cart has items. Bottom-center on mobile,
 * bottom-right on larger screens, with a slide-up entrance.
 *
 * When any line is unavailable (server CartLine.isAvailable === false, or the
 * guest cart's best-effort check against the live menu), the checkout entry is
 * disabled and the pill opens the cart drawer instead so the customer can remove
 * the offending line.
 */
export default function GlobalFloatingCart() {
  const { itemCount, subtotal, hasUnavailableItems, openCartDrawer } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 animate-fade-in-up">
      {hasUnavailableItems ? (
        <button
          type="button"
          onClick={openCartDrawer}
          className="flex items-center gap-3 px-5 sm:px-6 py-3 bg-stone-200 text-stone-600 rounded-full shadow-xl font-bold text-sm cursor-pointer hover:bg-stone-300 transition-colors"
        >
          <div className="flex items-center gap-1">
            <Icon name="ShoppingCartIcon" size={18} />
            <span className="bg-white text-stone-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold">
              {itemCount}
            </span>
          </div>
          <span className="hidden sm:inline">
            Some items unavailable · ₹{subtotal}
          </span>
          <span className="ml-1">Fix cart</span>
        </button>
      ) : (
        <Link
          href="/checkout"
          className="flex items-center gap-3 px-5 sm:px-6 py-3 bg-primary text-primary-foreground rounded-full shadow-2xl shadow-primary/30 font-bold text-sm hover:bg-accent transition-colors btn-spring"
        >
          <div className="flex items-center gap-1">
            <Icon name="ShoppingCartIcon" size={18} />
            <span className="bg-white text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold">
              {itemCount}
            </span>
          </div>
          <span className="hidden sm:inline">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · ₹{subtotal}
          </span>
          <span className="ml-1">→ Checkout</span>
        </Link>
      )}
    </div>
  );
}
