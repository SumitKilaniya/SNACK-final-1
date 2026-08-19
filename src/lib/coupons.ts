import { prisma } from '@/lib/auth/prisma';
import { ApiError } from '@/lib/auth/errors';
import type { Coupon, CouponType } from '@prisma/client';

export interface ValidateCouponInput {
  code: string;
  userId: string;
  branchId: string;
  subtotal: number;
  deliveryFee: number;
}

export interface ValidatedCoupon {
  coupon: Coupon;
  /** The recomputed discount (whole rupees) applied to this order. */
  discount: number;
}

/**
 * Evaluate a coupon against every rule, server-side:
 *   exists + active + not expired → branch match → min order → per-user limit
 *   → first-order-only → discount computed from the DB catalog.
 * A crafted request that somehow reaches checkout with an expired / used-up /
 * wrong-branch / low-order coupon gets a clear rejection. No usage is recorded
 * here — that happens in the checkout transaction (`recordCouponUsage`).
 */
export async function validateAndComputeCoupon(
  input: ValidateCouponInput
): Promise<ValidatedCoupon> {
  const code = input.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) throw new ApiError(404, 'Coupon not found', 'COUPON_NOT_FOUND');

  if (!coupon.isActive) {
    throw new ApiError(422, 'This coupon is no longer active', 'COUPON_INACTIVE');
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw new ApiError(422, 'This coupon has expired', 'COUPON_EXPIRED');
  }
  if (coupon.branchId && coupon.branchId !== input.branchId) {
    throw new ApiError(422, 'This coupon is not valid for your branch', 'COUPON_BRANCH_MISMATCH');
  }
  if (input.subtotal < coupon.minOrderValue) {
    throw new ApiError(
      422,
      `Minimum order value for this coupon is ₹${coupon.minOrderValue}`,
      'MIN_ORDER_NOT_MET',
      { minOrderValue: coupon.minOrderValue }
    );
  }

  const usageCount = await prisma.couponUsage.count({
    where: { couponId: coupon.id, userId: input.userId },
  });
  if (usageCount >= coupon.perUserLimit) {
    throw new ApiError(
      422,
      'You have already used this coupon the maximum number of times',
      'COUPON_LIMIT_REACHED',
      { limit: coupon.perUserLimit }
    );
  }

  if (coupon.type === 'FIRST_ORDER') {
    const priorOrders = await prisma.order.count({ where: { userId: input.userId } });
    if (priorOrders > 0) {
      throw new ApiError(422, 'This coupon is only valid on your first order', 'COUPON_FIRST_ORDER_ONLY');
    }
  }

  return { coupon, discount: computeDiscount(coupon, input.subtotal, input.deliveryFee) };
}

/**
 * The discount math. FLAT = fixed rupees (never more than the subtotal);
 * PERCENTAGE / FIRST_ORDER = percent of subtotal capped at maxDiscount;
 * FREE_DELIVERY = the delivery fee (waived). Whole rupees throughout.
 */
export function computeDiscount(coupon: Coupon, subtotal: number, deliveryFee: number): number {
  switch (coupon.type as CouponType) {
    case 'FLAT':
      return Math.min(coupon.value, subtotal);
    case 'PERCENTAGE':
    case 'FIRST_ORDER': {
      const raw = Math.round((subtotal * coupon.value) / 100);
      const capped = coupon.maxDiscount !== null && coupon.maxDiscount !== undefined
        ? Math.min(raw, coupon.maxDiscount)
        : raw;
      return Math.min(capped, subtotal);
    }
    case 'FREE_DELIVERY':
      return Math.min(deliveryFee, subtotal);
    default:
      return 0;
  }
}
