import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError } from '@/lib/auth/errors';
import { validateAndComputeCoupon } from '@/lib/coupons';
import { couponValidateSchema } from '@/lib/coupon-schemas';
import { prisma } from '@/lib/auth/prisma';
import { checkRateLimit, clientIp } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/**
 * Preview a coupon without placing an order: checks every rule (active,
 * expiry, branch, min order, per-user limit, first-order) and returns the
 * discount that checkout WOULD apply. No usage is recorded here — that only
 * happens in the checkout transaction. The checkout endpoint re-validates
 * authoritatively, so this preview can never be trusted to set a price.
 */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);

    const hit = await checkRateLimit(`coupon-validate:${authed.user.id}`, {
      windowMs: 60_000,
      max: 30,
    });
    if (!hit.ok) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const input = couponValidateSchema.parse(body ?? {});

    const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const validated = await validateAndComputeCoupon({
      code: input.code,
      userId: authed.user.id,
      branchId: input.branchId,
      subtotal: input.subtotal,
      deliveryFee: input.deliveryFee,
    });

    return NextResponse.json({
      coupon: {
        id: validated.coupon.id,
        code: validated.coupon.code,
        type: validated.coupon.type,
        value: validated.coupon.value,
        maxDiscount: validated.coupon.maxDiscount,
      },
      discount: validated.discount,
      finalTotal: Math.max(0, input.subtotal + input.deliveryFee - validated.discount),
    });
  } catch (e) {
    return handleError(e);
  }
}
