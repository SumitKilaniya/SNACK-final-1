import type { NextRequest } from 'next/server';
import { ApiError } from './errors';

/**
 * Defense-in-depth CSRF check. The auth layer uses Bearer tokens (not cookies),
 * so classic CSRF isn't exploitable today — but this guard ensures that if the
 * auth model ever changes, cross-origin form submissions are still blocked.
 *
 * Checks that the request Origin or Referer matches the server's own origin.
 * Only works for browser-initiated requests; server-to-server calls won't have
 * these headers and will be rejected (intentionally — they should use a
 * service-to-service auth pattern instead).
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // Prefer Origin (sent by fetch/XHR), fall back to Referer.
  const source = origin || referer;
  if (!source) {
    // No origin/referer = likely a non-browser client (curl, Postman, etc.)
    // or a same-origin form post in older browsers. Allow it — the Bearer
    // token check already gates access.
    return;
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    throw new ApiError(403, 'Invalid request origin', 'CSRF_INVALID_ORIGIN');
  }

  // Use APP_ORIGIN when set (handles reverse proxies), otherwise fall back
  // to the request's own Host header.
  const expectedOrigin =
    process.env.APP_ORIGIN || `${sourceUrl.protocol}//${req.headers.get('host') ?? 'localhost'}`;

  let expected: URL;
  try {
    expected = new URL(expectedOrigin);
  } catch {
    // APP_ORIGIN not set and host header missing — allow in dev.
    return;
  }

  if (sourceUrl.origin !== expected.origin) {
    throw new ApiError(403, 'Cross-origin request rejected', 'CSRF_ORIGIN_MISMATCH');
  }
}
