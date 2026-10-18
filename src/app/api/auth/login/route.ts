import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { loginSchema } from '@/lib/auth/validation';
import { verifyPassword } from '@/lib/auth/password';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';
import { createSession, toSafeUser } from '@/lib/auth/session';
import { assertSameOrigin, setRefreshCookie } from '@/lib/auth/cookies';
import { auditLog } from '@/lib/auth/audit';
import { verifyCaptcha } from '@/lib/auth/captcha';

export const runtime = 'nodejs';

const LOCK_AFTER_FAILURES = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const CAPTCHA_AFTER_FAILURES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  try {
    // CSRF: reject cross-origin requests (login sets the refresh cookie).
    assertSameOrigin(req);

    const ip = clientIp(req);
    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const input = loginSchema.parse(body);
    const identifier = input.identifier.trim().toLowerCase();

    // IP + identifier based rate limiting (generic 429, no hinting).
    const hit = await checkRateLimit(`login:${identifier}:${ip}`, { windowMs: 60_000, max: 5 });
    if (!hit.ok) {
      throw new ApiError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: hit.retryAfterMs,
      });
    }

    const user =
      (await prisma.user.findUnique({ where: { email: identifier } }).catch(() => null)) ??
      (await prisma.user.findFirst({ where: { phone: identifier } }).catch(() => null));

    // Uniform branch: wrong credentials, unknown account, locked account
    // and Google-only accounts all yield the same generic message.
    if (!user) {
      await sleep(300);
      throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await auditLog({ userId: user.id, action: 'login_blocked_locked', ip, meta: { identifier } });
      throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Deactivated accounts get the same generic error as bad credentials — no
    // account enumeration, and the user can't re-authenticate until a super
    // admin reactivates them.
    if (user.deactivatedAt) {
      await auditLog({
        userId: user.id,
        action: 'login_blocked_deactivated',
        ip,
        meta: { identifier },
      });
      await sleep(300);
      throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Tier 2: auto-lock after 10 consecutive failures.
    if (user.failedLoginAttempts >= LOCK_AFTER_FAILURES) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS), failedLoginAttempts: 0 },
      });
      await auditLog({
        userId: user.id,
        action: 'account_locked',
        ip,
        meta: { durationMs: LOCK_DURATION_MS },
      });
      throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Tier 1: CAPTCHA required after 5 failures.
    if (user.failedLoginAttempts >= CAPTCHA_AFTER_FAILURES && process.env.RECAPTCHA_SECRET) {
      const captchaOk = await verifyCaptcha(input.captchaToken);
      if (!captchaOk) {
        throw new ApiError(400, 'Please complete the security check', 'CAPTCHA_REQUIRED', {
          captchaRequired: true,
        });
      }
    }

    const passwordOk = user.passwordHash
      ? await verifyPassword(user.passwordHash, input.password)
      : false;
    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts } });
      await auditLog({ userId: user.id, action: 'login_failed', ip, meta: { attempts } });
      await sleep(300);
      throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Success — clear the throttling state.
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const { accessToken, refreshToken, expiresIn } = await createSession(user, req);
    const store = await cookies();
    setRefreshCookie(store, refreshToken);
    await auditLog({ userId: user.id, action: 'login', ...requestContext(req) });

    return NextResponse.json({ accessToken, expiresIn, user: toSafeUser(user) });
  } catch (e) {
    return handleError(e);
  }
}
