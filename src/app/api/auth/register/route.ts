import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { registerSchema } from '@/lib/auth/validation';
import { hashPassword } from '@/lib/auth/password';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';
import { createSession, toSafeUser } from '@/lib/auth/session';
import { assertSameOrigin, setRefreshCookie } from '@/lib/auth/cookies';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // CSRF: reject cross-origin requests (register sets the refresh cookie).
    assertSameOrigin(req);

    const ip = clientIp(req);
    // Per-IP burst protection on the registration endpoint.
    const hit = await checkRateLimit(`register:ip:${ip}`, { windowMs: 60_000, max: 5 });
    if (!hit.ok) {
      throw new ApiError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: hit.retryAfterMs,
      });
    }

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const input = registerSchema.parse(body);

    const [byEmail, byPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email } }),
      prisma.user.findFirst({ where: { phone: input.phone } }),
    ]);
    if (byEmail)
      throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
    if (byPhone) throw new ApiError(409, 'This phone number is already registered', 'PHONE_TAKEN');

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        passwordHash,
        phoneVerified: false,
      },
    });

    await auditLog({
      userId: user.id,
      action: 'register',
      ...requestContext(req),
      meta: { email: user.email },
    });

    const { accessToken, refreshToken, expiresIn } = await createSession(user, req);

    const response = NextResponse.json(
      {
        accessToken,
        expiresIn,
        user: toSafeUser(user),
        phoneVerificationRequired: !user.phoneVerified,
      },
      { status: 201 }
    );
    setRefreshCookie(response.cookies, refreshToken);
    return response;
  } catch (e) {
    return handleError(e);
  }
}
