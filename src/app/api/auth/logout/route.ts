import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handleError } from '@/lib/auth/errors';
import { revokeRefreshToken } from '@/lib/auth/tokens';
import { assertSameOrigin, clearRefreshCookie, getRefreshToken } from '@/lib/auth/cookies';
import { clientIp, requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const store = await cookies();
    const raw = getRefreshToken(store);
    const userId = raw ? await revokeRefreshToken(raw) : null;
    clearRefreshCookie(store);
    await auditLog({ userId, action: 'logout', ...requestContext(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
