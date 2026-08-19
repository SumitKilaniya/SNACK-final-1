import { NextRequest, NextResponse } from 'next/server';
import { ApiError, forbidden, handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';
import { prisma } from '@/lib/auth/prisma';
import { getOrderDetail } from '@/lib/orders';

export const runtime = 'nodejs';

/**
 * Customer-facing order status, safe to poll.
 * Only the order's owner may read it — a different customer's orderId yields
 * 403 (IDOR-safe).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const authed = await requireAuth(req);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    if (order.userId !== authed.user.id) throw forbidden();

    const detail = await getOrderDetail(orderId);
    return NextResponse.json({ order: detail });
  } catch (e) {
    return handleError(e);
  }
}
