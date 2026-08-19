import { describe, expect, it } from 'vitest';
import { computeLineTotals, DELIVERY_FEE } from '@/lib/cart';
import { parsePincodes, resolveItems, stringifyPincodes } from '@/lib/catalog';
import type { BranchMenuOverride, MenuItem } from '@prisma/client';

/** Build a menu item row in the shape resolveItems expects. */
function item(
  over: Partial<MenuItem> & { id: string; name: string },
  overrides: Partial<BranchMenuOverride>[] = []
): MenuItem & { overrides: BranchMenuOverride[] } {
  return {
    description: null,
    category: 'Burgers',
    basePrice: 100,
    isAvailable: true,
    isVeg: true,
    imageUrl: null,
    isBestseller: false,
    badge: null,
    rating: 4.2,
    reviewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    // Spread LAST so caller-passed values win; `over` already carries id/name
    // via its intersection type, so there's no duplicate-key type error.
    ...over,
    overrides: overrides.map((o, i) => ({
      id: `ovr_${over.id}_${i}`,
      branchId: 'br_x',
      itemId: over.id,
      priceOverride: null,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...o,
    })),
  };
}

describe('resolveItems — effective pricing (override ?? base)', () => {
  it('uses the master base price when no override exists', () => {
    const [res] = resolveItems([item({ id: 'm1', name: 'Classic', basePrice: 120 })]);
    expect(res.price).toBe(120);
    expect(res.basePrice).toBe(120);
    expect(res.priceOverridden).toBe(false);
    expect(res.isAvailable).toBe(true);
  });

  it('uses the branch override price when set, flagging priceOverridden', () => {
    const [res] = resolveItems([
      item({ id: 'm1', name: 'Classic', basePrice: 120 }, [{ priceOverride: 99 }]),
    ]);
    expect(res.price).toBe(99);
    expect(res.basePrice).toBe(120);
    expect(res.priceOverridden).toBe(true);
  });

  it('keeps the base price when the override row has a null priceOverride', () => {
    const [res] = resolveItems([
      item({ id: 'm1', name: 'Classic', basePrice: 120 }, [{ priceOverride: null, isAvailable: false }]),
    ]);
    expect(res.price).toBe(120);
    expect(res.priceOverridden).toBe(false);
    expect(res.isAvailable).toBe(false);
  });

  it('a negative or zero override is honored as an override (still replaces base)', () => {
    const [res] = resolveItems([item({ id: 'm1', name: 'Free', basePrice: 120 }, [{ priceOverride: 0 }])]);
    expect(res.price).toBe(0);
    expect(res.priceOverridden).toBe(true);
  });

  it('availability is master AND override (both must be true)', () => {
    // master unavailable, override available → unavailable
    const [a] = resolveItems([item({ id: 'm1', name: 'A', isAvailable: false }, [{ isAvailable: true }])]);
    expect(a.isAvailable).toBe(false);
    // master available, override unavailable → unavailable
    const [b] = resolveItems([item({ id: 'm2', name: 'B', isAvailable: true }, [{ isAvailable: false }])]);
    expect(b.isAvailable).toBe(false);
    // both available → available
    const [c] = resolveItems([item({ id: 'm3', name: 'C', isAvailable: true }, [{ isAvailable: true }])]);
    expect(c.isAvailable).toBe(true);
  });

  it('isAvailable defaults to the master value when there is no override row', () => {
    const [res] = resolveItems([item({ id: 'm1', name: 'Classic', isAvailable: false })]);
    expect(res.isAvailable).toBe(false);
  });
});

describe('parsePincodes / stringifyPincodes', () => {
  it('parses a canonical JSON array', () => {
    expect(parsePincodes({ servicePincodes: '["560001","560002"]' })).toEqual(['560001', '560002']);
  });

  it('falls back to comma-separated strings', () => {
    expect(parsePincodes({ servicePincodes: '560001, 560002' })).toEqual(['560001', '560002']);
  });

  it('returns [] for null/empty/whitespace input', () => {
    expect(parsePincodes({ servicePincodes: null })).toEqual([]);
    expect(parsePincodes({ servicePincodes: '' })).toEqual([]);
    expect(parsePincodes({ servicePincodes: '   ' })).toEqual([]);
  });

  it('round-trips through stringifyPincodes with dedupe', () => {
    expect(stringifyPincodes(['560001', '560001', ' 560002 '])).toBe('["560001","560002"]');
  });
});

describe('computeLineTotals — price/total math (the highest-cost-of-bug area)', () => {
  it('sums unitPrice × quantity into the subtotal and applies the flat fee', () => {
    const r = computeLineTotals(
      [
        { unitPrice: 120, quantity: 2 },
        { unitPrice: 99, quantity: 1 },
        { unitPrice: 50, quantity: 3 },
      ],
      DELIVERY_FEE
    );
    expect(r.subtotal).toBe(240 + 99 + 150);
    expect(r.deliveryFee).toBe(DELIVERY_FEE);
    expect(r.total).toBe(r.subtotal + DELIVERY_FEE);
    expect(r.discount).toBe(0);
  });

  it('subtracts the discount from the total', () => {
    const r = computeLineTotals([{ unitPrice: 500, quantity: 1 }], DELIVERY_FEE, 100);
    expect(r.total).toBe(500 + DELIVERY_FEE - 100);
  });

  it('an empty cart totals to just the delivery fee', () => {
    const r = computeLineTotals([], DELIVERY_FEE, 0);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(DELIVERY_FEE);
  });

  it('never lets a discount push the total negative when capped at the subtotal', () => {
    // coupon math caps discount at subtotal, so total >= deliveryFee always
    const r = computeLineTotals([{ unitPrice: 100, quantity: 1 }], DELIVERY_FEE, 100);
    expect(r.total).toBe(DELIVERY_FEE);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});
