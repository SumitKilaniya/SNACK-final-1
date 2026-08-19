/**
 * Minimal, lazy Sentry integration for backend exceptions.
 *
 * Inert until SENTRY_DSN is set (Keys/API keys in Freebuff; SENTRY_DSN in
 * production env). Because init is gated and lazy, the SDK never touches the
 * network or slows requests in dev/sandbox — and the app works with zero
 * configuration if Sentry is never provisioned.
 *
 * Sentry is deliberately wired at the single error choke point
 * (src/lib/auth/errors.ts → handleError), so every API route's unhandled
 * 5xx lands here without per-route boilerplate.
 */
import * as Sentry from '@sentry/node';

let initialized = false;

function init(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
  initialized = true;
}

/** Report an exception (or log it locally when Sentry isn't configured). */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) {
    console.error('[monitoring] (Sentry not configured — set SENTRY_DSN)', err);
    return;
  }
  try {
    init();
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch (initErr) {
    // Never let monitoring take the app down.
    console.error('[monitoring] failed to capture error:', initErr);
  }
}
