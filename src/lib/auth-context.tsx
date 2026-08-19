'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api-client';
import type { SessionUser, RegisterInput } from '@/lib/api-client';

/**
 * Customer session state, backed by the real backend auth API (see
 * api-client.ts). No fake/localStorage logins: the durable session is the
 * httpOnly sp_refresh cookie, and the access token never leaves memory.
 *
 * On mount we silently call POST /api/auth/refresh — if a session exists the
 * user is hydrated from it; if not, they're simply signed out with no error
 * shown. `isLoading` lets consumers render a neutral state instead of
 * flashing "logged out" during that hydration.
 */

export type UserRole = 'CUSTOMER' | 'BRANCH_ADMIN' | 'SUPER_ADMIN';

/** Customer-facing profile shape — matches the backend's SafeUser exactly. */
export interface UserProfile extends SessionUser {
  /** Not provided by the backend yet; kept optional for existing UI checks. */
  avatar?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  /** True until the initial session hydration (refresh) settles. */
  isLoading: boolean;
  /** Sign in with email or phone + password. Throws ApiClientError on failure. */
  login: (identifier: string, password: string) => Promise<UserProfile>;
  /** Create an account (auto-signs-in). Throws ApiClientError on failure. */
  register: (input: RegisterInput) => Promise<UserProfile>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Hydrate the session on mount via the httpOnly refresh cookie; a failed
  // refresh simply means "signed out" (no error is shown to the user).
  useEffect(() => {
    let active = true;

    api.refreshSession().then((sessionUser) => {
      if (!active) return;
      setUser(sessionUser ? { ...sessionUser } : null);
      setIsLoading(false);
    });

    // When authenticatedFetch exhausts a session (401 → refresh failed), the
    // API layer calls this so the UI drops back to the signed-out state.
    api.setUnauthorizedHandler(() => setUser(null));

    return () => {
      active = false;
      api.setUnauthorizedHandler(null);
    };
  }, []);

  const login = async (identifier: string, password: string): Promise<UserProfile> => {
    const { user: sessionUser } = await api.login({ identifier, password });
    const profile: UserProfile = { ...sessionUser };
    setUser(profile);
    return profile;
  };

  const register = async (input: RegisterInput): Promise<UserProfile> => {
    const { user: sessionUser } = await api.register(input);
    const profile: UserProfile = { ...sessionUser };
    setUser(profile);
    return profile;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } catch {
      // Best effort — local state is cleared regardless.
    }
    setUser(null);
    router.push('/');
  };

  const logoutAll = async (): Promise<void> => {
    try {
      await api.logoutAll();
    } catch {
      // Best effort — local state is cleared regardless.
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        register,
        logout,
        logoutAll,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
