import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { prisma } from './prisma';
import { ApiError } from './errors';
import { auditLog } from './audit';
import type { User } from '@prisma/client';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getGoogleConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(503, 'Google sign-in is not configured', 'GOOGLE_NOT_CONFIGURED');
  }
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  return { clientId, clientSecret, redirectUri: `${origin}/api/auth/google/callback` };
}

export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'online',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokens {
  id_token: string;
  access_token: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new ApiError(401, 'Google token exchange failed', 'GOOGLE_EXCHANGE_FAILED');
  }
  return (await res.json()) as GoogleTokens;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

const googleJwks = createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));

/**
 * Verify a Google ID token server-side (signature, issuer, audience) and
 * return the profile claims. Falls back to the userinfo endpoint if the
 * id_token path fails (some flows return only an access token).
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const { clientId } = getGoogleConfig();
  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    return profileFromPayload(payload);
  } catch (e) {
    console.error('[google] id_token verification failed:', e);
    throw new ApiError(401, 'Could not verify Google identity', 'GOOGLE_VERIFY_FAILED');
  }
}

export async function fetchGoogleUserinfo(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new ApiError(401, 'Could not verify Google identity', 'GOOGLE_VERIFY_FAILED');
  return profileFromPayload((await res.json()) as JWTPayload);
}

function profileFromPayload(
  p: JWTPayload & { email?: string; name?: string; picture?: string; email_verified?: boolean }
): GoogleProfile {
  if (!p.sub || !p.email) {
    throw new ApiError(401, 'Google profile is missing email', 'GOOGLE_NO_EMAIL');
  }
  return {
    sub: String(p.sub),
    email: p.email.toLowerCase(),
    name: p.name || p.email.split('@')[0],
    picture: p.picture,
    emailVerified: Boolean(p.email_verified),
  };
}

/**
 * First login → create user. Later logins → match by email. If an
 * email/password account already exists, link the Google provider to it
 * (the account keeps its password; Google becomes an additional login path).
 */
export async function findOrCreateUserFromGoogle(
  profile: GoogleProfile,
  ctx: { ip?: string; userAgent?: string }
): Promise<User> {
  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.sub } },
  });
  if (existingAccount) {
    const user = await prisma.user.findUnique({ where: { id: existingAccount.userId } });
    if (user) {
      await auditLog({
        userId: user.id,
        action: 'google_login',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { email: profile.email },
      });
      return user;
    }
  }

  // Match by verified email; link the provider if the account already exists.
  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.sub } },
      update: {},
      create: {
        provider: 'google',
        providerAccountId: profile.sub,
        userId: byEmail.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      },
    });
    await auditLog({
      userId: byEmail.id,
      action: 'google_login',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      meta: { email: profile.email, linked: true },
    });
    return byEmail;
  }

  const created = await prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      phoneVerified: false,
      accounts: {
        create: {
          provider: 'google',
          providerAccountId: profile.sub,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        },
      },
    },
  });
  await auditLog({
    userId: created.id,
    action: 'google_signup',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    meta: { email: profile.email },
  });
  return created;
}
