'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/lib/auth-context';
import { useBranches } from '@/lib/branches-context';
import { useCart, type CartItem } from '@/lib/cart-context';
import { useMenu } from '@/lib/menu-context';
import { useOrders } from '@/lib/orders-context';
import { useToast } from '@/lib/toast-context';
import { useOrderStream } from '@/lib/use-order-stream';
import {
  ORDER_STATUS_DESCRIPTION,
  ORDER_STATUS_LABEL,
  STATUS_BADGE_STYLE,
  TERMINAL_STATUSES,
  type OrderListItem,
  type OrderStatus,
} from '@/lib/order-types';

const PAYMENT_LABEL: Record<string, string> = {
  cod: 'Cash on Delivery',
  card: 'Card',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Live status badge for a NON-terminal order: subscribes to the same
 * SSE-stream-with-poll-fallback logic as the detail page (useOrderStream) so
 * the list reflects status changes without a page refresh. Terminal orders
 * render statically — no subscription needed.
 */
function LiveStatusBadge({
  orderId,
  fallbackStatus,
}: {
  orderId: string;
  fallbackStatus: OrderStatus;
}) {
  const { order } = useOrderStream(orderId);
  const status = order?.status ?? fallbackStatus;
  return (
    <span
      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${STATUS_BADGE_STYLE[status]}`}
    >
      {order && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

function OrderCard({
  order,
  onReorder,
}: {
  order: OrderListItem;
  onReorder: (order: OrderListItem) => void;
}) {
  const isTerminal = TERMINAL_STATUSES.has(order.status);
  const paymentLabel = PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod;
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <article className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header — links to the existing live detail page */}
      <Link
        href={`/orders/${order.id}`}
        className="block px-5 py-4 border-b border-stone-100 bg-stone-50/50 hover:bg-orange-50/40 transition-colors"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-black text-foreground">
              Order #{order.id.slice(0, 8).toUpperCase()}
              <Icon name="ArrowRightIcon" size={14} className="inline ml-1.5 text-muted-foreground" />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDateTime(order.createdAt)}
              {order.branch?.name ? ` · ${order.branch.name}` : ''} · {paymentLabel}
            </p>
          </div>
          {isTerminal ? (
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE_STYLE[order.status]}`}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          ) : (
            <LiveStatusBadge orderId={order.id} fallbackStatus={order.status} />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {ORDER_STATUS_DESCRIPTION[order.status]}
        </p>
      </Link>

      {/* Items */}
      <div className="px-5 py-4">
        <div className="space-y-1.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <span className="text-foreground font-medium">
                {item.name}{' '}
                <span className="text-muted-foreground font-bold">× {item.quantity}</span>
              </span>
              <span className="text-foreground font-bold">₹{item.total}</span>
            </div>
          ))}
        </div>

        {/* Totals — server-computed, including any applied discount */}
        <div className="mt-4 pt-3 border-t border-stone-100 space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Subtotal ({totalItems} items)</span>
            <span>₹{order.subtotal}</span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Delivery fee</span>
            <span>₹{order.deliveryFee}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-[11px] text-green-600 font-semibold">
              <span>Coupon discount</span>
              <span>-₹{order.discount}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-extrabold text-foreground pt-1">
            <span>Total</span>
            <span className="text-primary">₹{order.total}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onReorder(order)}
          className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-white font-bold text-xs rounded-xl hover:bg-black transition-colors btn-spring"
        >
          <Icon name="ArrowPathIcon" size={14} />
          <span>Reorder</span>
        </button>
        <Link
          href={`/orders/${order.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          View details
          <Icon name="ArrowRightIcon" size={13} />
        </Link>
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const { orders, isHydrated, isLoading, error, retry } = useOrders();
  const { addItem, cartBranchId, requestBranchSwitch } = useCart();
  const { getDishById, isHydrated: menuHydrated } = useMenu();
  const { selectedBranch } = useBranches();
  const { showToast } = useToast();

  // A reorder waits for the target branch's menu before resolving items, so
  // availability is checked against the branch the items will actually be
  // added to (which may differ from the current one until a switch confirms).
  const pendingReorderRef = useRef<OrderListItem | null>(null);

  const resolveReorderItems = useCallback(
    (order: OrderListItem): { ok: { item: Omit<CartItem, 'qty'>; qty: number }[]; skipped: string[] } => {
      const ok: { item: Omit<CartItem, 'qty'>; qty: number }[] = [];
      const skipped: string[] = [];
      for (const line of order.items) {
        // Match against the REAL menu by DB item id (Phase 3 cart items).
        const dish = line.itemId ? getDishById(line.itemId) : undefined;
        if (!dish || dish.inStock === false) {
          skipped.push(line.name);
          continue;
        }
        ok.push({
          item: {
            key: dish.id ?? dish.key,
            name: dish.name,
            price: dish.price,
            image: dish.image,
            imageAlt: dish.imageAlt ?? dish.name,
            variant: 'Reorder',
          },
          qty: line.quantity,
        });
      }
      return { ok, skipped };
    },
    [getDishById]
  );

  const commitReorder = useCallback(
    (order: OrderListItem) => {
      const { ok, skipped } = resolveReorderItems(order);
      if (ok.length === 0) {
        showToast(
          skipped.length > 0
            ? `Couldn't re-add anything from that order — no longer on this branch's menu: ${skipped.join(', ')}`
            : "Couldn't re-add items from that order.",
          'error'
        );
        return;
      }
      for (const { item, qty } of ok) addItem(item, qty);
      if (skipped.length > 0) {
        showToast(
          `Added ${ok.length} item${ok.length > 1 ? 's' : ''} — couldn't re-add: ${skipped.join(', ')}.`,
          'info'
        );
      } else {
        showToast('Order items added to your cart! 🛒', 'success');
      }
      router.push('/checkout');
    },
    [resolveReorderItems, addItem, showToast, router]
  );

  const handleReorder = useCallback(
    (order: OrderListItem) => {
      // Stage the reorder; the watcher effect below commits it once the menu
      // for the target branch is loaded.
      pendingReorderRef.current = order;
      const targetBranchId = order.branchId ?? null;
      const currentBranchId = cartBranchId ?? selectedBranch?.id ?? null;
      if (targetBranchId && currentBranchId && targetBranchId !== currentBranchId) {
        // Different branch → reuse the cart's existing branch-switch confirm
        // dialog ("switching will clear your cart"). Nothing is added unless
        // the customer confirms; cancelling discards the staged reorder.
        requestBranchSwitch(targetBranchId, {
          onCancelled: () => {
            pendingReorderRef.current = null;
          },
        });
      }
    },
    [cartBranchId, selectedBranch?.id, requestBranchSwitch]
  );

  // Commit the staged reorder only when the menu is hydrated for the target
  // branch — after a confirmed switch, menu-context refetches for the new
  // branch; until then availability checks would be against the wrong branch.
  useEffect(() => {
    const pending = pendingReorderRef.current;
    if (!pending) return;
    if (!menuHydrated) return;
    if (pending.branchId && selectedBranch?.id !== pending.branchId) return;
    pendingReorderRef.current = null;
    commitReorder(pending);
  }, [menuHydrated, selectedBranch?.id, commitReorder]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page title row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">Order History</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoggedIn
                ? `Welcome back, ${user?.name} — your receipts and live order status`
                : 'Track and reorder your favourite Snack-Pod meals.'}
            </p>
          </div>
          <Link
            href="/menu"
            className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-full hover:bg-accent transition-colors shadow-md shadow-primary/20 btn-spring"
          >
            Order Now 🍔
          </Link>
        </div>

        {!isLoggedIn ? (
          /* Signed-out gate (the middleware normally redirects — defense in depth) */
          <div className="text-center py-16 px-6 bg-white rounded-3xl border border-border shadow-sm max-w-lg mx-auto my-8">
            <div className="w-16 h-16 bg-orange-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              🔐
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-2">
              Sign in to view your orders
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Log in to your Snack-Pod account to track active deliveries and view receipts.
            </p>
            <Link
              href="/auth?returnUrl=/orders"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-[#C94816] transition-all shadow-md shadow-primary/20"
            >
              <Icon name="UserIcon" size={18} />
              <span>Sign In to Continue</span>
            </Link>
          </div>
        ) : !isHydrated ? (
          /* First load */
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-4">Loading your orders…</p>
            </div>
          </div>
        ) : error ? (
          /* Load failed — retry, never a silent blank list */
          <div className="text-center py-20 bg-white rounded-3xl border border-border shadow-sm">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <p className="text-lg font-black text-foreground mb-1">Couldn&apos;t load your orders</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {error}
            </p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-accent transition-colors"
            >
              <Icon name="ArrowPathIcon" size={16} />
              Try again
            </button>
          </div>
        ) : orders.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20 bg-white rounded-3xl border border-border shadow-sm">
            <p className="text-5xl mb-3">📦</p>
            <p className="text-lg font-black text-foreground mb-1">No orders placed yet</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              When you place an order through checkout, it will appear here with live tracking!
            </p>
            <Link
              href="/menu"
              className="inline-block px-7 py-3 bg-primary text-white font-bold text-sm rounded-full hover:bg-accent transition-colors shadow-md shadow-primary/20 btn-spring"
            >
              Explore Menu
            </Link>
          </div>
        ) : (
          /* All orders, newest first (server-ordered — no client re-sorting).
             Flat list so a later pagination phase can swap in paging without
             restructuring the cards. */
          <div className="space-y-4">
            {isLoading && (
              <p className="text-xs text-muted-foreground text-center">Refreshing…</p>
            )}
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onReorder={handleReorder} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
