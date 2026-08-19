import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ApiError, handleError } from '@/lib/auth/errors';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';
import { rotateRefreshToken } from '@/lib/auth/tokens';
import {
  assertSameOrigin,
  clearRefreshCookie,
  getRefreshToken,
  setRefreshCookie,
} from '@/lib/auth/cookies';
import { toSafeUser } from '@/lib/auth/session';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // CSRF: reject cross-origin requests that carry our cookie.
    assertSameOrigin(req);

    const ip = clientIp(req);
    const hit = await checkRateLimit(`refresh:ip:${ip}`, { windowMs: 60_000, max: 10 });
    if (!hit.ok) {
      throw new ApiError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: hit.retryAfterMs,
      });
    }

    const store = await cookies();
    const raw = getRefreshToken(store);
    if (!raw) throw new ApiError(401, 'No active session', 'NO_SESSION');

    const result = await rotateRefreshToken(raw, requestContext(req));

    if (!result.ok) {
      clearRefreshCookie(store);
      if (result.reason === 'reuse') {
        // Reuse detection already revoked every session server-side.
        await auditLog({
          action: 'refresh_token_reuse_attempt',
          ip,
          meta: { reason: result.reason },
        });
        throw new ApiError(401, 'Session has been revoked', 'SESSION_REVOKED');
      }
      throw new ApiError(401, 'No active session', 'NO_SESSION');
    }

    setRefreshCookie(store, result.refreshToken);
    return NextResponse.json({
      accessToken: result.accessToken,
      expiresIn: 15 * 60,
      user: toSafeUser(result.user),
    });
  } catch (e) {
    return handleError(e);
  }
}
