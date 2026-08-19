import type { PrismaClient } from '@prisma/client';

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Recompute a menu item's live average rating and reviewCount from its
 * non-hidden reviews. Must be called inside the SAME prisma transaction
 * as any review create/update/delete/hide/unhide — never incrementally
 * math the average in application code (that drifts under concurrent writes).
 *
 * When reviewCount becomes 0, rating is reset to 4.5 (the schema default)
 * so an item with zero real reviews doesn't show 0 stars.
 */
export async function recomputeMenuItemRating(
  tx: TransactionClient,
  menuItemId: string,
): Promise<void> {
  const agg = await tx.review.aggregate({
    where: { menuItemId, isHidden: false },
    _avg: { rating: true },
    _count: true,
  });

  const count = agg._count;
  const avg = agg._avg.rating;

  await tx.menuItem.update({
    where: { id: menuItemId },
    data: {
      rating: count === 0 ? 4.5 : Math.round((avg ?? 4.5) * 10) / 10,
      reviewCount: count,
    },
  });
}
