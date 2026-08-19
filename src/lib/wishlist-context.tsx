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
import * as api from './api-client';
import { useAuth } from './auth-context';
import { useBranches } from './branches-context';
import { useToast } from './toast-context';

interface WishlistContextValue {
  ids: string[];
  count: number;
  isWishlisted: (key: string) => boolean;
  toggleWishlist: (key: string) => boolean; // returns new state (true = added)
}

const GUEST_STORAGE_KEY = 'snackpod-wishlist-v2';

const WishlistContext = createContext<WishlistContextValue | null>(null);

/* ── Guest localStorage helpers ──────────────────────────────────────── */

function loadGuestWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

function saveGuestWishlist(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable — wishlist still works in memory
  }
}

function clearGuestWishlist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedBranch } = useBranches();
  const { showToast } = useToast();

  const [serverIds, setServerIds] = useState<Set<string>>(new Set());
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const mergedUserIdRef = useRef<string | null>(null);

  /* ── Hydrate guest wishlist from localStorage on mount ──────────── */
  useEffect(() => {
    setGuestIds(loadGuestWishlist());
    setIsHydrated(true);
  }, []);

  /* ── Persist guest wishlist to localStorage ─────────────────────── */
  useEffect(() => {
    if (!isHydrated || user) return;
    saveGuestWishlist(guestIds);
  }, [guestIds, isHydrated, user]);

  /* ── Fetch server wishlist on login ─────────────────────────────── */
  useEffect(() => {
    if (authLoading || !user) return;
    if (mergedUserIdRef.current === user.id) return;
    mergedUserIdRef.current = user.id;

    (async () => {
      try {
        const branchId = selectedBranch?.id;
        const params = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
        const data = await api.authenticatedFetch<{ items: Array<{ menuItemId: string }> }>(
          `/api/wishlist${params}`,
        );
        const serverSet = new Set(data.items.map((w) => w.menuItemId));

        // Merge: POST any locally-wishlisted id not already in the server set
        for (const localId of guestIds) {
          if (!serverSet.has(localId)) {
            try {
              await api.authenticatedFetch('/api/wishlist', {
                method: 'POST',
                body: JSON.stringify({ menuItemId: localId }),
              });
              serverSet.add(localId);
            } catch {
              // Non-critical — skip this item
            }
          }
        }

        setServerIds(serverSet);
        clearGuestWishlist();
        setGuestIds([]);

        if (guestIds.length > 0) {
          showToast('Your wishlist items were synced to your account.', 'success');
        }
      } catch {
        // Non-critical — wishlist degrades gracefully
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  /* ── Toggle ──────────────────────────────────────────────────────── */

  const toggleWishlist = useCallback((key: string) => {
    const effectiveIds = user ? serverIds : new Set(guestIds);
    const willAdd = !effectiveIds.has(key);

    if (user) {
      // Server mode — optimistic + async
      setServerIds((prev) => {
        const next = new Set(prev);
        if (willAdd) next.add(key);
        else next.delete(key);
        return next;
      });

      (async () => {
        try {
          if (willAdd) {
            await api.authenticatedFetch('/api/wishlist', {
              method: 'POST',
              body: JSON.stringify({ menuItemId: key }),
            });
          } else {
            await api.authenticatedFetch(`/api/wishlist/${encodeURIComponent(key)}`, {
              method: 'DELETE',
            });
          }
        } catch {
          // Revert on failure
          setServerIds((prev) => {
            const next = new Set(prev);
            if (willAdd) next.delete(key);
            else next.add(key);
            return next;
          });
        }
      })();
    } else {
      // Guest mode — local only
      setGuestIds((prev) => (willAdd ? [...prev, key] : prev.filter((id) => id !== key)));
    }

    return willAdd;
  }, [user, serverIds, guestIds]);

  const serverIdList = useMemo(() => Array.from(serverIds), [serverIds]);
  const ids = user ? serverIdList : guestIds;
  const idsSet = useMemo(() => new Set(ids), [ids]);

  const isWishlisted = useCallback((key: string) => idsSet.has(key), [idsSet]);

  const value = useMemo<WishlistContextValue>(
    () => ({ ids, count: ids.length, isWishlisted, toggleWishlist }),
    [ids, isWishlisted, toggleWishlist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within a <WishlistProvider>');
  }
  return ctx;
}
