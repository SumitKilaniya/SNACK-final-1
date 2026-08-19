import { z } from 'zod';

/** Statuses a branch admin can move an order to. */
export const adminOrderStatusSchema = z.object({
  status: z.enum([
    'ACCEPTED_BY_BRANCH',
    'PREPARING',
    'READY_OR_OUT_FOR_DELIVERY',
    'DELIVERED',
    'REJECTED_BY_BRANCH',
  ]),
  /** Required for REJECTED_BY_BRANCH (enforced server-side in transitionOrder). */
  reason: z.string().trim().max(500).optional(),
});
