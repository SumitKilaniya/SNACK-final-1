import { z } from 'zod';

export const pincodeSchema = z
  .array(z.string().regex(/^\d{6}$/, 'Pincode must be a 6-digit number'))
  .max(200);

export const branchCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(1).max(80).optional(),
  address: z.string().trim().min(1).max(300).optional(),
  servicePincodes: pincodeSchema.optional(),
});

export const branchUpdateSchema = branchCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const menuItemCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().min(1).max(60),
  basePrice: z.number().int().min(0).max(1_000_000),
  isAvailable: z.boolean().optional(),
  isVeg: z.boolean().optional().nullable(),
  imageUrl: z.string().trim().url().max(500).optional().nullable(),
  isBestseller: z.boolean().optional(),
  badge: z.string().trim().max(60).optional().nullable(),
  rating: z.number().min(0).max(5).optional(),
});

export const menuItemUpdateSchema = menuItemCreateSchema.partial();

export const overrideUpsertSchema = z.object({
  itemId: z.string().min(1),
  /** null → fall back to the master base price */
  priceOverride: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isAvailable: z.boolean().optional(),
});

export const overrideDeleteSchema = z.object({
  itemId: z.string().min(1),
});
