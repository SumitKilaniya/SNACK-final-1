import { NextRequest, NextResponse } from 'next/server';
import { ApiError, safeEqual } from '@/lib/auth/errors';
import {
  exchangeCodeForTokens,
  fetchGoogleUserinfo,
  findOrCreateUserFromGoogle,
  verifyGoogleIdToken,
} from '@/lib/auth/google';
import { GOOGLE_STATE_COOKIE, setRefreshCookie } from '@/lib/auth/cookies';
import { clientIp } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const expected = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;

    if (!code || !state || !expected || !safeEqual(state, expected)) {
      throw new ApiError(400, 'OAuth state mismatch', 'GOOGLE_STATE_MISMATCH');
    }

    const tokens = await exchangeCodeForTokens(code);
    // Server-side ID-token verification (signature, issuer, audience).
    let profile;
    try {
      profile = await verifyGoogleIdToken(tokens.id_token);
    } catch {
      profile = await fetchGoogleUserinfo(tokens.access_token);
    }

    const user = await findOrCreateUserFromGoogle(profile, {
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    const { refreshToken } = await createSession(user, req);

    const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    const response = NextResponse.redirect(`${origin}/?auth=success`);
    response.cookies.set(GOOGLE_STATE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    setRefreshCookie(response.cookies, refreshToken);
    return response;
  } catch (e) {
    console.error('[auth] google callback failed:', e);
    const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    // Redirect to the app with a flag rather than leaking error details.
    const response = NextResponse.redirect(`${origin}/?auth=error`);
    response.cookies.set(GOOGLE_STATE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
