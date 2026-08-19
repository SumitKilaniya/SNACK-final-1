'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Offer } from './menu-data';
import { getCategory } from './menu-data';
import { useAuth } from './auth-context';
import { useBranches } from './branches-context';
import { useMenu } from './menu-context';
import { useToast } from './toast-context';
import * as api from './api-client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

/**
 * Cart context — two modes behind one stable API surface:
 *
 *  - GUEST (no authenticated session): the cart lives in React state +
 *    localStorage (`sp_guest_cart`) and mirrors the server's CartSummary shape.
 *    It is tied to exactly one branchId and is NEVER sent anywhere or trusted
 *    for a purchase — it exists so a logged-out visitor can build a cart before
 *    signing in. Unit prices come from menu-context's fetched /api/menu data
 *    for the selected branch (never separate pricing logic), so they match what
 *    the server would compute.
 *  - SERVER (authenticated): the cart is the real backend cart. We hydrate from
 *    GET /api/cart, every mutation goes through the cart routes (POST/PATCH/
 *    DELETE), and prices/isAvailable are always whatever the server returned —
 *    an optimistic update is applied immediately for responsiveness but is
 *    ALWAYS overwritten by the server response, never the final state.
 *
 * On login/register (any time a session is established, including silent
 * refresh hydration) a non-empty guest cart is merged into the real cart — or
 * discarded with an explanatory toast when the server cart is on a different
 * branch. After merge or discard the guest storage is cleared completely.
 */

export interface CartItem {
  /** Unique dishId — shared across every section of the app (menu, home, combos). */
  key: string;
  /** Real DB item id (server cart lines; equals key for catalog items). */
  itemId?: string;
  name: string;
  price: number;
  image?: string;
  imageAlt?: string;
  variant?: string;
  qty: number;
  instructions?: string;
  /**
   * Availability at the cart's branch. For the server cart this is the real
   * CartLine.isAvailable from the API. For the guest cart it is a best-effort
   * cross-reference against menu-context's live menu (becomes fully
   * authoritative the moment the user logs in).
   */
  isAvailable?: boolean;
}

/** Mirror of the server's CartSummary (src/lib/cart.ts) for the guest cart. */
interface ApiCartLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isAvailable: boolean;
}

interface ApiCartSummary {
  branchId: string | null;
  branchName: string | null;
  branchCity: string | null;
  items: ApiCartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

interface GuestCartStorage {
  branchId: string | null;
  items: CartItem[];
}

/**
 * Optional callbacks for requestBranchSwitch (Phase 5 reorder flow):
 *  - onConfirmed fires once the switch actually happened — either immediately
 *    (empty cart / already on that branch) or after the confirm dialog.
 *  - onCancelled fires when the user dismisses the dialog without switching.
 */
export interface BranchSwitchCallbacks {
  onConfirmed?: () => void;
  onCancelled?: () => void;
}

interface CartContextValue {
  items: Record<string, CartItem>;
  itemCount: number;
  subtotal: number;
  /** False until the active cart (guest storage or server fetch) has loaded. */
  isHydrated: boolean;
  addItem: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  updateQty: (key: string, delta: number) => void;
  updateInstructions: (key: string, instructions: string) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  /** Offer pre-applied from the Offers page (or the checkout coupon box). */
  appliedOffer: Offer | null;
  applyOffer: (offer: Offer | null) => void;
  clearOffer: () => void;
  /** Cart Drawer state */
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleCartDrawer: () => void;
  /* ── Phase 3 additions ─────────────────────────────────────────── */
  /** True while there is no authenticated session (local guest cart mode). */
  isGuest: boolean;
  /** Branch the active cart is tied to (carts cannot span branches). */
  cartBranchId: string | null;
  cartBranchName: string | null;
  /** True when any line is flagged unavailable — blocks checkout. */
  hasUnavailableItems: boolean;
  /** True while a server cart mutation (add/qty/remove/switch) is in flight. */
  isMutating: boolean;
  /** Last failed cart action's message (shown in the cart drawer). */
  cartError: string | null;
  /**
   * Branch-switch entry point used by the Header selector and the Phase 5
   * reorder flow: switches immediately when the cart is empty, otherwise
   * shows a confirm dialog ("switching clears your cart") before switching.
   * Optional callbacks notify the caller when the switch is confirmed or
   * cancelled (e.g. to defer adding reorder items until after the switch).
   */
  requestBranchSwitch: (branchId: string, callbacks?: BranchSwitchCallbacks) => void;
}

const GUEST_CART_KEY = 'sp_guest_cart';
const OFFER_KEY = 'snackpod-offer';

const CartContext = createContext<CartContextValue | null>(null);

/* ── Guest cart storage helpers ─────────────────────────────────────── */

function readGuestCartStorage(): GuestCartStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const items: CartItem[] = Array.isArray(parsed.items)
      ? (parsed.items as CartItem[])
          .filter(
            (v) =>
              v &&
              typeof v === 'object' &&
              typeof v.name === 'string' &&
              typeof v.price === 'number' &&
              v.price > 0
          )
          .map((v) => ({ ...v, qty: Math.max(1, Math.round(Number(v.qty) || 1)) }))
      : [];
    return { branchId: typeof parsed.branchId === 'string' ? parsed.branchId : null, items };
  } catch {
    return null;
  }
}

