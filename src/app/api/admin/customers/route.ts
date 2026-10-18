import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    assertSameOrigin(req);

    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        orders: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            status: true,
            subtotal: true,
            deliveryFee: true,
            discount: true,
            total: true,
            paymentMethod: true,
            createdAt: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'customer_data_listed',
      ...requestContext(req),
      meta: {
        customerCount: customers.length,
      },
    });

    return NextResponse.json({
      customers,
    });
  } catch (e) {
    return handleError(e);
  }
}
