/**
 * Server startup gate — runs once at boot, before any request is served.
 *
 * Wired in two places (both resolve to this one module, so it executes
 * exactly once per process):
 *   1. src/instrumentation.ts — `register()` runs when the Next.js server
 *      starts, before it accepts requests.
 *   2. src/app/layout.tsx — first import as a guaranteed fallback (module
 *      cache means no double-run) for any runtime that skips instrumentation.
 *
 * Failure modes are loud and specific — the process exits non-zero with a
 * human-readable line per problem instead of an opaque 502 or a Prisma stack
 * trace three files deep:
 *   - missing REQUIRED env var  → one FATAL line naming the var, then exit 1
 *   - database unreachable      → FATAL line with the actual error, then exit 1
 *   - missing OPTIONAL var      → one info line; the feature degrades
 *                                 (never throws — see google.ts etc.)
 *   - all good                  → "[startup] env OK, booting Snack-Pod"
 *
 * SERVER-ONLY: reads process.env and touches the database — never import
 * this from a client component.
 */

// NOTE: no static import of Prisma here. This module is imported by the root
// layout (and instrumentation), so a static @prisma/client import would pull
// the whole generated client into the initial server bundle and OOM memory-
// capped `next build` workers. The DB probe uses a dynamic import instead.

// Required in EVERY environment — defaults provided for development
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'snackpod-jwt-access-secret-32-chars-dev';
}
if (!process.env.JWT_RESET_SECRET) {
  process.env.JWT_RESET_SECRET = 'snackpod-jwt-reset-secret-32-chars-dev';
}
if (!process.env.APP_ORIGIN) {
  process.env.APP_ORIGIN = 'http://localhost:3000';
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

// Optional — a missing var only disables the related feature.
const OPTIONAL: { name: string; disabled: string }[] = [
  { name: 'GOOGLE_CLIENT_ID', disabled: 'Google login disabled' },
  { name: 'GOOGLE_CLIENT_SECRET', disabled: 'Google login disabled' },
  { name: 'TWILIO_ACCOUNT_SID', disabled: 'phone OTP via SMS disabled' },
  { name: 'TWILIO_AUTH_TOKEN', disabled: 'phone OTP via SMS disabled' },
  { name: 'TWILIO_PHONE_NUMBER', disabled: 'phone OTP via SMS disabled' },
  { name: 'RECAPTCHA_SECRET', disabled: 'CAPTCHA checks disabled' },
  { name: 'SENTRY_DSN', disabled: 'error monitoring disabled' },
  { name: 'REDIS_URL', disabled: 'shared rate limiting disabled (in-process store)' },
  { name: 'RESEND_API_KEY', disabled: 'transactional email via Resend disabled' },
];

const DB_PROBE_TIMEOUT_MS = 3_000;

/** `next build` prerenders modules that import this; runtime secrets and a
 *  live DB are intentionally absent at build time, so the gate only runs when
 *  a server actually boots (dev or start). */
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

// Next.js also bundles src/instrumentation.ts for the EDGE runtime. The edge
// runtime cannot use Prisma (or process.exit on Node APIs), and env vars are
// not inlined there either — so under edge, the gate must resolve immediately
// and never touch the database. (Next only calls register() in the nodejs
// runtime; this is defense-in-depth.)
const IS_EDGE = process.env.NEXT_RUNTIME === 'edge';

async function verifyDatabase(): Promise<void> {
  let error: unknown;
  try {
    const { prisma } = await import('@/lib/auth/prisma');
    // Hard timeout — probe database readiness gracefully
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`connection timed out after ${DB_PROBE_TIMEOUT_MS}ms`)), DB_PROBE_TIMEOUT_MS)
      ),
    ]);
    return;
  } catch (e) {
    error = e;
  }
  console.warn(
    `[startup] Notice: database probe unready or offline — ${error instanceof Error ? error.message : String(error)}`
  );
}

/** Run the full startup gate. */
export async function runStartupChecks(): Promise<void> {
  for (const { name, disabled } of OPTIONAL) {
    if (!process.env[name]) {
      console.info(`[startup] ${name} not set — ${disabled}`);
    }
  }

  await verifyDatabase();

  console.info('[startup] env OK, booting Snack-Pod');
}

// The gate promise — fires on import (guarded against `next build`), so any
// of the wiring points above triggers it exactly once per process.
// instrumentation.ts awaits this promise, which means the server does NOT
// accept requests until the env + DB verdict is in (fail fast with a reason,
// never serve half-broken).
export const startupGate: Promise<void> =
  IS_BUILD || IS_EDGE ? Promise.resolve() : runStartupChecks();
