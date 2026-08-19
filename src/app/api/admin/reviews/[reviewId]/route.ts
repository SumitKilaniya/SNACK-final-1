import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { handleError, ApiError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { z } from 'zod';
import { recomputeMenuItemRating } from '@/lib/reviews';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

const adminReviewPatchSchema = z.object({
  isHidden: z.boolean(),
});

/** Super admin: toggle review visibility (hide/unhide). Recomputes aggregate. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);
    const { reviewId } = await params;

    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');

    const input = adminReviewPatchSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: { isHidden: input.isHidden },
      });
      await recomputeMenuItemRating(tx, existing.menuItemId);
      return review;
    });

    await auditLog({
      userId: authed.user.id,
      action: input.isHidden ? 'review_hidden' : 'review_unhidden',
      ...requestContext(req),
      meta: { reviewId, menuItemId: existing.menuItemId },
    });

    return NextResponse.json({ review: updated });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: permanently delete a review. Recomputes aggregate. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);
    const { reviewId } = await params;

    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });
      await recomputeMenuItemRating(tx, existing.menuItemId);
    });

    await auditLog({
      userId: authed.user.id,
      action: 'review_permanently_deleted',
      ...requestContext(req),
      meta: { reviewId, menuItemId: existing.menuItemId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
