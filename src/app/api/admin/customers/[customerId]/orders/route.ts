import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);
    const { customerId } = await params;

    const customer = await prisma.user.findFirst({
      where: { id: customerId, role: 'CUSTOMER' },
      select: { id: true },
    });
    if (!customer) throw new ApiError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');

    const orders = await prisma.order.findMany({
      where: { userId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        subtotal: true,
        deliveryFee: true,
        discount: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'customer_order_history_viewed',
      ...requestContext(req),
      meta: { customerId, orderCount: orders.length },
    });

    return NextResponse.json({ orders });
  } catch (e) {
    return handleError(e);
  }
}
