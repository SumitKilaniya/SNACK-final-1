'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { useOrders } from '@/lib/orders-context';
import {
  ORDER_STATUS_LABEL,
  TERMINAL_STATUSES,
  type OrderListItem,
} from '@/lib/order-types';
import { useOrderStream } from '@/lib/use-order-stream';

function ActiveOrderTracker({ order }: { order: OrderListItem }) {
  const { order: liveOrder, mode } = useOrderStream(order.id);
  const { itemCount } = useCart();
  const currentOrder = liveOrder ?? order;

  if (TERMINAL_STATUSES.has(currentOrder.status)) return null;

  return (
    <Link
      href={`/orders/${encodeURIComponent(order.id)}`}
      aria-label={`Track order ${order.id.slice(0, 8)}: ${ORDER_STATUS_LABEL[currentOrder.status]}`}
      className={`fixed left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-orange-200 bg-white px-4 py-3 text-left shadow-xl shadow-stone-900/10 transition hover:-translate-y-0.5 hover:shadow-2xl sm:left-auto sm:right-6 sm:translate-x-0 ${
        itemCount > 0 ? 'bottom-20' : 'bottom-4'
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-primary">
        <Icon name="TruckIcon" size={19} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          Track your order
        </span>
        <span className="block max-w-[min(65vw,18rem)] truncate text-sm font-extrabold text-foreground">
          {ORDER_STATUS_LABEL[currentOrder.status]}
          <span className="font-semibold text-muted-foreground">
            {' '}· #{order.id.slice(0, 6).toUpperCase()}
          </span>
        </span>
      </span>
      {mode === 'live' && (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
          aria-label="Live status"
          title="Live status"
        />
      )}
      <Icon name="ChevronRightIcon" size={17} className="shrink-0 text-primary" />
    </Link>
  );
}

export default function FloatingOrderTracker() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const { orders, isHydrated, refresh } = useOrders();
  const previousPathname = useRef(pathname);
  const refreshAfterNavigation = useRef(false);

  useEffect(() => {
    const enteredOrderPage =
      pathname?.startsWith('/orders/') &&
      pathname !== previousPathname.current &&
      !previousPathname.current?.startsWith('/orders/');
    previousPathname.current = pathname;
    if (enteredOrderPage) refreshAfterNavigation.current = true;
    if (!isLoggedIn || !isHydrated || !refreshAfterNavigation.current) return;
    refreshAfterNavigation.current = false;
    void refresh();
  }, [isHydrated, isLoggedIn, pathname, refresh]);

  if (
    !isLoggedIn ||
    pathname === '/orders' ||
    pathname?.startsWith('/orders/')
  ) {
    return null;
  }

  const activeOrder = orders.find((order) => !TERMINAL_STATUSES.has(order.status));
  return activeOrder ? <ActiveOrderTracker order={activeOrder} /> : null;
}
