import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

const ACTIVE = ['PLACED', 'ACCEPTED_BY_BRANCH', 'PREPARING', 'READY_OR_OUT_FOR_DELIVERY'];

/**
 * Branch queue.
 *  - BRANCH_ADMIN: always their own branch (branchId from the account, never
 *    from the client — a forged branchId gets the admin's own branch).
 *  - SUPER_ADMIN: optionally ?branchId=, ?status=, ?from=, ?to=; without a
 *    branch, all branches. Status filters accept a comma-separated list.
 * Sorted oldest-first so new orders surface at the bottom of the queue.
 */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);

    const sp = req.nextUrl.searchParams;
    let branchId: string | null = null;
    if (authed.user.role === 'BRANCH_ADMIN') {
      branchId = authed.user.branchId;
    } else if (authed.user.role === 'SUPER_ADMIN') {
      branchId = sp.get('branchId');
    } else {
      throw new ApiError(403, 'You do not have permission to do this', 'FORBIDDEN');
    }

    // Filters (super admin cross-branch view).
    const statusRaw = sp.get('status');
    const statuses = statusRaw && statusRaw !== 'all' ? statusRaw.split(',').map((s) => s.trim()) : null;
    const from = sp.get('from') ? new Date(sp.get('from') as string) : null;
    const to = sp.get('to') ? new Date(sp.get('to') as string) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      throw new ApiError(400, 'Invalid date filter', 'BAD_DATE');
    }

    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    const orders = await prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(statuses
          ? { status: { in: statuses as never[] } }
          : { status: { notIn: ['DELIVERED', 'REJECTED_BY_BRANCH', 'CANCELLED_BY_CUSTOMER', 'REFUNDED'] } }),
        ...(from || to
          ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        address: true,
        user: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        payments: { select: { provider: true, status: true, amount: true } },
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'orders_queue_listed',
      ...requestContext(req),
      meta: { branchId, statuses, from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    });
    return NextResponse.json({ branchId, orders });
  } catch (e) {
    return handleError(e);
  }
}
