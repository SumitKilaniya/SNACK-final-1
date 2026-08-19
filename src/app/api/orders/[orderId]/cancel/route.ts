import { NextRequest, NextResponse } from 'next/server';
import { ApiError, forbidden, handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { prisma } from '@/lib/auth/prisma';
import { transitionOrder } from '@/lib/orders';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Cancel the caller's own order — only within the 5-minute window. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    if (order.userId !== authed.user.id) throw forbidden();

    const updated = await transitionOrder(orderId, 'CANCELLED_BY_CUSTOMER', {
      userId: authed.user.id,
      role: authed.user.role,
    });

    await auditLog({
      userId: authed.user.id,
      action: 'order_cancelled_by_customer',
      ...requestContext(req),
      meta: { orderId },
    });
    return NextResponse.json({ order: updated });
  } catch (e) {
    return handleError(e);
  }
}
