import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError, ApiError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { reviewUpdateSchema } from '@/lib/review-schemas';
import { recomputeMenuItemRating } from '@/lib/reviews';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Update a review (owner-only). Recomputes aggregate in the same transaction. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const { reviewId } = await params;

    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');
    if (existing.userId !== authed.user.id) {
      throw new ApiError(403, 'You can only edit your own review', 'FORBIDDEN');
    }

    const input = reviewUpdateSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: {
          ...(input.rating !== undefined && { rating: input.rating }),
          ...(input.comment !== undefined && { comment: input.comment }),
        },
        include: {
          user: { select: { id: true, name: true } },
          menuItem: { select: { id: true, name: true } },
        },
      });

      await recomputeMenuItemRating(tx, existing.menuItemId);

      return review;
    });

    await auditLog({
      userId: authed.user.id,
      action: 'review_updated',
      ...requestContext(req),
      meta: { reviewId, menuItemId: existing.menuItemId },
    });

    return NextResponse.json({ review: updated });
  } catch (e) {
    return handleError(e);
  }
}

/** Delete a review (owner or SUPER_ADMIN). Recomputes aggregate in the same transaction. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const { reviewId } = await params;

    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');

    const isOwner = existing.userId === authed.user.id;
    const isAdmin = authed.user.role === 'SUPER_ADMIN';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to delete this review', 'FORBIDDEN');
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });
      await recomputeMenuItemRating(tx, existing.menuItemId);
    });

    await auditLog({
      userId: authed.user.id,
      action: isAdmin && !isOwner ? 'review_deleted_by_admin' : 'review_deleted',
      ...requestContext(req),
      meta: { reviewId, menuItemId: existing.menuItemId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
