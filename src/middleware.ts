import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge Runtime — no Prisma, no Node core modules, no next/headers. Use
 * req.cookies only.
 *
 * Helmet-style security headers applied to every non-static response.
 *
 * CSP note: `'unsafe-inline'` in script-src/style-src is required by Next.js
 * for its inline hydration/bootstrap payloads. No third-party scripts are
 * loaded by the app, so the allowlist stays strictly self + inline.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.stripe.com https://lumberjack.razorpay.com https:",
  "frame-src 'self' https://js.stripe.com https://api.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self' https:",
].join('; ');

/**
 * Matches REFRESH_COOKIE in src/lib/auth/cookies.ts. (Importing that module
 * here would drag server-only dependencies into the edge bundle, so the
 * constant is duplicated deliberately.)
 */
const REFRESH_COOKIE = 'sp_refresh';

/** Customer pages that require a session (UX guard only — see below). */
const PROTECTED_PATHS = ['/account', '/orders', '/favourites', '/checkout'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // UX convenience only: redirect signed-out visitors to /auth. This CANNOT
  // cryptographically verify the session (no DB access at the edge) — a stale
  // or forged cookie still gets checked server-side. The actual security
  // boundary for these pages remains each API route's requireAuth() check,
  // which is unaffected by this redirect. /admin/* protection is unchanged:
  // it's handled client-side by admin-context plus each admin route's
  // requireRole() check.
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  const hasSessionCookie = !!req.cookies.get(REFRESH_COOKIE)?.value;

  let res: NextResponse;
  if (isProtected && !hasSessionCookie) {
    // Param name matches what /auth reads back (returnUrl).
    const authUrl = new URL('/auth', req.url);
    authUrl.searchParams.set('returnUrl', pathname);
    res = NextResponse.redirect(authUrl);
  } else {
    res = NextResponse.next();
  }

  res.headers.set('Content-Security-Policy', CSP);
  // Clickjacking: CSP frame-ancestors + legacy header for compatibility.
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Legacy header — modern browsers ignore it; kept for older engines.
  res.headers.set('X-XSS-Protection', '0');

  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return res;
}

// Skip static assets, image optimization and favicon — they don't need CSP.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
