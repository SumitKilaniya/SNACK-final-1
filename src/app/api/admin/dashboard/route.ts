import { NextRequest, NextResponse } from 'next/server';
import { forbidden, handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

const ACTIVE = ['PLACED', 'ACCEPTED_BY_BRANCH', 'PREPARING', 'READY_OR_OUT_FOR_DELIVERY'];

/**
 * Admin dashboard: real KPIs.
 *  - SUPER_ADMIN: metrics across every branch + per-branch breakdown.
 *  - BRANCH_ADMIN: everything scoped to their own branch (never client-supplied).
 * Revenue = settled money only (paymentStatus 'paid', which COD reaches at delivery).
 */
export async function GET(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    if (authed.user.role !== 'SUPER_ADMIN' && authed.user.role !== 'BRANCH_ADMIN') {
      throw forbidden();
    }

    const scopeWhere =
      authed.user.role === 'BRANCH_ADMIN' && authed.user.branchId
        ? { branchId: authed.user.branchId }
        : {};

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      paidSum,
      activeCount,
      pendingCount,
      customerCount,
      branchCount,
      menuCount,
      todayPaid,
    ] = await Promise.all([
      prisma.order.count({ where: scopeWhere }),
      prisma.order.count({ where: { ...scopeWhere, createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({ where: { ...scopeWhere, paymentStatus: 'paid' }, _sum: { total: true } }),
      prisma.order.count({ where: { ...scopeWhere, status: { in: ACTIVE as never[] } } }),
      prisma.order.count({ where: { ...scopeWhere, status: 'PLACED' } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.branch.count(),
      prisma.menuItem.count(),
      prisma.order.aggregate({
        where: { ...scopeWhere, createdAt: { gte: todayStart }, paymentStatus: 'paid' },
        _sum: { total: true },
      }),
    ]);

    const branches =
      authed.user.role === 'SUPER_ADMIN'
        ? await prisma.branch.findMany({
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              city: true,
              isActive: true,
              _count: { select: { orders: true } },
            },
          })
        : null;

    await auditLog({
      userId: authed.user.id,
      action: 'admin_dashboard',
      ...requestContext(req),
    });

    return NextResponse.json({
      role: authed.user.role,
      branchId: authed.user.branchId ?? null,
      kpis: {
        totalOrders,
        todayOrders,
        totalRevenue: paidSum._sum.total ?? 0,
        todayRevenue: todayPaid._sum.total ?? 0,
        activeQueue: activeCount,
        pendingAcceptance: pendingCount,
        totalCustomers: customerCount,
        totalBranches: branchCount,
        totalMenuItems: menuCount,
      },
      branches: branches?.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        isActive: b.isActive,
        orderCount: b._count.orders,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
