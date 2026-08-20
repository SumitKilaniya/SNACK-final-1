'use client';

/**
 * Customer-facing session + API layer.
 *
 * Security model:
 * - The durable session lives ONLY in the httpOnly `sp_refresh` cookie
 *   (set by the server). It is never readable from JS.
 * - The short-lived access token is kept in a module-level variable — never
 *   localStorage, never sessionStorage, never a readable cookie — so XSS
 *   cannot exfiltrate a live credential. It dies on page reload; the silent
 *   refresh flow (Task: session hydration) restores it from the cookie.
 * - Every authenticated request goes through `authenticatedFetch`, which
 *   retries exactly once after a token rotation on 401.
 */

import { setAdminToken, setAdminUser, clearAdminSession } from './admin-api';

export type UserRole = 'CUSTOMER' | 'BRANCH_ADMIN' | 'SUPER_ADMIN';

/** Mirrors SafeUser from src/lib/auth/session.ts (the backend's shape). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  phoneVerified: boolean;
  role: UserRole;
  branchId: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface LoginInput {
  identifier: string; // email OR phone number
  password: string;
  captchaToken?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

export interface RegisterResult extends AuthSession {
  phoneVerificationRequired: boolean;
}

export interface ForgotPasswordResult {
  ok: boolean;
  message: string;
  // DEV ONLY — the backend never includes this in production builds.
  devLink?: string;
}

export interface OtpSendResult {
  ok: boolean;
  resendAfterMs: number;
  // DEV ONLY — the backend never includes this in production builds.
  devCode?: string;
}

/** Error carrying the HTTP status + machine-readable code from the API. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/* ── In-memory access token ─────────────────────────────────────────────── */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

type UnauthorizedHandler = () => void;

// Registered by AuthProvider so an exhausted session can reset UI state.
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function notifyUnauthorized(): void {
  accessToken = null;
  unauthorizedHandler?.();
}

/* ── Low-level helpers ──────────────────────────────────────────────────── */

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toError(res: Response, body: Record<string, unknown>): ApiClientError {
  return new ApiClientError(
    res.status,
    typeof body.error === 'string' ? body.error : 'Request failed',
    typeof body.code === 'string' ? body.code : undefined,
    body
  );
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw toError(res, data);
  return data as T;
}

/**
 * Silently obtain a fresh access token from the httpOnly refresh cookie.
 * Returns null (and clears the in-memory token) when there is no session —
 * callers treat that as "signed out", never as an error to surface.
 */
export async function refreshSession(): Promise<SessionUser | null> {
  try {
    const data = await post<AuthSession>('/api/auth/refresh');
    accessToken = data.accessToken;
    if (data.user && (data.user.role === 'SUPER_ADMIN' || data.user.role === 'BRANCH_ADMIN')) {
      setAdminToken(data.accessToken);
      setAdminUser(data.user as never);
    }
    return data.user;
  } catch {
    accessToken = null;
    return null;
  }
}

/**
 * Authenticated fetch: attaches the bearer token, and on a 401 rotates the
 * session via the refresh cookie once and retries the original request
 * exactly once before giving up and signing the user out.
 */
export async function authenticatedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const buildInit = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  let res = await fetch(path, buildInit(accessToken));

  if (res.status === 401) {
    const user = await refreshSession();
    if (!user) {
      notifyUnauthorized();
      throw new ApiClientError(
        401,
        'Your session has expired. Please sign in again.',
        'UNAUTHENTICATED'
      );
    }
    res = await fetch(path, buildInit(accessToken)); // retry once with the rotated token
  }

  const data = await parseJson(res);
  if (!res.ok) throw toError(res, data);
  return data as T;
}

/* ── Typed wrappers (contracts match src/app/api/auth/*) ────────────────── */

/** POST /api/auth/login → { accessToken, expiresIn, user } */
export async function login(input: LoginInput): Promise<AuthSession> {
  const data = await post<AuthSession>('/api/auth/login', input);
  accessToken = data.accessToken;
  if (data.user && (data.user.role === 'SUPER_ADMIN' || data.user.role === 'BRANCH_ADMIN')) {
    setAdminToken(data.accessToken);
    setAdminUser(data.user as never);
  }
  return data;
}

/** POST /api/auth/register → 201 { accessToken, expiresIn, user, phoneVerificationRequired } */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const data = await post<RegisterResult>('/api/auth/register', input);
  accessToken = data.accessToken;
  return data;
}

/** POST /api/auth/logout → { ok: true } (clears the httpOnly refresh cookie). */
export async function logout(): Promise<void> {
  try {
    await post<{ ok: boolean }>('/api/auth/logout');
  } finally {
    accessToken = null;
    clearAdminSession();
  }
}

/** POST /api/auth/logout-all → { ok: true } (revokes every session for the user). */
export async function logoutAll(): Promise<void> {
  try {
    await authenticatedFetch<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST' });
  } finally {
    accessToken = null;
  }
}

/** GET /api/auth/me → { user } */
export async function me(): Promise<SessionUser> {
  const data = await authenticatedFetch<{ user: SessionUser }>('/api/auth/me');
  return data.user;
}

/** POST /api/auth/forgot-password → { ok, message, devLink? } */
export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  return post<ForgotPasswordResult>('/api/auth/forgot-password', { email });
}

/** POST /api/auth/reset-password → { ok: true } */
export async function resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/api/auth/reset-password', { token, password });
}

/** POST /api/auth/otp/send → { ok, resendAfterMs, devCode? } */
export async function otpSend(phone: string): Promise<OtpSendResult> {
  return post<OtpSendResult>('/api/auth/otp/send', { phone });
}

/** POST /api/auth/otp/verify → { ok, phoneVerified } */
export async function otpVerify(
  phone: string,
  code: string
): Promise<{ ok: boolean; phoneVerified: boolean }> {
  return post<{ ok: boolean; phoneVerified: boolean }>('/api/auth/otp/verify', { phone, code });
}
