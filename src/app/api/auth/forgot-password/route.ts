import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/auth/prisma';
import { forgotPasswordSchema } from '@/lib/auth/validation';
import { signResetToken, RESET_TOKEN_TTL_SECONDS } from '@/lib/auth/jwt';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import { ApiError, handleError } from '@/lib/auth/errors';
import { assertSameOrigin } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);

    const ip = clientIp(req);
    const hit = await checkRateLimit(`forgot:ip:${ip}`, { windowMs: 60 * 60 * 1000, max: 10 });
    if (!hit.ok) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: hit.retryAfterMs,
      });
    }

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const { email } = forgotPasswordSchema.parse(body);

    // Always return ok: true — never reveal whether an account exists.
    let devLink: string | undefined;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = await signResetToken(user.id);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000);
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt,
        },
      });
      const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
      devLink = `${origin}/reset-password?token=${token}`;
      console.log(`[auth:dev] password reset link for ${email}: ${devLink}`);
      await auditLog({ userId: user.id, action: 'password_reset_requested', ip, meta: { email } });
    } else {
      // Burn identical time to keep the endpoint's latency uniform.
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
      // DEV ONLY: never present in production builds.
      ...(process.env.NODE_ENV !== 'production' && devLink ? { devLink } : {}),
    });
  } catch (e) {
    return handleError(e);
  }
}
