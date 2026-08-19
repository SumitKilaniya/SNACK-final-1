import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handleError } from '@/lib/auth/errors';
import { revokeAllSessionsForUser } from '@/lib/auth/tokens';
import { assertSameOrigin, clearRefreshCookie } from '@/lib/auth/cookies';
import { requestContext } from '@/lib/auth/rate-limit';
import { requireAuth } from '@/lib/auth/guard';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { user } = await requireAuth(req);
    await revokeAllSessionsForUser(user.id, 'logout_all', requestContext(req));
    const store = await cookies();
    clearRefreshCookie(store);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
