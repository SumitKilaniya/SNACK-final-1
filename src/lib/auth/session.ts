import type { User } from '@prisma/client';
import { issueSessionTokens } from './tokens';
import type { NextRequest } from 'next/server';
import { clientIp } from './rate-limit';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  phoneVerified: boolean;
  role: 'CUSTOMER' | 'BRANCH_ADMIN' | 'SUPER_ADMIN';
  branchId: string | null;
  emailVerified: boolean;
  createdAt: string;
}

/** Strip every sensitive field before a user ever leaves the server. */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    role: user.role,
    branchId: user.branchId,
    emailVerified: true, // email/password signup doesn't do email verification yet
    createdAt: user.createdAt.toISOString(),
  };
}

/** Issue access + refresh tokens for a user (route sets the refresh cookie). */
export async function createSession(
  user: User,
  req: NextRequest
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const { accessToken, refreshToken } = await issueSessionTokens(user, {
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return { accessToken, refreshToken, expiresIn: 15 * 60 };
}
