import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getGoogleAuthUrl, getGoogleConfig } from '@/lib/auth/google';
import { handleError } from '@/lib/auth/errors';
import { GOOGLE_STATE_COOKIE } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    getGoogleConfig(); // fail fast with 503 if Google isn't configured
    const state = randomBytes(16).toString('hex');
    const store = await cookies();
    store.set(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 minutes
    });
    return NextResponse.redirect(getGoogleAuthUrl(state));
  } catch (e) {
    return handleError(e);
  }
}
