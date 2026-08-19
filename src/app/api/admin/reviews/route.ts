import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { adminReviewListQuerySchema } from '@/lib/review-schemas';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Super admin: list ALL reviews (including hidden) for moderation. */
export async function GET(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const { searchParams } = req.nextUrl;
    const input = adminReviewListQuerySchema.parse(Object.fromEntries(searchParams));

    const where: Record<string, unknown> = {};
    if (input.search) {
      const q = input.search.toLowerCase();
      where.OR = [
        { comment: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { menuItem: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const cursorFilter = input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {};

    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where: { ...where, ...cursorFilter },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        include: {
          user: { select: { id: true, name: true, email: true } },
          menuItem: { select: { id: true, name: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    await auditLog({
      userId: authed.user.id,
      action: 'admin_reviews_listed',
      ...requestContext(req),
      meta: { total, search: input.search },
    });

    return NextResponse.json({ reviews: items, nextCursor, total });
  } catch (e) {
    return handleError(e);
  }
}
