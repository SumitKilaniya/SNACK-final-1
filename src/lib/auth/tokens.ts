import { createHash, randomBytes, randomUUID } from 'crypto';
import { prisma } from './prisma';
import type { User } from '@prisma/client';

export const REFRESH_TOKEN_TTL_DAYS = 30;

/** Request context captured on every session, for audit + reuse forensics. */
export interface TokenRequestContext {
  ip?: string;
  userAgent?: string;
}

/** Generate a fresh opaque refresh token (only its hash is ever stored). */
export function generateRefreshToken(): string {
  return `sp_rt_${randomBytes(32).toString('base64url')}`;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Create a refresh-token row + issue a fresh access token for a user. */
export async function issueSessionTokens(
  user: User,
  ctx: TokenRequestContext
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const { signAccessToken } = await import('./jwt');
  const raw = generateRefreshToken();
  const jti = randomUUID();
  await prisma.refreshToken.create({
    data: {
      jti,
      userId: user.id,
      tokenHash: hashRefreshToken(raw),
      expiresAt: refreshTokenExpiry(),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
  });
  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
    tokenVersion: user.tokenVersion,
  });
  return { accessToken, refreshToken: raw, expiresAt: refreshTokenExpiry() };
}

export type RotateResult =
  | { ok: true; accessToken: string; refreshToken: string; user: User; expiresAt: Date }
  | { ok: false; reason: 'invalid' | 'reuse' | 'revoked' };

/**
 * Rotate a refresh token. On success the presented token is revoked and a new
 * one is issued. Re-presenting an already-rotated token is treated as token
 * reuse: every session for that user is revoked and their token_version is
 * bumped so all outstanding access tokens die too.
 */
export async function rotateRefreshToken(
  raw: string,
  ctx: TokenRequestContext
): Promise<RotateResult> {
  const tokenHash = hashRefreshToken(raw);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) return { ok: false, reason: 'invalid' };
  if (existing.expiresAt.getTime() < Date.now()) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return { ok: false, reason: 'invalid' };
  }
  // Revoked because it was rotated away (replacedByJti set) → reuse attempt.
  if (existing.revokedAt && existing.replacedByJti) {
    await revokeAllSessionsForUser(existing.userId, 'refresh_token_reuse', ctx);
    return { ok: false, reason: 'reuse' };
  }
  // Revoked explicitly (logout / logout-all) → simply invalid.
  if (existing.revokedAt) return { ok: false, reason: 'revoked' };

  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user) return { ok: false, reason: 'invalid' };

  // Deactivated accounts cannot rotate tokens — their sessions die on the
  // next refresh, even if a stolen refresh cookie is still valid.
  if (user.deactivatedAt) return { ok: false, reason: 'revoked' };

  // Rotate: new token row, old row marked revoked + linked to replacement.
  const newJti = randomUUID();
  const newRaw = generateRefreshToken();
  const newExpiresAt = refreshTokenExpiry();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByJti: newJti },
    }),
    prisma.refreshToken.create({
      data: {
        jti: newJti,
        userId: user.id,
        tokenHash: hashRefreshToken(newRaw),
        expiresAt: newExpiresAt,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    }),
  ]);

  const { signAccessToken } = await import('./jwt');
  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
    tokenVersion: user.tokenVersion,
  });
  return { ok: true, accessToken, refreshToken: newRaw, user, expiresAt: newExpiresAt };
}

/** Revoke a single refresh token (logout). Returns the owning user id, if any. */
export async function revokeRefreshToken(raw: string): Promise<string | null> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(raw) } });
  if (!row) return null;
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return row.userId;
}

/** Revoke every session for a user and bump token_version (logout-all, reuse, password change). */
export async function revokeAllSessionsForUser(
  userId: string,
  action: 'logout_all' | 'password_change' | 'refresh_token_reuse',
  ctx: TokenRequestContext
): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
  ]);
  const { auditLog } = await import('./audit');
  await auditLog({ userId, action, ip: ctx.ip, userAgent: ctx.userAgent });
}
