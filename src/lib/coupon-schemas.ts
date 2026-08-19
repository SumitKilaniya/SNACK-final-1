import { z } from 'zod';

export const couponCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, _ and -')
    .transform((s) => s.toUpperCase()),
  type: z.enum(['FLAT', 'PERCENTAGE', 'FREE_DELIVERY', 'FIRST_ORDER']),
  /** FLAT: rupees; PERCENTAGE / FIRST_ORDER: percent; FREE_DELIVERY: unused. */
  value: z.number().int().min(0).max(1_000_000),
  description: z.string().trim().max(300).optional().nullable(),
  minOrderValue: z.number().int().min(0).max(10_000_000).default(0),
  /** Absolute discount cap for PERCENTAGE / FIRST_ORDER types. */
  maxDiscount: z.number().int().min(0).max(10_000_000).nullable().optional(),
  perUserLimit: z.number().int().min(1).max(1000).default(1),
  /** null/absent = global; otherwise restricted to one branch. */
  branchId: z.string().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const couponUpdateSchema = couponCreateSchema.partial();

export const couponValidateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  branchId: z.string().min(1),
  subtotal: z.number().int().min(0),
  deliveryFee: z.number().int().min(0).default(0),
});
