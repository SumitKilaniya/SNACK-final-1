/**
 * Admin portal API client.
 *
 * The storefront stores nothing on the client (httpOnly cookies), and the
 * admin portal is a separate surface that keeps its access token in memory
 * only (see TOKEN storage note below). Flow:
 *
 *   sign in   → POST /api/auth/login      → access token + refresh cookie
 *   every call→ Bearer <access token>     → 401 → POST /api/auth/refresh
 *                                            (rotates cookie, new token) → retry once
 *   sign out  → POST /api/auth/logout     → clears the refresh cookie
 *
 * Neither the refresh token NOR the access token ever touches localStorage:
 * the refresh token lives in the httpOnly cookie, and the access token lives
 * in the module variable below (restored on admin-panel boot via the
 * adminRefresh() call in admin-context).
 */

export type AdminRole = 'CUSTOMER' | 'BRANCH_ADMIN' | 'SUPER_ADMIN';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  role: AdminRole;
  branchId: string | null;
  createdAt: string;
}

const USER_KEY = 'snackpod_admin_user';

// Access tokens are live session credentials — persisting them to
// localStorage would let any XSS read a valid token. This module-level
// variable dies on reload, and the httpOnly sp_refresh cookie remains the
// durable session: admin-context calls adminRefresh() on boot, which rotates
// the cookie and repopulates this variable. (The doc comment above previously
// claimed this behavior; it was actually localStorage until this fix.)
let adminAccessToken: string | null = null;

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getAdminToken(): string | null {
  return adminAccessToken;
}

export function setAdminToken(token: string | null): void {
  adminAccessToken = token;
}

export function getAdminUser(): AdminUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function setAdminUser(user: AdminUser | null): void {
  if (!isBrowser()) return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearAdminSession(): void {
  setAdminToken(null);
  setAdminUser(null);
}

/** Sign in with email + password. Throws AdminApiError on failure. */
export async function adminSignIn(email: string, password: string): Promise<AdminUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email.trim(), password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminApiError(res.status, body.error ?? 'Login failed', body.code, body);
  }
  if (!body.accessToken || !body.user) {
    throw new AdminApiError(500, 'Unexpected login response', 'BAD_RESPONSE');
  }
  if (body.user.role === 'CUSTOMER') {
    throw new AdminApiError(403, 'This account does not have admin access', 'NOT_ADMIN');
  }
  setAdminToken(body.accessToken);
  setAdminUser(body.user);
  return body.user as AdminUser;
}

/** Rotate the session via the httpOnly refresh cookie. Returns null if the session is gone. */
export async function adminRefresh(): Promise<AdminUser | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.accessToken || !body?.user) {
    clearAdminSession();
    return null;
  }
  setAdminToken(body.accessToken);
  setAdminUser(body.user);
  return body.user as AdminUser;
}

/** Clear the server session (refresh cookie) and local token. */
export async function adminSignOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best effort — local session is cleared regardless.
  }
  clearAdminSession();
}

/** Authenticated fetch with automatic refresh-on-401 (single retry). */
export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    const refreshed = await adminRefresh();
    if (!refreshed) {
      clearAdminSession();
      throw new AdminApiError(401, 'Session expired — please sign in again', 'UNAUTHENTICATED');
    }
    return adminApi<T>(path, init); // retry once with the rotated token
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body.code === 'ACCOUNT_DEACTIVATED') clearAdminSession();
    throw new AdminApiError(res.status, body.error ?? 'Request failed', body.code, body);
  }
  return body as T;
}

/* ── Typed payloads for the admin pages ─────────────────────────────────── */

export interface DashboardKpis {
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  activeQueue: number;
  pendingAcceptance: number;
  totalCustomers: number;
  totalBranches: number;
  totalMenuItems: number;
}

export interface DashboardData {
  role: AdminRole;
  branchId: string | null;
  kpis: DashboardKpis;
  branches: { id: string; name: string; city: string | null; isActive: boolean; orderCount: number }[];
}

export interface AdminOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface AdminOrder {
  id: string;
  userId: string;
  branchId: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  items: AdminOrderItem[];
  address: {
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    pincode: string;
  } | null;
  user: { id: string; name: string; phone: string | null };
  branch: { id: string; name: string };
  payments: { provider: string; status: string; amount: number }[];
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  role: AdminRole;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  orderCount: number;
  createdAt: string;
}

export interface ReportData {
  scope: 'all' | 'own_branch';
  branchId: string | null;
  summary: {
    revenue: number;
    orderCount: number;
    paidOrderCount: number;
    cancelledOrFailed: number;
    avgOrderValue: number;
  };
  byBranch: { branchId: string; branchName: string; orderCount: number; revenue: number }[];
  daily: { date: string; orders: number; revenue: number }[];
  topItems: { name: string; quantity: number; orders: number }[];
}

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  CUSTOMER: 'Customer',
  BRANCH_ADMIN: 'Branch Admin',
  SUPER_ADMIN: 'Super Admin',
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PLACED: 'Placed',
  ACCEPTED_BY_BRANCH: 'Accepted',
  PREPARING: 'Preparing',
  READY_OR_OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  REJECTED_BY_BRANCH: 'Rejected',
  CANCELLED_BY_CUSTOMER: 'Cancelled',
  PAYMENT_FAILED: 'Payment Failed',
  REFUNDED: 'Refunded',
};

export const ORDER_STATUS_TONE: Record<string, string> = {
  PLACED: 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse',
  ACCEPTED_BY_BRANCH: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
  PREPARING: 'bg-blue-100 text-blue-900 border border-blue-300',
  READY_OR_OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-900 border border-purple-300',
  DELIVERED: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
  REJECTED_BY_BRANCH: 'bg-rose-100 text-rose-900 border border-rose-300',
  CANCELLED_BY_CUSTOMER: 'bg-slate-200 text-slate-700',
  PAYMENT_FAILED: 'bg-rose-100 text-rose-900 border border-rose-300',
  REFUNDED: 'bg-slate-200 text-slate-700',
};
