import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole, requireBranchAccess } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { prisma } from '@/lib/auth/prisma';
import { refundOrderPayment } from '@/lib/payments/service';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/**
 * Trigger a refund for a rejected / cancelled / payment-failed order.
 * Calls the gateway's refund API (Stripe refund, or COD bookkeeping) and moves
 * the order to REFUNDED. Access: SUPER_ADMIN anywhere; BRANCH_ADMIN only for
 * their own branch — enforced server-side via requireRole + requireBranchAccess.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN', 'BRANCH_ADMIN')(authed);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    await requireBranchAccess(req, order.branchId);

    const { refundRef } = await refundOrderPayment({
      orderId,
      actor: { userId: authed.user.id, role: authed.user.role },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'order_refunded',
      ...requestContext(req),
      meta: { orderId, refundRef, amount: order.total },
    });
    return NextResponse.json({ refunded: true, refundRef });
  } catch (e) {
    return handleError(e);
  }
}
