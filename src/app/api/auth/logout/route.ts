import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/auth/errors';
import { revokeRefreshToken } from '@/lib/auth/tokens';
import { assertSameOrigin, clearRefreshCookie, getRefreshToken } from '@/lib/auth/cookies';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const raw = getRefreshToken(req.cookies);
    const userId = raw ? await revokeRefreshToken(raw) : null;
    await auditLog({ userId, action: 'logout', ...requestContext(req) });
    const response = NextResponse.json({ ok: true });
    clearRefreshCookie(response.cookies);
    return response;
  } catch (e) {
    return handleError(e);
  }
}
