import type { NextRequest } from 'next/server';
import type { Role, User } from '@prisma/client';
import { prisma } from './prisma';
import { verifyAccessToken } from './jwt';
import { ApiError, forbidden, unauthorized } from './errors';
import { toSafeUser, type SafeUser } from './session';

export interface AuthedRequest {
  user: SafeUser;
  /** full DB row — for writes that need fields not exposed in SafeUser */
  dbUser: User;
}

/** Verify the Bearer access token and load the user, checking token_version. */
export async function requireAuth(req: NextRequest): Promise<AuthedRequest> {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  const claims = await verifyAccessToken(token);
  if (!claims) throw unauthorized('Session expired');

  const dbUser = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!dbUser || dbUser.tokenVersion !== claims.tv) {
    throw unauthorized('Session revoked');
  }
  // Deactivated accounts are rejected on EVERY protected route — this is the
  // single choke point; no endpoint can forget to check it.
  if (dbUser.deactivatedAt) {
    throw new ApiError(403, 'This account has been deactivated', 'ACCOUNT_DEACTIVATED');
  }
  return { user: toSafeUser(dbUser), dbUser };
}

/** Assert the user holds at least one of the given roles. */
export function requireRole(...roles: Role[]) {
  return ({ user }: AuthedRequest) => {
    if (!roles.includes(user.role)) throw forbidden();
  };
}

/**
 * Assert the user may operate on a specific branch:
 * super_admin → any branch; branch_admin → only their own.
 */
export async function requireBranchAccess(
  req: NextRequest,
  branchId: string
): Promise<AuthedRequest> {
  const authed = await requireAuth(req);
  if (authed.user.role === 'SUPER_ADMIN') return authed;
  if (authed.user.role === 'BRANCH_ADMIN' && authed.user.branchId === branchId) return authed;
  throw forbidden('You can only access your own branch');
}
