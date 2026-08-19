'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  adminApi,
  adminRefresh,
  adminSignIn,
  adminSignOut,
  clearAdminSession,
  getAdminToken,
  getAdminUser,
  setAdminUser,
  type AdminUser,
  type DashboardData,
} from './admin-api';

export type AdminSessionState = 'loading' | 'signedIn' | 'signedOut' | 'deactivated';

interface AdminContextValue {
  state: AdminSessionState;
  user: AdminUser | null;
  /** Admin role (upper-case enum) or null. */
  role: AdminUser['role'] | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

/**
 * Session provider for the admin portal. On mount, a stored access token is
 * verified against /api/admin/dashboard — the server is the source of truth
 * for whether the session is valid, the role is admin, and the account is
 * not deactivated. The access token refreshes automatically via the httpOnly
 * refresh cookie on any 401.
 */
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminSessionState>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!getAdminToken()) {
        setState('signedOut');
        return;
      }
      try {
        const data = await adminApi<DashboardData>('/api/admin/dashboard');
        if (cancelled) return;
        // The dashboard call proves the session is admin + not deactivated;
        // refresh the stored profile from the server's view of the session.
        const me = await adminApi<{ user: AdminUser }>('/api/auth/me').catch(() => null);
        const profile = me?.user ?? getAdminUser();
        if (profile) setAdminUser(profile);
        setUser(profile);
        setState('signedIn');
        void data;
      } catch (e) {
        if (cancelled) return;
        if (e instanceof Error && (e as { code?: string }).code === 'ACCOUNT_DEACTIVATED') {
          setState('deactivated');
        } else {
          setState('signedOut');
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await adminSignIn(email, password);
    setUser(u);
    setState('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await adminSignOut();
    setUser(null);
    setState('signedOut');
  }, []);

  // Re-check after a deactivation error clears the session elsewhere.
  const value = useMemo<AdminContextValue>(
    () => ({
      state,
      user,
      role: user?.role ?? null,
      signIn,
      signOut,
    }),
    [state, user, signIn, signOut]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within an <AdminProvider>');
  }
  return ctx;
}
