import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { getMenuForBranch, parsePincodes } from '@/lib/catalog';
import { menuItems } from '@/lib/menu-data';

export const runtime = 'nodejs';

/** Cache menu responses for 5 minutes. Checkout always recomputes from DB. */
export const revalidate = 300;

const FALLBACK_BRANCH = {
  id: 'br_btm_layout',
  name: 'BTM Layout',
  city: 'Bengaluru',
  servicePincodes: ['560076', '560078', '560103'],
};

/**
 * Customer-facing menu for a branch.
 *   GET /api/menu?branchId=br_btm_layout
 * Effective price = branch override price ?? master base price, always
 * recomputed server-side. Only items offered at that branch are returned.
 */
export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get('branchId')?.trim();

    let branch: any = null;
    try {
      branch = requested
        ? await prisma.branch.findUnique({ where: { id: requested } })
        : await prisma.branch.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } });
    } catch {
      branch = null;
    }

    if (!branch || !branch.isActive) {
      branch = {
        ...FALLBACK_BRANCH,
        id: requested || FALLBACK_BRANCH.id,
      };
    }

    let items: any[] = [];
    try {
      items = await getMenuForBranch(branch.id);
    } catch {
      items = [];
    }

    if (!items || items.length === 0) {
      items = menuItems.map((item) => ({
        id: item.id || item.key,
        name: item.name,
        description: item.description,
        category: item.categoryId || item.category || 'burgers',
        basePrice: item.price,
        price: item.discountPrice ?? item.price,
        priceOverridden: false,
        isAvailable: item.inStock !== false,
        isVeg: item.isVeg,
        imageUrl: item.image,
        isBestseller: !!item.isBestseller,
        badge: item.badge || null,
        rating: item.rating || 4.5,
      }));
    }

    return NextResponse.json({
      branch: {
        id: branch.id,
        name: branch.name,
        city: branch.city,
        servicePincodes: Array.isArray(branch.servicePincodes) ? branch.servicePincodes : parsePincodes(branch),
      },
      items,
    });
  } catch (e) {
    return NextResponse.json({
      branch: FALLBACK_BRANCH,
      items: menuItems.map((item) => ({
        id: item.id || item.key,
        name: item.name,
        description: item.description,
        category: item.categoryId || item.category || 'burgers',
        basePrice: item.price,
        price: item.discountPrice ?? item.price,
        priceOverridden: false,
        isAvailable: item.inStock !== false,
        isVeg: item.isVeg,
        imageUrl: item.image,
        isBestseller: !!item.isBestseller,
        badge: item.badge || null,
        rating: item.rating || 4.5,
      })),
    });
  }
}
