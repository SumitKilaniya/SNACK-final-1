import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'crypto';
import type { Role } from '@prisma/client';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const RESET_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const ISSUER = 'snackpod';
const AUDIENCE = 'snackpod-web';

const encoder = new TextEncoder();
const getAccessKey = () => encoder.encode(requireSecret('JWT_ACCESS_SECRET'));
const getResetKey = () => encoder.encode(requireSecret('JWT_RESET_SECRET'));

/**
 * DEV-ONLY fallbacks so the sandbox preview works without env setup.
 * Never active in production: NODE_ENV=production always requires the real
 * vars (≥32 random chars, set via Keys/API keys or deploy env). These values
 * are never real secrets — they must never be used for live data.
 */
const DEV_FALLBACKS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'dev-sandbox-access-secret-0123456789abcdef',
  JWT_RESET_SECRET: 'dev-sandbox-reset-secret-0123456789abcdef',
};

function requireSecret(name: string): string {
  const v = process.env[name];
  if (v) return v;
  if (process.env.NODE_ENV !== 'production' && DEV_FALLBACKS[name]) {
    if (!process.env.JWT_DEV_FALLBACK_WARNED) {
      console.warn(`[jwt] Using DEV-ONLY fallback for ${name} — set real secrets for any non-sandbox environment`);
      process.env.JWT_DEV_FALLBACK_WARNED = '1';
    }
    return DEV_FALLBACKS[name];
  }
  throw new Error(`Missing required env var: ${name}`);
}

export interface AccessTokenClaims extends JWTPayload {
  role: Role;
  branchId: string | null;
  /** token_version at issue time — checked against the DB to revoke instantly. */
  tv: number;
  type: 'access';
}

export interface ResetTokenClaims extends JWTPayload {
  type: 'reset';
}

/** Sign a short-lived access token for a user. */
export async function signAccessToken(input: {
  userId: string;
  role: Role;
  branchId: string | null;
  tokenVersion: number;
}): Promise<string> {
  return new SignJWT({
    role: input.role,
    branchId: input.branchId,
    tv: input.tokenVersion,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(input.userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getAccessKey());
}

/** Verify an access token. Returns null on any failure (expired, bad sig…). */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.type !== 'access' || typeof payload.tv !== 'number') return null;
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}

/** Sign a single-use password-reset token bound to a user. */
export async function signResetToken(userId: string): Promise<string> {
  return new SignJWT({ type: 'reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${RESET_TOKEN_TTL_SECONDS}s`)
    .sign(getResetKey());
}

/** Verify a password-reset token. Returns the token's jti + subject or null. */
export async function verifyResetToken(
  token: string
): Promise<{ jti: string; userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getResetKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.type !== 'reset' || !payload.sub || !payload.jti) return null;
    return { jti: payload.jti, userId: payload.sub };
  } catch {
    return null;
  }
}

/** Decode exp (seconds) from a JWT without verifying — used for the client's auto-refresh timer. */
export function decodeTokenExpiry(token: string): number | null {
  try {
    const part = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}
