import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireBranchAccess } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { prisma } from '@/lib/auth/prisma';
import { getOrderDetail, transitionOrder } from '@/lib/orders';
import { adminOrderStatusSchema } from '@/lib/order-schemas';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Branch-scoped admin view of one order (with items, address, timeline). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');

    // Server-side branch check: branch_admin may only view their own branch.
    await requireBranchAccess(req, order.branchId);

    const detail = await getOrderDetail(orderId);
    await auditLog({
      userId: authed.user.id,
      action: 'order_admin_read',
      ...requestContext(req),
      meta: { orderId },
    });
    return NextResponse.json({ order: detail });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Advance (or reject) an order's status.
 *   { status: 'ACCEPTED_BY_BRANCH' | 'PREPARING' | 'READY_OR_OUT_FOR_DELIVERY' |
 *            'DELIVERED' | 'REJECTED_BY_BRANCH', reason? }
 * Access is branch-scoped server-side: a branch admin acting on another
 * branch's order gets 403 even with a forged body.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    await requireBranchAccess(req, order.branchId);

    const input = adminOrderStatusSchema.parse(await req.json());
    const updated = await transitionOrder(
      orderId,
      input.status,
      { userId: authed.user.id, role: authed.user.role },
      { note: input.reason }
    );

    // COD settlement: cash is collected when the branch marks the order DELIVERED.
    if (updated.status === 'DELIVERED' && updated.paymentMethod === 'cod') {
      await prisma.$transaction([
        prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'paid' } }),
        prisma.payment.updateMany({
          where: { orderId, status: 'pending' },
          data: { status: 'succeeded' },
        }),
      ]);
    }

    await auditLog({
      userId: authed.user.id,
      action: 'order_status_changed',
      ...requestContext(req),
      meta: { orderId, from: order.status, to: input.status, reason: input.reason ?? null },
    });
    return NextResponse.json({ order: updated });
  } catch (e) {
    return handleError(e);
  }
}
