import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ApiError, handleError, safeEqual } from '@/lib/auth/errors';
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

    const store = await cookies();
    const expected = store.get(GOOGLE_STATE_COOKIE)?.value;
    store.delete(GOOGLE_STATE_COOKIE);

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
    setRefreshCookie(store, refreshToken);

    const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    return NextResponse.redirect(`${origin}/?auth=success`);
  } catch (e) {
    console.error('[auth] google callback failed:', e);
    const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    // Redirect to the app with a flag rather than leaking error details.
    return NextResponse.redirect(`${origin}/?auth=error`);
  }
}
