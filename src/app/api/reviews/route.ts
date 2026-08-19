import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError, ApiError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { reviewCreateSchema, reviewListQuerySchema, type ReviewListItem, type PaginatedReviews } from '@/lib/review-schemas';
import { recomputeMenuItemRating } from '@/lib/reviews';
import { auditLog } from '@/lib/auth/audit';
import { requestContext, checkRateLimit } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Public: list non-hidden reviews for one item, or the most recent N across all items. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const input = reviewListQuerySchema.parse(Object.fromEntries(searchParams));

    const where: Record<string, unknown> = { isHidden: false };
    if (input.itemId) {
      where.menuItemId = input.itemId;
    }

    const cursorFilter = input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {};

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where: { ...where, ...cursorFilter },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        include: {
          user: { select: { id: true, name: true } },
          menuItem: { select: { id: true, name: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;

    const reviews: ReviewListItem[] = items.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItem.name,
      rating: r.rating,
      comment: r.comment,
      isHidden: r.isHidden,
      createdAt: r.createdAt.toISOString(),
    }));

    const nextCursor = hasMore ? reviews[reviews.length - 1].createdAt : null;

    const result: PaginatedReviews = { reviews, nextCursor, total };
    return NextResponse.json(result);
  } catch (e) {
    return handleError(e);
  }
}

/** Auth required: create a review. 409 if one already exists for this user+item. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);

    const hit = await checkRateLimit(`review:create:${authed.user.id}`, {
      windowMs: 3_600_000, // 1 hour
      max: 20,
    });
    if (!hit.ok) {
      return NextResponse.json({ error: 'Too many reviews. Please try again later.' }, { status: 429 });
    }

    const input = reviewCreateSchema.parse(await req.json());

    // Verify the menu item exists
    const item = await prisma.menuItem.findUnique({ where: { id: input.menuItemId } });
    if (!item) throw new ApiError(404, 'Menu item not found', 'ITEM_NOT_FOUND');

    const result = await prisma.$transaction(async (tx) => {
      // Check for existing review
      const existing = await tx.review.findUnique({
        where: { userId_menuItemId: { userId: authed.user.id, menuItemId: input.menuItemId } },
      });

      if (existing) {
        throw new ApiError(
          409,
          'You already reviewed this item. Edit your existing review instead.',
          'REVIEW_ALREADY_EXISTS',
          { existingReviewId: existing.id },
        );
      }

      const review = await tx.review.create({
        data: {
          userId: authed.user.id,
          menuItemId: input.menuItemId,
          rating: input.rating,
          comment: input.comment ?? '',
        },
        include: {
          user: { select: { id: true, name: true } },
          menuItem: { select: { id: true, name: true } },
        },
      });

      await recomputeMenuItemRating(tx, input.menuItemId);

      return review;
    });

    await auditLog({
      userId: authed.user.id,
      action: 'review_created',
      ...requestContext(req),
      meta: { reviewId: result.id, menuItemId: input.menuItemId, rating: input.rating },
    });

    return NextResponse.json({ review: result }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