function writeGuestCartStorage(cart: GuestCartStorage): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  } catch {
    // storage unavailable (private mode / quota) — cart still works in memory
  }
}

function clearGuestCartStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // ignore
  }
}

function loadOffer(): Offer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.code === 'string' &&
      typeof parsed.type === 'string'
    ) {
      return parsed as Offer;
    }
    return null;
  } catch {
    return null;
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof api.ApiClientError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { branches, selectedBranch, switchBranch, getBranchById } = useBranches();
  const { isHydrated: menuHydrated, getDishById } = useMenu();
  const { showToast } = useToast();

  // ── Guest (local) cart state ────────────────────────────────────────
  const [guestItems, setGuestItems] = useState<Record<string, CartItem>>({});
  const [guestBranchId, setGuestBranchId] = useState<string | null>(null);

  // ── Server cart state ───────────────────────────────────────────────
  const [serverCart, setServerCart] = useState<ApiCartSummary | null>(null);
  const [serverItems, setServerItems] = useState<Record<string, CartItem>>({});

  // ── Shared UI state ─────────────────────────────────────────────────
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [pendingBranchSwitch, setPendingBranchSwitch] = useState<string | null>(null);
  // Callbacks waiting on the branch-switch confirm dialog (Phase 5 reorder).
  const pendingSwitchCallbacksRef = useRef<BranchSwitchCallbacks | null>(null);

  // Merge is triggered exactly once per session establishment (guarded by
  // user id; the guard resets when the user signs out).
  const mergedUserIdRef = useRef<string | null>(null);
  // Pending guest add deferred while the branch-switch confirm dialog is up.
  const pendingAddRef = useRef<{ item: Omit<CartItem, 'qty'>; qty: number } | null>(null);

  const openCartDrawer = useCallback(() => setIsCartDrawerOpen(true), []);
  const closeCartDrawer = useCallback(() => setIsCartDrawerOpen(false), []);
  const toggleCartDrawer = useCallback(() => setIsCartDrawerOpen((prev) => !prev), []);

  const isGuest = !user;

  /* ── Guest availability (best-effort vs live menu data) ────────────── */
  const computeGuestAvailability = useCallback(
    (key: string): boolean => {
      // Static combos have no DB availability yet — treat as always in stock.
      if (key.startsWith('combo-')) return true;
      const dish = getDishById(key);
      if (dish) return dish.inStock !== false;
      // Menu is loaded for this branch and the item is not on it → unavailable.
      if (menuHydrated) return false;
      // Menu not loaded yet — don't flag anything spuriously.
      return true;
    },
    [getDishById, menuHydrated]
  );

  // Recompute guest availability whenever the live menu for the branch changes.
  useEffect(() => {
    if (user) return; // server cart carries authoritative isAvailable
    setGuestItems((prev) => {
      let changed = false;
      const next: Record<string, CartItem> = {};
      for (const [key, item] of Object.entries(prev)) {
        const available = computeGuestAvailability(key);
        if (available !== item.isAvailable) changed = true;
        next[key] = { ...item, isAvailable: available };
      }
      return changed ? next : prev;
    });
  }, [user, computeGuestAvailability]);

  /* ── Initial mount: hydrate guest cart + offer from localStorage ───── */
  useEffect(() => {
    const saved = readGuestCartStorage();
    if (saved) {
      setGuestItems(Object.fromEntries(saved.items.map((i) => [i.key, i])));
      setGuestBranchId(saved.branchId);
    }
    setAppliedOffer(loadOffer());
    setIsHydrated(true);
  }, []);

  /* ── Guest cart persistence (only in guest mode) ───────────────────── */
  useEffect(() => {
    if (!isHydrated || user) return;
    writeGuestCartStorage({ branchId: guestBranchId, items: Object.values(guestItems) });
  }, [guestItems, guestBranchId, isHydrated, user]);

  /* ── Offer persistence (unchanged from v1) ─────────────────────────── */
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (appliedOffer) {
        window.localStorage.setItem(OFFER_KEY, JSON.stringify(appliedOffer));
      } else {
        window.localStorage.removeItem(OFFER_KEY);
      }
    } catch {
      // storage unavailable
    }
  }, [appliedOffer, isHydrated]);

  /* ── Server cart helpers ───────────────────────────────────────────── */

  const applyServerCart = useCallback(
    (cart: ApiCartSummary) => {
      setServerCart(cart);
      setServerItems((prev) => {
        const next: Record<string, CartItem> = {};
        for (const line of cart.items) {
          const old = prev[line.itemId];
          const dish = getDishById(line.itemId);
          const category = dish ? getCategory(dish.categoryId) : undefined;
          next[line.itemId] = {
            key: line.itemId,
            itemId: line.itemId,
            name: line.name,
            price: line.unitPrice,
            qty: line.quantity,
            isAvailable: line.isAvailable,
            image: old?.image ?? dish?.image,
            imageAlt: old?.imageAlt ?? dish?.imageAlt ?? line.name,
            variant: old?.variant ?? (category ? category.name : undefined),
            // Instructions aren't part of the cart API yet — keep the local copy.
            instructions: old?.instructions,
          };
        }
        return next;
      });
    },
    [getDishById]
  );

  const refreshServerCart = useCallback(async () => {
    try {
      const data = await api.authenticatedFetch<{ cart: ApiCartSummary }>('/api/cart');
      applyServerCart(data.cart);
    } catch {
      // Session expired or cart unavailable — the UI drops to signed-out state
      // via the auth layer's unauthorized handler.
      setServerCart(null);
      setServerItems({});
    } finally {
      setIsHydrated(true);
    }
  }, [applyServerCart]);

  /* ── Guest cart merge (TASK 3) ─────────────────────────────────────── */

  const mergeGuestCart = useCallback(
    async (guest: GuestCartStorage) => {
      // (a) Always read fresh server state — never assume a previous merge
      // attempt's success (idempotency guard: re-check before acting).
      const { cart: server } = await api.authenticatedFetch<{ cart: ApiCartSummary }>('/api/cart');

      // Combo lines have no DB item yet (explicit Phase 3 gap) — skip them.
      const realLines = guest.items.filter(
        (l) => Boolean(getDishById(l.key)) || !l.key.startsWith('combo-')
      );
      const skippedCombos = guest.items.length - realLines.length;
      const skippedNames: string[] = [];

      const postLine = async (line: CartItem, withBranch: boolean) => {
        const body: Record<string, unknown> = { itemId: line.key, quantity: line.qty };
        if (withBranch && guest.branchId) body.branchId = guest.branchId;
        await api.authenticatedFetch<{ cart: ApiCartSummary }>('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      };

      if (!server.branchId || server.items.length === 0) {
        // (b) Server cart empty → POST each guest line, carrying the guest's
        // branchId so the cart is established at the guest's branch even if an
        // earlier line fails (backend treats a matching branchId as a no-op).
        for (const line of realLines) {
          try {
            await postLine(line, true);
          } catch {
            skippedNames.push(line.name);
          }
        }
      } else if (server.branchId === guest.branchId) {
        // (c) Same branch → PATCH existing lines (existing + guest qty), POST new ones.
        const existingQty = new Map(server.items.map((l) => [l.itemId, l.quantity]));
        for (const line of realLines) {
          try {
            const qty = existingQty.get(line.key);
            if (qty !== undefined) {
              await api.authenticatedFetch<{ cart: ApiCartSummary }>(
                `/api/cart/items/${encodeURIComponent(line.key)}`,
                { method: 'PATCH', body: JSON.stringify({ quantity: qty + line.qty }) }
              );
            } else {
              await postLine(line, true);
            }
          } catch {
            skippedNames.push(line.name);
          }
        }
      } else {
        // (d) Different branch → do NOT touch the server cart. Discard the
        // guest cart (caller clears storage) and explain, naming both branches.
        const guestBranchName =
          (guest.branchId ? getBranchById(guest.branchId)?.name : undefined) ?? 'your guest branch';
        showToast(
          `Kept your existing ${server.branchName ?? 'saved'} cart; items you added as a guest for ${guestBranchName} weren't added since carts can only hold one branch at a time.`,
          'info'
        );
        return;
      }

      if (skippedCombos > 0 || skippedNames.length > 0) {
        const bits: string[] = [];
        if (skippedCombos > 0)
          bits.push(
            `${skippedCombos} combo item${skippedCombos > 1 ? 's' : ''} (combos aren't available for online ordering yet)`
          );
        if (skippedNames.length > 0)
          bits.push(
            `${skippedNames.length} item${skippedNames.length > 1 ? 's' : ''} couldn't be added`
          );
        showToast(`Merged your guest cart — ${bits.join('; ')}.`, 'info');
      } else {
        showToast('Your guest cart items were added to your account cart.', 'success');
      }
    },
    [getDishById, getBranchById, showToast]
  );

  const handleSessionEstablished = useCallback(async () => {
    const guest = readGuestCartStorage();
    if (!guest || guest.items.length === 0) {
      await refreshServerCart();
      return;
    }
    try {
      await mergeGuestCart(guest);
      // (e) After merge or discard: clear the guest cart completely and
      // re-fetch the server cart as the new source of truth.
      clearGuestCartStorage();
      setGuestItems({});
      setGuestBranchId(null);
      await refreshServerCart();
    } catch (e) {
      const msg = errorMessage(e);
      setCartError(`Couldn't merge your guest cart: ${msg}`);
      showToast("Couldn't merge your guest cart — your signed-in cart is shown instead.", 'error');
      await refreshServerCart();
    }
  }, [mergeGuestCart, refreshServerCart, showToast]);

  // Session lifecycle: hydrate/merge on login (incl. silent refresh), reset on logout.
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Exactly once per login event — a flaky retry must not re-run a merge
      // (the guard resets only when the user signs out again).
      if (mergedUserIdRef.current === user.id) return;
      mergedUserIdRef.current = user.id;
      setIsHydrated(false);
      setServerCart(null);
      setServerItems({});
      void handleSessionEstablished();
    } else {
      mergedUserIdRef.current = null;
      pendingAddRef.current = null;
      setServerCart(null);
      setServerItems({});
      setIsHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  /* ── Server mutations (TASK 2): optimistic, always overwritten by the
     response — the server is the only source of truth for prices/availability. */

  const serverAddItem = useCallback(
    async (item: Omit<CartItem, 'qty'>, qty: number) => {
      const dish = getDishById(item.key);
      if (!dish && item.key.startsWith('combo-')) {
        showToast("Combos can't be added to an online order yet — coming in a later phase.", 'info');
        return;
      }
      const unitPrice = dish ? dish.price : item.price;
      const branchId = selectedBranch?.id ?? undefined;

      // Optimistic add.
      setServerItems((prev) => {
        const existing = prev[item.key];
        return {
          ...prev,
          [item.key]: existing
            ? { ...existing, qty: existing.qty + qty, price: unitPrice }
            : { ...item, itemId: item.key, price: unitPrice, qty, isAvailable: true },
        };
      });
      setIsMutating(true);
      setCartError(null);
      try {
        const body = await api.authenticatedFetch<{ cart: ApiCartSummary; cleared: boolean }>(
          '/api/cart/items',
          {
            method: 'POST',
            body: JSON.stringify({
              itemId: item.key,
              quantity: qty,
              ...(branchId ? { branchId } : {}),
            }),
          }
        );
        if (body.cleared) {
          showToast('Your cart was moved to the new branch and previous items were cleared.', 'info');
        }
        applyServerCart(body.cart);
      } catch (e) {
        const msg = errorMessage(e);
        setCartError(msg);
        showToast(msg, 'error');
        await refreshServerCart(); // restore server truth
      } finally {
        setIsMutating(false);
      }
    },
    [getDishById, selectedBranch?.id, applyServerCart, refreshServerCart, showToast]
  );

  const serverUpdateQty = useCallback(
    async (key: string, delta: number) => {
      const existing = serverItems[key];
      if (!existing) return;
      // Defense in depth: reject non-integer deltas before they're ever sent
      // (backend cartQtySchema also validates, but never send garbage).
      if (!Number.isInteger(delta)) return;
      const nextQty = existing.qty + delta;
      if (nextQty < 0) return;

      // Optimistic.
      setServerItems((prev) => {
        const cur = prev[key];
        if (!cur) return prev;
        if (nextQty === 0) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: { ...cur, qty: nextQty } };
      });
      setIsMutating(true);
      setCartError(null);
      try {
        const body = await api.authenticatedFetch<{ cart: ApiCartSummary }>(
          `/api/cart/items/${encodeURIComponent(key)}`,
          { method: 'PATCH', body: JSON.stringify({ quantity: nextQty }) }
        );
        applyServerCart(body.cart);
      } catch (e) {
        const msg = errorMessage(e);
        setCartError(msg);
        showToast(msg, 'error');
        await refreshServerCart();
      } finally {
        setIsMutating(false);
      }
    },
    [serverItems, applyServerCart, refreshServerCart, showToast]
  );

  const serverRemoveItem = useCallback(
    async (key: string) => {
      // Optimistic.
      setServerItems((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setIsMutating(true);
      setCartError(null);
      try {
        const body = await api.authenticatedFetch<{ cart: ApiCartSummary }>(
          `/api/cart/items/${encodeURIComponent(key)}`,
          { method: 'DELETE' }
        );
        applyServerCart(body.cart);
      } catch (e) {
        const msg = errorMessage(e);
        setCartError(msg);
        showToast(msg, 'error');
        await refreshServerCart();
      } finally {
        setIsMutating(false);
      }
    },
    [applyServerCart, refreshServerCart, showToast]
  );

  /* ── Public API (same surface as v1, plus Phase 3 additions) ───────── */

  const doGuestAdd = useCallback(
    (item: Omit<CartItem, 'qty'>, qty: number, branchOverride?: string | null) => {
      const dish = getDishById(item.key);
      // Menu data is authoritative for guest pricing when available.
      const unitPrice = dish ? dish.price : item.price;
      const branchId = branchOverride !== undefined ? branchOverride : selectedBranch?.id ?? null;
      setGuestBranchId(branchId);
      setGuestItems((prev) => {
        const existing = prev[item.key];
        return {
          ...prev,
          [item.key]: existing
            ? { ...existing, qty: existing.qty + qty, price: unitPrice }
            : {
                ...item,
                itemId: item.key,
                price: unitPrice,
                qty,
                isAvailable: computeGuestAvailability(item.key),
              },
        };
      });
    },
    [getDishById, selectedBranch?.id, computeGuestAvailability]
  );

  const addItem = useCallback(
    (item: Omit<CartItem, 'qty'>, qty = 1) => {
      const safeQty = Number.isInteger(qty) && qty > 0 ? qty : 1;
      if (user) {
        void serverAddItem(item, safeQty);
        return;
      }
      // A guest cart cannot span branches: adding for a different branch than
      // the cart's own is treated like a branch switch (confirm dialog first).
      const targetBranch = selectedBranch?.id ?? null;
      if (
        guestBranchId &&
        targetBranch &&
        guestBranchId !== targetBranch &&
        Object.keys(guestItems).length > 0
      ) {
        pendingAddRef.current = { item, qty: safeQty };
        setPendingBranchSwitch(targetBranch);
        return;
      }
      doGuestAdd(item, safeQty);
    },
    [user, selectedBranch?.id, guestBranchId, guestItems, serverAddItem, doGuestAdd]
  );

  const updateQty = useCallback(
    (key: string, delta: number) => {
      if (user) {
        void serverUpdateQty(key, delta);
        return;
      }
      if (!Number.isInteger(delta)) return;
      setGuestItems((prev) => {
        const existing = prev[key];
        if (!existing) return prev;
        const nextQty = existing.qty + delta;
        if (nextQty <= 0) {
          // Removing an item at qty 1 is treated as removing it entirely.
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: { ...existing, qty: nextQty } };
      });
    },
    [user, serverUpdateQty]
  );

  const updateInstructions = useCallback(
    (key: string, instructions: string) => {
      const setter = user ? setServerItems : setGuestItems;
      setter((prev) => {
        const existing = prev[key];
        if (!existing) return prev;
        return { ...prev, [key]: { ...existing, instructions: instructions.trim() || undefined } };
      });
    },
    [user]
  );

  const removeItem = useCallback(
    (key: string) => {
      if (user) {
        void serverRemoveItem(key);
        return;
      }
      setGuestItems((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [user, serverRemoveItem]
  );

  const clearCart = useCallback(() => {
    if (user) {
      void (async () => {
        setIsMutating(true);
        setCartError(null);
        try {
          await api.authenticatedFetch<{ ok: boolean }>('/api/cart', { method: 'DELETE' });
          setServerCart(null);
          setServerItems({});
        } catch (e) {
          const msg = errorMessage(e);
          setCartError(msg);
          showToast(msg, 'error');
        } finally {
          setIsMutating(false);
        }
      })();
    } else {
      setGuestItems({});
    }
    setAppliedOffer(null); // a fresh order starts without an applied coupon
  }, [user, showToast]);

  const applyOffer = useCallback((offer: Offer | null) => setAppliedOffer(offer), []);

  const clearOffer = useCallback(() => setAppliedOffer(null), []);

  /* ── Branch-switch guard (TASK 4) ──────────────────────────────────── */

  const requestBranchSwitch = useCallback(
    (branchId: string, callbacks?: BranchSwitchCallbacks) => {
      pendingSwitchCallbacksRef.current = callbacks ?? null;
      if (!selectedBranch || branchId === selectedBranch.id) {
        // Already on the requested branch — nothing to switch; proceed.
        callbacks?.onConfirmed?.();
        pendingSwitchCallbacksRef.current = null;
        return;
      }
      const count = user
        ? Object.values(serverItems).reduce((s, i) => s + i.qty, 0)
        : Object.values(guestItems).reduce((s, i) => s + i.qty, 0);
      if (count === 0) {
        // Empty cart → switch immediately, no dialog.
        switchBranch(branchId);
        callbacks?.onConfirmed?.();
        pendingSwitchCallbacksRef.current = null;
        return;
      }
      setPendingBranchSwitch(branchId);
    },
    [selectedBranch?.id, user, serverItems, guestItems, switchBranch]
  );

  const confirmBranchSwitch = useCallback(async () => {
    const target = pendingBranchSwitch;
    const callbacks = pendingSwitchCallbacksRef.current;
    setPendingBranchSwitch(null);
    if (!target) return;

    if (user) {
      setIsMutating(true);
      setCartError(null);
      try {
        // Server clears the cart at the old branch and moves it to the target.
        const body = await api.authenticatedFetch<{ cart: ApiCartSummary }>('/api/cart/branch', {
          method: 'POST',
          body: JSON.stringify({ branchId: target }),
        });
        applyServerCart(body.cart);
        switchBranch(target);
        callbacks?.onConfirmed?.();
        pendingSwitchCallbacksRef.current = null;
      } catch (e) {
        const msg = errorMessage(e);
        setCartError(msg);
        showToast(msg, 'error');
      } finally {
        setIsMutating(false);
      }
    } else {
      // Guest: clear the local guest cart and update the stored branch.
      setGuestItems({});
      setGuestBranchId(target);
      switchBranch(target);
      // Replay the add that originally triggered the cross-branch dialog.
      const pending = pendingAddRef.current;
      pendingAddRef.current = null;
      if (pending) doGuestAdd(pending.item, pending.qty, target);
      callbacks?.onConfirmed?.();
      pendingSwitchCallbacksRef.current = null;
    }
  }, [pendingBranchSwitch, user, applyServerCart, switchBranch, showToast, doGuestAdd]);

  const cancelBranchSwitch = useCallback(() => {
    pendingAddRef.current = null;
    pendingSwitchCallbacksRef.current?.onCancelled?.();
    pendingSwitchCallbacksRef.current = null;
    setPendingBranchSwitch(null);
  }, []);

  /* ── Derived values ────────────────────────────────────────────────── */

  const value = useMemo<CartContextValue>(() => {
    const displayedItems = user ? serverItems : guestItems;
    const entries = Object.values(displayedItems);
    const itemCount = entries.reduce((sum, item) => sum + item.qty, 0);
    // Server mode: subtotal is the server-recomputed number from the latest
    // GET/mutation response — never a client-recalculated total. Guest mode:
    // computed from menu-context's effective prices.
    const subtotal = user
      ? serverCart?.subtotal ?? entries.reduce((sum, item) => sum + item.price * item.qty, 0)
      : entries.reduce((sum, item) => sum + item.price * item.qty, 0);
    const hasUnavailableItems = entries.some((item) => item.isAvailable === false);
    const cartBranchId = user ? (serverCart?.branchId ?? null) : guestBranchId;
    const cartBranchName = user
      ? (serverCart?.branchName ?? null)
      : (cartBranchId ? getBranchById(cartBranchId)?.name ?? null : null);

    return {
      items: displayedItems,
      itemCount,
      subtotal,
      isHydrated,
      addItem,
      updateQty,
      updateInstructions,
      removeItem,
      clearCart,
      appliedOffer,
      applyOffer,
      clearOffer,
      isCartDrawerOpen,
      openCartDrawer,
      closeCartDrawer,
      toggleCartDrawer,
      isGuest,
      cartBranchId,
      cartBranchName,
      hasUnavailableItems,
      isMutating,
      cartError,
      requestBranchSwitch,
    };
  }, [
    user,
    serverItems,
    guestItems,
    serverCart,
    guestBranchId,
    isHydrated,
    addItem,
    updateQty,
    updateInstructions,
    removeItem,
    clearCart,
    appliedOffer,
    applyOffer,
    clearOffer,
    isCartDrawerOpen,
    openCartDrawer,
    closeCartDrawer,
    toggleCartDrawer,
    isGuest,
    getBranchById,
    isMutating,
    cartError,
    requestBranchSwitch,
  ]);

  const pendingTargetBranch = pendingBranchSwitch
    ? branches.find((b) => b.id === pendingBranchSwitch) ?? null
    : null;

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* Branch-switch confirmation (only shown when the active cart is non-empty) */}
      <ConfirmDialog
        open={pendingBranchSwitch !== null}
        title="Switch branches?"
        message={
          <>
            Switching to <strong>{pendingTargetBranch?.name ?? 'the new branch'}</strong> will
            clear your current cart — continue?
          </>
        }
        confirmLabel="Switch & clear cart"
        cancelLabel="Keep current branch"
        busy={isMutating}
        onConfirm={confirmBranchSwitch}
        onCancel={cancelBranchSwitch}
      />
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a <CartProvider>');
  }
  return ctx;
}
