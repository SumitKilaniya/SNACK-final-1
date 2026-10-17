'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api-client';
import { useAuth } from './auth-context';
import type { OrderListItem } from './order-types';

/**
 * Order history (Phase 5) — real data from GET /api/orders
 * (src/lib/orders.ts's listCustomerOrders: the caller's own orders, newest
 * first, with items + branch + statusLogs). No fake generation, no
 * auto-advancing status timer, no client-side order mutations — the backend is
 * the only source of truth. Live status for non-terminal orders is handled by
 * the list page via useOrderStream (see src/app/orders/page.tsx).
 *
 * Status labels/styles are NOT defined here — consume the canonical maps from
 * src/lib/order-types.ts (ORDER_STATUS_LABEL / STATUS_BADGE_STYLE /
 * TERMINAL_STATUSES) so list and detail never drift.
 */

interface OrdersContextValue {
  /** The customer's real orders, newest first (server-ordered). */
  orders: OrderListItem[];
  /** True once the first fetch attempt has finished (success OR failure). */
  isHydrated: boolean;
  /** True while GET /api/orders is in flight. */
  isLoading: boolean;
  /** Non-null when the orders couldn't be loaded. */
  error: string | null;
  /** Re-run the fetch (shown in the error state). */
  retry: () => void;
  /** Re-fetch silently (no spinner) — safe to call after placing an order. */
  refresh: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const requestRef = useRef(0);

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    const requestId = ++requestRef.current;
    if (!opts.silent) setIsLoading(true);
    setError(null);
    try {
      const data = await api.authenticatedFetch<{ orders: OrderListItem[] }>('/api/orders');
      if (requestId !== requestRef.current) return;
      setOrders(data.orders);
    } catch (e) {
      if (requestId !== requestRef.current) return;
      // Session-expired 401s are handled by the auth layer (signed-out UI);
      // anything else surfaces as a retryable load error.
      setError(e instanceof Error ? e.message : "Couldn't load your orders.");
    } finally {
      if (requestId === requestRef.current) {
        setIsLoading(false);
        setIsHydrated(true);
      }
    }
  }, []);

  // Wait for session hydration and fetch again whenever a customer signs in.
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      requestRef.current += 1;
      fetchedRef.current = false;
      setOrders([]);
      setError(null);
      setIsLoading(false);
      setIsHydrated(true);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void load();
  }, [authLoading, isLoggedIn, load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) return;
    await load({ silent: true });
  }, [isLoggedIn, load]);

  const value = useMemo<OrdersContextValue>(
    () => ({ orders, isHydrated, isLoading, error, retry, refresh }),
    [orders, isHydrated, isLoading, error, retry, refresh]
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}
