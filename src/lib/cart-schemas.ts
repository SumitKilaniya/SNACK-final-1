import { z } from 'zod';

export const cartAddSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
  /** When provided and different from the cart's current branch, the cart
   * switches branches and existing items are cleared. */
  branchId: z.string().min(1).optional(),
});

export const cartQtySchema = z.object({
  /** 0 removes the line. */
  quantity: z.number().int().min(0).max(99),
});

export const cartBranchSchema = z.object({
  branchId: z.string().min(1),
});

export const addressCreateSchema = z.object({
  label: z.string().trim().max(40).optional(),
  line1: z.string().trim().min(2).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be a 6-digit number'),
  isDefault: z.boolean().optional(),
});

export const addressUpdateSchema = addressCreateSchema.partial();

export const checkoutSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(['cod', 'card']).optional(),
  notes: z.string().trim().max(500).optional(),
  /** Dedupe key — a retried checkout with the same key returns the same order. */
  idempotencyKey: z.string().min(8).max(200).optional(),
  /** Promo code — validated server-side; the discount is recomputed, never accepted. */
  couponCode: z.string().trim().min(2).max(40).optional(),
});
