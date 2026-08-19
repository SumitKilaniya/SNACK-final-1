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

export interface Branch {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  servicePincodes: string[];
}

interface BranchesContextValue {
  /** Active branches returned by GET /api/branches (server already filters isActive). */
  branches: Branch[];
  /** Currently selected branch (cookie `sp_branch` → first active branch fallback). */
  selectedBranch: Branch | null;
  /** True once the first fetch attempt has finished (success OR failure). */
  isHydrated: boolean;
  /** True while /api/branches is being fetched (initial load or retry). */
  isLoading: boolean;
  /** Non-null when branches couldn't be loaded or there are no active branches. */
  error: string | null;
  /** Re-run the /api/branches fetch (shown in the "not available right now" state). */
  retry: () => void;
  /** Select a branch and persist the choice (cookie + localStorage mirror). */
  switchBranch: (branchId: string) => void;
  getBranchById: (id: string) => Branch | undefined;
}

/**
 * Cookie is the source of truth so server components / future SSR can read the
 * selected branch too; localStorage is only a fast client-side mirror.
 */
const BRANCH_COOKIE = 'sp_branch';
const STORAGE_KEY = 'snackpod-branch-v1';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const BranchesContext = createContext<BranchesContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeBranchCookie(branchId: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${BRANCH_COOKIE}=${encodeURIComponent(branchId)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function BranchesProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const fetchedRef = useRef(false);

  // Fetch active branches from the API once on mount (and again on retry).
  useEffect(() => {
    if (fetchedRef.current && attempt === 0) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch('/api/branches')
      .then(async (res) => {
        if (!res.ok) throw new Error(`branches request failed (${res.status})`);
        const body = await res.json().catch(() => null);
        if (!body || !Array.isArray(body.branches)) throw new Error('unexpected response');
        if (cancelled) return;
        const list: Branch[] = body.branches;
        setBranches(list);
        if (list.length === 0) {
          setError('unavailable');
          setIsHydrated(true);
          setIsLoading(false);
          return;
        }
        // Preferred branch: whatever was persisted in the cookie, else the first.
        const persisted = readCookie(BRANCH_COOKIE) || localStorage.getItem(STORAGE_KEY);
        const preferred = list.find((b) => b.id === persisted) ?? list[0];
        setSelectedBranchId(preferred.id);
        setIsHydrated(true);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Failed to load branches', err);
        setError('failed');
        setIsHydrated(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setAttempt((a) => a + 1);
  }, []);

  const switchBranch = useCallback((branchId: string) => {
    setSelectedBranchId(branchId);
    writeBranchCookie(branchId);
    try {
      localStorage.setItem(STORAGE_KEY, branchId);
    } catch {
      // localStorage unavailable (private mode) — cookie is the source of truth.
    }
  }, []);

  const getBranchById = useCallback(
    (id: string) => branches.find((b) => b.id === id),
    [branches]
  );

  const selectedBranch = useMemo(
    () => (selectedBranchId ? branches.find((b) => b.id === selectedBranchId) ?? null : null),
    [branches, selectedBranchId]
  );

  const value = useMemo(
    () => ({
      branches,
      selectedBranch,
      isHydrated,
      isLoading,
      error,
      retry,
      switchBranch,
      getBranchById,
    }),
    [branches, selectedBranch, isHydrated, isLoading, error, retry, switchBranch, getBranchById]
  );

  return <BranchesContext.Provider value={value}>{children}</BranchesContext.Provider>;
}

export function useBranches() {
  const context = useContext(BranchesContext);
  if (!context) {
    throw new Error('useBranches must be used within a BranchesProvider');
  }
  return context;
}
