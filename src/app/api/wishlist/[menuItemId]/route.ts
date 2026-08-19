import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { ApiError, handleError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { auditLog } from '@/lib/auth/audit';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** DELETE /api/wishlist/[menuItemId] — idempotent: removing a non-existent item succeeds. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ menuItemId: string }> },
) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);

    const ip = clientIp(req);
    const burst = await checkRateLimit(`wishlist:del:${ip}`, { windowMs: 60_000, max: 30 });
    if (!burst.ok) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: burst.retryAfterMs,
      });
    }

    const { menuItemId } = await params;

    const existing = await prisma.wishlist.findUnique({
      where: { userId_menuItemId: { userId: authed.user.id, menuItemId } },
    });

    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
    }

    await auditLog({
      userId: authed.user.id,
      action: 'wishlist_item_removed',
      ...requestContext(req),
      meta: { menuItemId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
