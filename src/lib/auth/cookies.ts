import type { NextRequest } from 'next/server';

/** Minimal structural type for the Next.js cookies() store we use. */
interface CookieStore {
  set(name: string, value: string, options?: Record<string, unknown>): void;
  get(name: string): { name: string; value: string } | undefined;
}
import { ApiError } from './errors';
import { REFRESH_TOKEN_TTL_DAYS } from './tokens';

export const REFRESH_COOKIE = 'sp_refresh';
export const GOOGLE_STATE_COOKIE = 'sp_oauth_state';

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  };
}

export function setRefreshCookie(store: Pick<CookieStore, 'set'>, token: string) {
  store.set(REFRESH_COOKIE, token, refreshCookieOptions());
}

export function clearRefreshCookie(store: Pick<CookieStore, 'set'>) {
  store.set(REFRESH_COOKIE, '', { ...refreshCookieOptions(), maxAge: 0 });
}

export function getRefreshToken(store: CookieStore): string | undefined {
  return store.get(REFRESH_COOKIE)?.value;
}

/**
 * CSRF defense-in-depth for every cookie-mutating endpoint.
 *
 * - The refresh cookie is SameSite=Strict, so browsers won't attach it to
 *   cross-site requests at all.
 * - Additionally, when a browser sends an Origin header (it does for all
 *   fetch POSTs), we require it to match either the configured APP_ORIGIN or
 *   the same host the request hit. Requests without an Origin header
 *   (curl, native clients, same-host fetches without CORS mode) pass.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const configured = process.env.APP_ORIGIN;
  if (origin === configured) return;
  // Allow the request's own host (covers port drift in local dev).
  try {
    const reqUrl = new URL(req.url);
    if (origin === reqUrl.origin) return;
  } catch {
    /* ignore */
  }
  throw new ApiError(403, 'Cross-origin request rejected', 'CSRF');
}

/** CORS headers allowing only the configured frontend origin with credentials. */
export function corsHeaders(): Record<string, string> {
  // Dev fallback mirrors getGoogleConfig; production sets APP_ORIGIN to the
  // canonical https:// origin.
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}
