import type { NextRequest } from 'next/server';
import { ApiError } from './errors';

/**
 * Defense-in-depth CSRF check. The auth layer uses Bearer tokens (not cookies),
 * so classic CSRF isn't exploitable today — but this guard ensures that if the
 * auth model ever changes, cross-origin form submissions are still blocked.
 *
 * Checks that the request Origin or Referer points at a hostname this app is
 * actually served from. Only works for browser-initiated requests;
 * server-to-server calls won't have these headers and will be allowed through
 * (intentionally — the Bearer token check already gates access).
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

  // Every hostname this request could legitimately have originated from.
  //
  // Browsers set Origin/Referer from the page the request was made on and a
  // third-party page cannot forge it, so matching the HOSTNAME is what makes
  // this a CSRF guard. The scheme is deliberately not compared: TLS normally
  // terminates at a proxy, so the browser sees https://<host> while the app
  // sees plain http on localhost — comparing full origins rejected every real
  // request behind a tunnel (Freebuff/e2b, Vercel previews, ngrok).
  const allowedHosts = new Set<string>();
  const addHost = (value: string | null | undefined) => {
    if (!value) return;
    // Host values may carry a port; strip it before comparing hostnames.
    const host = value.trim().split(',')[0].replace(/:\d+$/, '').toLowerCase();
    if (host) allowedHosts.add(host);
  };

  // x-forwarded-host carries the public hostname when a proxy rewrites Host.
  addHost(req.headers.get('x-forwarded-host'));
  addHost(req.headers.get('host'));
  addHost(process.env.HOSTNAME);
  if (process.env.APP_ORIGIN) {
    try {
      addHost(new URL(process.env.APP_ORIGIN).hostname);
    } catch {
      // Malformed APP_ORIGIN — the request headers above still apply.
    }
  }

  // Nothing to compare against (no Host header, no APP_ORIGIN): allow in dev.
  if (allowedHosts.size === 0) return;

  if (!allowedHosts.has(sourceUrl.hostname.toLowerCase())) {
    throw new ApiError(403, 'Cross-origin request rejected', 'CSRF_ORIGIN_MISMATCH');
  }
}
