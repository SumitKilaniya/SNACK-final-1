import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError, ApiError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { wishlistAddSchema } from '@/lib/review-schemas';
import { auditLog } from '@/lib/auth/audit';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** GET /api/wishlist?branchId=X — the caller's wishlisted items with current prices. */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const branchId = req.nextUrl.searchParams.get('branchId');

    const wishlists = await prisma.wishlist.findMany({
      where: { userId: authed.user.id },
      include: {
        menuItem: {
          include: branchId
            ? { overrides: { where: { branchId } } }
            : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = wishlists.map((w) => {
      const item = w.menuItem;
      const override = branchId && 'overrides' in item ? (item as { overrides: Array<{ priceOverride: number | null; isAvailable: boolean }> }).overrides[0] : undefined;
      const price = override?.priceOverride ?? item.basePrice;
      const isAvailable = item.isAvailable && (override ? override.isAvailable : true);

      return {
        id: w.id,
        menuItemId: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        category: item.category,
        basePrice: item.basePrice,
        price,
        isVeg: item.isVeg,
        rating: item.rating,
        reviewCount: item.reviewCount,
        isAvailable,
        createdAt: w.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/wishlist — idempotent: adding an already-wishlisted item succeeds. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);

    const ip = clientIp(req);
    const burst = await checkRateLimit(`wishlist:ip:${ip}`, { windowMs: 60_000, max: 30 });
    if (!burst.ok) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: burst.retryAfterMs,
      });
    }

    const input = wishlistAddSchema.parse(await req.json());

    // Verify the menu item exists
    const item = await prisma.menuItem.findUnique({ where: { id: input.menuItemId } });
    if (!item) throw new ApiError(404, 'Menu item not found', 'ITEM_NOT_FOUND');

    // Idempotent: upsert — if it already exists, just return it
    const existing = await prisma.wishlist.findUnique({
      where: { userId_menuItemId: { userId: authed.user.id, menuItemId: input.menuItemId } },
    });

    if (existing) {
      return NextResponse.json({ wishlist: existing, duplicated: true });
    }

    const wishlist = await prisma.wishlist.create({
      data: { userId: authed.user.id, menuItemId: input.menuItemId },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'wishlist_item_added',
      ...requestContext(req),
      meta: { menuItemId: input.menuItemId },
    });

    return NextResponse.json({ wishlist }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
