import { describe, expect, it } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  clearRefreshCookie,
  getRefreshToken,
  REFRESH_COOKIE,
  setRefreshCookie,
} from '@/lib/auth/cookies';

describe('refresh token cookies', () => {
  it('reads the refresh token from the incoming request', () => {
    const request = new NextRequest('https://snack.test/api/auth/refresh', {
      headers: { cookie: `${REFRESH_COOKIE}=refresh-token` },
    });

    expect(getRefreshToken(request.cookies)).toBe('refresh-token');
  });

  it('sets and clears the refresh token on the outgoing response', () => {
    const response = NextResponse.json({ ok: true });

    setRefreshCookie(response.cookies, 'refresh-token');
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('refresh-token');

    clearRefreshCookie(response.cookies);
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('');
    expect(response.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(0);
  });
});
