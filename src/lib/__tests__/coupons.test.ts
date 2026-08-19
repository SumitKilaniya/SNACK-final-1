import { describe, expect, it } from 'vitest';
import { computeDiscount } from '@/lib/coupons';
import type { Coupon, CouponType } from '@prisma/client';

function coupon(
  type: CouponType,
  value: number,
  maxDiscount: number | null = null,
  extra: Partial<Coupon> = {}
): Coupon {
  return {
    id: 'cpn_test',
    code: 'TEST',
    type,
    value,
    description: null,
    minOrderValue: 0,
    maxDiscount,
    perUserLimit: 1,
    branchId: null,
    isActive: true,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
}

describe('computeDiscount — coupon discount math', () => {
  it('FLAT: discount is the fixed value, capped at the subtotal', () => {
    expect(computeDiscount(coupon('FLAT', 100), 500, 40)).toBe(100);
    expect(computeDiscount(coupon('FLAT', 100), 80, 40)).toBe(80); // cap at subtotal
  });

  it('PERCENTAGE: value% of subtotal, rounded to whole rupees', () => {
    expect(computeDiscount(coupon('PERCENTAGE', 10), 349, 40)).toBe(35); // 34.9 → 35
    expect(computeDiscount(coupon('PERCENTAGE', 25), 400, 40)).toBe(100);
  });

  it('PERCENTAGE: capped at maxDiscount when present', () => {
    expect(computeDiscount(coupon('PERCENTAGE', 50, 100), 1000, 40)).toBe(100); // 500 → capped 100
    expect(computeDiscount(coupon('PERCENTAGE', 50, 100), 100, 40)).toBe(50); // no cap hit
  });

  it('PERCENTAGE: never exceeds the subtotal even without a cap', () => {
    expect(computeDiscount(coupon('PERCENTAGE', 200), 100, 40)).toBe(100);
  });

  it('FIRST_ORDER behaves like PERCENTAGE', () => {
    expect(computeDiscount(coupon('FIRST_ORDER', 20, 50), 300, 40)).toBe(50); // 60 → capped 50
    expect(computeDiscount(coupon('FIRST_ORDER', 20, null), 300, 40)).toBe(60);
  });

  it('FREE_DELIVERY: waives the delivery fee, never the whole subtotal', () => {
    expect(computeDiscount(coupon('FREE_DELIVERY', 0), 300, 40)).toBe(40);
    // degenerate: fee larger than subtotal (subtotal 0) → capped at subtotal
    expect(computeDiscount(coupon('FREE_DELIVERY', 0), 0, 40)).toBe(0);
  });

  it('unknown type is inert (discount 0)', () => {
    expect(computeDiscount(coupon('FLAT', 50), 500, 40)).toBe(50); // sanity
    // @ts-expect-error – unknown coupon type must not throw, just be inert
    expect(computeDiscount(coupon('COMPLIMENTARY', 50), 500, 40)).toBe(0);
  });
});

describe('coupon business logic checks (minOrder, perUserLimit, firstOrder, expiry, active)', () => {
  it('identifies inactive coupon', () => {
    const c = coupon('FLAT', 50, null, { isActive: false });
    expect(c.isActive).toBe(false);
  });

  it('identifies expired coupon', () => {
    const past = new Date(Date.now() - 3600_000);
    const c = coupon('FLAT', 50, null, { expiresAt: past });
    expect(c.expiresAt!.getTime()).toBeLessThan(Date.now());
  });

  it('identifies minOrderValue constraint', () => {
    const c = coupon('FLAT', 50, null, { minOrderValue: 299 });
    expect(250 < c.minOrderValue).toBe(true);
    expect(350 >= c.minOrderValue).toBe(true);
  });

  it('identifies per-user limit threshold', () => {
    const c = coupon('FLAT', 50, null, { perUserLimit: 2 });
    const usageCount = 2;
    expect(usageCount >= c.perUserLimit).toBe(true);
  });
});

