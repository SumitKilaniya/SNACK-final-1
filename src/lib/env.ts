
/**
 * Server startup gate — runs once at boot, before any request is served.
 *
 * Wired in two places:
 * 1. src/instrumentation.ts
 * 2. src/app/layout.tsx
 *
 * Missing required variables or an unreachable production database
 * cause startup to fail with a descriptive error.
 *
 * SERVER-ONLY: Never import this from a client component.
 */

// Avoid statically importing Prisma into the initial server bundle.
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

const DB_PROBE_TIMEOUT_MS = 3000;

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_EDGE = process.env.NEXT_RUNTIME === 'edge';

async function verifyDatabase(): Promise<void> {
  let error: unknown;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const { prisma } = await import('@/lib/auth/prisma');

    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(
            new Error(`connection timed out after ${DB_PROBE_TIMEOUT_MS}ms`)
          ),
          DB_PROBE_TIMEOUT_MS
        );
      }),
    ]);

    return;
  } catch (e) {
    error = e;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const message = error instanceof Error ? error.message : String(error);

  if (IS_PRODUCTION) {
    throw new Error(
      `[startup] FATAL: cannot reach PostgreSQL — ${message}`
    );
  }

  console.warn(
    `[startup] Notice: database probe unready or offline — ${message}`
  );
}

export async function runStartupChecks(): Promise<void> {
  if (IS_PRODUCTION) {
    const required = [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_RESET_SECRET',
      'APP_ORIGIN',
      'NEXT_PUBLIC_SITE_URL',
      'EMAIL_PROVIDER',
      'RESEND_API_KEY',
      'RESEND_FROM',
      'SMS_PROVIDER',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
    ];

    const missing = required.filter((name) => !process.env[name]);

    if (missing.length) {
      throw new Error(
        `[startup] FATAL: missing required production env var(s): ${missing.join(', ')}`
      );
    }

    for (const name of ['JWT_ACCESS_SECRET', 'JWT_RESET_SECRET']) {
      const secret = process.env[name] ?? '';

      if (
        secret.length < 32 ||
        /local-only|change-before-production|placeholder/i.test(secret)
      ) {
        throw new Error(
          `[startup] FATAL: ${name} must be at least 32 characters in production`
        );
      }
    }

    if (process.env.JWT_ACCESS_SECRET === process.env.JWT_RESET_SECRET) {
      throw new Error(
        '[startup] FATAL: JWT_ACCESS_SECRET and JWT_RESET_SECRET must be different'
      );
    }

    if (!/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL ?? '')) {
      throw new Error(
        '[startup] FATAL: DATABASE_URL must be a PostgreSQL connection string'
      );
    }

    if (process.env.EMAIL_PROVIDER !== 'resend') {
      throw new Error(
        '[startup] FATAL: EMAIL_PROVIDER must be set to resend in production'
      );
    }

    if (process.env.SMS_PROVIDER !== 'twilio') {
      throw new Error(
        '[startup] FATAL: SMS_PROVIDER must be set to twilio in production'
      );
    }

    if (!process.env.TWILIO_FROM && !process.env.TWILIO_PHONE_NUMBER) {
      throw new Error(
        '[startup] FATAL: TWILIO_FROM or TWILIO_PHONE_NUMBER is required in production'
      );
    }

    for (const name of ['APP_ORIGIN', 'NEXT_PUBLIC_SITE_URL']) {
      let url: URL;

      try {
        url = new URL(process.env[name] ?? '');
      } catch {
        throw new Error(
          `[startup] FATAL: ${name} must be a valid HTTPS URL`
        );
      }

      if (url.protocol !== 'https:' || url.origin !== process.env[name]) {
        throw new Error(
          `[startup] FATAL: ${name} must be an HTTPS origin without a trailing path`
        );
      }
    }
  } else {
    process.env.JWT_ACCESS_SECRET ??=
      'snackpod-jwt-access-secret-32-chars-dev';

    process.env.JWT_RESET_SECRET ??=
      'snackpod-jwt-reset-secret-32-chars-dev';

    process.env.APP_ORIGIN ??= 'http://localhost:3000';

    process.env.DATABASE_URL ??=
      'postgresql://snackpod:snackpod@localhost:5432/snackpod';

    if (!process.env['NEXT_PUBLIC_SITE_URL']) {
  process.env['NEXT_PUBLIC_SITE_URL'] = 'http://localhost:3000';
}
  }

  for (const { name, disabled } of OPTIONAL) {
    if (!process.env[name]) {
      console.info(`[startup] ${name} not set — ${disabled}`);
    }
  }

  await verifyDatabase();

  console.info('[startup] env OK, booting Snack-Pod');
}

export const startupGate: Promise<void> =
  IS_BUILD || IS_EDGE
    ? Promise.resolve()
    : runStartupChecks();
