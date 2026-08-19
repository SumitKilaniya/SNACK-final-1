import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { resetPasswordSchema } from '@/lib/auth/validation';
import { verifyResetToken } from '@/lib/auth/jwt';
import { hashPassword } from '@/lib/auth/password';
import { revokeAllSessionsForUser } from '@/lib/auth/tokens';
import { requestContext } from '@/lib/auth/rate-limit';
import { assertSameOrigin } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const { token, password } = resetPasswordSchema.parse(body);

    const claims = await verifyResetToken(token);
    if (!claims)
      throw new ApiError(400, 'This reset link is invalid or has expired', 'RESET_TOKEN_INVALID');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (
      !row ||
      row.usedAt ||
      row.expiresAt.getTime() < Date.now() ||
      row.userId !== claims.userId
    ) {
      throw new ApiError(400, 'This reset link is invalid or has expired', 'RESET_TOKEN_INVALID');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);

    // Kill every existing session — password change forces re-login everywhere.
    await revokeAllSessionsForUser(row.userId, 'password_change', requestContext(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
