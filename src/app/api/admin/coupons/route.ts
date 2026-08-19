import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { couponCreateSchema } from '@/lib/coupon-schemas';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';

export const runtime = 'nodejs';

/** Super admin: list every coupon with redemption counts and branch scope. */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const sp = req.nextUrl.searchParams;
    const search = sp.get('search')?.trim();
    const type = sp.get('type');
    const onlyActive = sp.get('status') === 'active';

    const coupons = await prisma.coupon.findMany({
      where: {
        ...(search ? { code: { contains: search } } : {}),
        ...(type && ['FLAT', 'PERCENTAGE', 'FREE_DELIVERY', 'FIRST_ORDER'].includes(type)
          ? { type: type as never }
          : {}),
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { usages: true } },
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'coupons_listed',
      ...requestContext(req),
    });

    return NextResponse.json({
      coupons: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        description: c.description,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount,
        perUserLimit: c.perUserLimit,
        branchId: c.branchId,
        branchName: c.branch?.name ?? null,
        isActive: c.isActive,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        usageCount: c._count.usages,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: create a coupon. */
export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const input = couponCreateSchema.parse(body);

    // Branch-scoped coupons must reference a real branch.
    if (input.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
      if (!branch) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    const exists = await prisma.coupon.findUnique({ where: { code: input.code } });
    if (exists) throw new ApiError(409, 'A coupon with this code already exists', 'COUPON_CODE_TAKEN');

    const coupon = await prisma.coupon.create({
      data: {
        code: input.code,
        type: input.type,
        value: input.value,
        description: input.description ?? null,
        minOrderValue: input.minOrderValue,
        maxDiscount: input.maxDiscount ?? null,
        perUserLimit: input.perUserLimit,
        branchId: input.branchId ?? null,
        expiresAt: input.expiresAt ?? null,
        isActive: input.isActive ?? true,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'coupon_created',
      ...requestContext(req),
      meta: { couponId: coupon.id, code: coupon.code, type: coupon.type },
    });

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
