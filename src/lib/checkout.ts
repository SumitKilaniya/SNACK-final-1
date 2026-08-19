import { prisma } from '@/lib/auth/prisma';
import { ApiError } from '@/lib/auth/errors';
import { computeCartSummary, DELIVERY_FEE } from '@/lib/cart';
import { parsePincodes } from '@/lib/catalog';
import { validateAndComputeCoupon } from '@/lib/coupons';
import { notifyBranchNewOrder } from '@/lib/notifications';
import type { Order } from '@prisma/client';

export interface CheckoutInput {
  addressId: string;
  paymentMethod?: 'cod' | 'card';
  notes?: string;
  /** Dedupe key: a retried checkout with the same key returns the same order. */
  idempotencyKey?: string;
  /** Promo code. Validated + recomputed server-side; the client never sends a discount. */
  couponCode?: string;
}

export interface CheckoutResult {
  order: Order;
  duplicated: boolean;
}

/**
 * Checkout, entirely server-side:
 *  - Idempotency: an existing order with the same idempotencyKey is returned.
 *  - The cart is recomputed from the DB catalog (client prices ignored).
 *  - Every line must still be available at the cart's branch.
 *  - The chosen saved address must belong to the user AND its pincode must be
 *    inside the branch's service area.
 *  - Order totals + line-item snapshots are written in a transaction, then the
 *    cart is cleared. Coupon discounts arrive in Phase 7 (discount = 0).
 */
export async function runCheckout(userId: string, input: CheckoutInput): Promise<CheckoutResult> {
  // 1. Idempotency — duplicate submissions return the first order.
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { order: existing, duplicated: true };
  }

  // 2. Server-side cart totals (client never supplies prices).
  const summary = await computeCartSummary(userId);
  if (!summary || summary.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty', 'CART_EMPTY');
  }

  const unavailable = summary.items.filter((i) => !i.isAvailable);
  if (unavailable.length > 0) {
    throw new ApiError(409, 'Some items in your cart are no longer available', 'ITEMS_UNAVAILABLE', {
      items: unavailable.map((i) => i.name),
    });
  }

  // 3. Branch must still be active.
  const branch = await prisma.branch.findUnique({ where: { id: summary.branchId } });
  if (!branch || !branch.isActive) {
    throw new ApiError(400, 'Selected branch is not available right now', 'BRANCH_UNAVAILABLE');
  }

  // 4. Address: must be the customer's own, and inside the branch's service area.
  const address = await prisma.address.findFirst({ where: { id: input.addressId, userId } });
  if (!address) throw new ApiError(404, 'Address not found', 'ADDRESS_NOT_FOUND');

  const pincodes = parsePincodes(branch);
  if (!pincodes.includes(address.pincode)) {
    throw new ApiError(
      422,
      `This address is outside ${branch.name}'s delivery area`,
      'OUTSIDE_DELIVERY_AREA',
      { pincode: address.pincode, branchPincodes: pincodes }
    );
  }

  // 5. Totals — computed here, from the DB, every time. A coupon is validated
  // against ALL of its rules and its discount recomputed; the request never
  // carries a discount amount, so a crafted value is structurally impossible.
  const subtotal = summary.subtotal;
  const deliveryFee = DELIVERY_FEE;
  let discount = 0;
  let couponId: string | null = null;
  if (input.couponCode) {
    const validated = await validateAndComputeCoupon({
      code: input.couponCode,
      userId,
      branchId: branch.id,
      subtotal,
      deliveryFee,
    });
    discount = validated.discount;
    couponId = validated.coupon.id;
  }
  const total = subtotal + deliveryFee - discount;

  // 6. Persist order + line snapshots + coupon usage + initial status log in
  // one transaction — the usage row is created with the order, so a retried or
  // duplicate checkout can never double-count a redemption.
  try {
    const order = await prisma.$transaction(
      async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          branchId: branch.id,
          addressId: address.id,
          couponId,
          status: 'PLACED',
          subtotal,
          deliveryFee,
          discount,
          total,
          paymentMethod: input.paymentMethod ?? 'cod',
          paymentStatus: 'pending',
          idempotencyKey: input.idempotencyKey ?? null,
          notes: input.notes ?? null,
          items: {
            create: summary.items.map((i) => ({
              itemId: i.itemId,
              name: i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          },
          statusLogs: {
            create: [{ toStatus: 'PLACED', actorUserId: userId, actorRole: 'CUSTOMER' }],
          },
        },
        include: { items: true },
      });
      if (couponId) {
        await tx.couponUsage.create({
          data: { couponId, userId, orderId: created.id, discount },
        });
      }
      await tx.cart.delete({ where: { userId } });
      return created;
    },
      { timeout: 15_000 }
    );
    // Alert the branch's admins (SMS + email) that a new order is in the
    // queue — fire-and-forget, never blocks checkout.
    void notifyBranchNewOrder(order);
    return { order, duplicated: false };
  } catch (e) {
    // Unique idempotencyKey collision from a concurrent duplicate → return it.
    if (input.idempotencyKey && isUniqueViolation(e)) {
      const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { order: existing, duplicated: true };
    }
    throw e;
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === 'P2002'
  );
}
