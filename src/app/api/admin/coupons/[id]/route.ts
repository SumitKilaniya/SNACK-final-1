import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { couponUpdateSchema } from '@/lib/coupon-schemas';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

/**
 * Super admin: update a coupon (rules, value, scope, activation). Deactivating
 * is the soft "delete" — usage history stays intact for reporting. Any change
 * takes effect immediately on the next checkout validation.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Coupon not found', 'COUPON_NOT_FOUND');

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const input = couponUpdateSchema.parse(body);

    // Code uniqueness on rename.
    if (input.code && input.code !== existing.code) {
      const dup = await prisma.coupon.findUnique({ where: { code: input.code } });
      if (dup) throw new ApiError(409, 'A coupon with this code already exists', 'COUPON_CODE_TAKEN');
    }

    // Branch-scoped coupons must reference a real branch.
    if (input.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
      if (!branch) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: input.code ?? existing.code,
        type: input.type ?? existing.type,
        value: input.value ?? existing.value,
        description: input.description !== undefined ? input.description : existing.description,
        minOrderValue: input.minOrderValue ?? existing.minOrderValue,
        maxDiscount: input.maxDiscount !== undefined ? input.maxDiscount : existing.maxDiscount,
        perUserLimit: input.perUserLimit ?? existing.perUserLimit,
        branchId: input.branchId !== undefined ? input.branchId : existing.branchId,
        expiresAt: input.expiresAt !== undefined ? input.expiresAt : existing.expiresAt,
        isActive: input.isActive ?? existing.isActive,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'coupon_updated',
      ...requestContext(req),
      meta: { couponId: id, code: coupon.code, changes: Object.keys(input) },
    });

    return NextResponse.json({ coupon });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: soft-delete a coupon (deactivate; history is preserved). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Coupon not found', 'COUPON_NOT_FOUND');

    await prisma.coupon.update({ where: { id }, data: { isActive: false } });

    await auditLog({
      userId: authed.user.id,
      action: 'coupon_deactivated',
      ...requestContext(req),
      meta: { couponId: id, code: existing.code },
    });

    return NextResponse.json({ deactivated: true });
  } catch (e) {
    return handleError(e);
  }
}
