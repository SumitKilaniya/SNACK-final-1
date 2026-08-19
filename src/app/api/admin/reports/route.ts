import { NextRequest, NextResponse } from 'next/server';
import { forbidden, handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

/**
 * Revenue & order-volume analytics.
 *  - SUPER_ADMIN: any branch (?branchId=) or all, any date range (?from=, ?to=).
 *  - BRANCH_ADMIN: always forced to their own branch — a forged ?branchId is ignored.
 * "Revenue" counts orders whose money actually settled (paymentStatus = paid,
 * which COD reaches at delivery). Refunded/rejected/cancelled orders are never
 * revenue; they appear in volume only.
 */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);

    const sp = req.nextUrl.searchParams;
    let branchId = sp.get('branchId');
    if (authed.user.role === 'BRANCH_ADMIN') {
      branchId = authed.user.branchId;
    } else if (authed.user.role !== 'SUPER_ADMIN') {
      throw forbidden();
    }

    const from = sp.get('from') ? new Date(sp.get('from') as string) : null;
    const to = sp.get('to') ? new Date(sp.get('to') as string) : null;
    if (from && Number.isNaN(from.getTime())) {
      return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
    }
    if (to && Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid to date' }, { status: 400 });
    }

    const baseWhere = {
      ...(branchId ? { branchId } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    const [orders, byBranchAgg, revenueByBranchAgg, topItems, branchList] = await Promise.all([
      prisma.order.findMany({
        where: baseWhere,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
          branchId: true,
          items: { select: { name: true, quantity: true, unitPrice: true, total: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.groupBy({
        by: ['branchId'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['branchId'],
        where: { ...baseWhere, paymentStatus: 'paid' },
        _sum: { total: true },
      }),
      prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: baseWhere },
        _sum: { quantity: true },
        _count: { _all: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      prisma.branch.findMany({ select: { id: true, name: true } }),
    ]);

    const revenue = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.total, 0);
    const paidCount = orders.filter((o) => o.paymentStatus === 'paid').length;
    const cancelledOrFailed = orders.filter((o) =>
      ['REJECTED_BY_BRANCH', 'CANCELLED_BY_CUSTOMER', 'PAYMENT_FAILED', 'REFUNDED'].includes(
        o.status
      )
    ).length;

    const branchNames = new Map(branchList.map((b) => [b.id, b.name]));
    const revenueByBranch = new Map(revenueByBranchAgg.map((r) => [r.branchId, r._sum.total ?? 0]));
    const byBranch = byBranchAgg.map((r) => ({
      branchId: r.branchId,
      branchName: branchNames.get(r.branchId) ?? 'Unknown',
      orderCount: r._count._all,
      revenue: revenueByBranch.get(r.branchId) ?? 0,
    }));

    // Daily revenue series (paid orders only) for the chart.
    const dailyMap = new Map<string, { date: string; orders: number; revenue: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const day = dailyMap.get(key) ?? { date: key, orders: 0, revenue: 0 };
      day.orders += 1;
      if (o.paymentStatus === 'paid') day.revenue += o.total;
      dailyMap.set(key, day);
    }
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    await auditLog({
      userId: authed.user.id,
      action: 'reports_read',
      ...requestContext(req),
      meta: { branchId: branchId ?? null, from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    });

    return NextResponse.json({
      scope: authed.user.role === 'SUPER_ADMIN' ? 'all' : 'own_branch',
      branchId: branchId ?? null,
      summary: {
        revenue,
        orderCount: orders.length,
        paidOrderCount: paidCount,
        cancelledOrFailed,
        avgOrderValue: paidCount > 0 ? Math.round(revenue / paidCount) : 0,
      },
      byBranch,
      daily,
      topItems: topItems.map((t) => ({
        name: t.name,
        quantity: t._sum.quantity ?? 0,
        orders: t._count._all,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
