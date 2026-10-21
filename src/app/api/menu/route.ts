import { NextRequest, NextResponse } from 'next/server';
import { getMenuForBranch, parsePincodes } from '@/lib/catalog';
import { prisma } from '@/lib/auth/prisma';
import { MENU } from '@/lib/menu-data';

export const runtime = 'nodejs';
export const revalidate = 0;

const FALLBACK_BRANCH = {
  id: 'br_btm_layout',
  name: 'BTM Layout',
  city: 'Bengaluru',
  servicePincodes: ['560076', '560078', '560103'],
};

export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get('branchId')?.trim();

    const dbBranch = requested
      ? await prisma.branch.findUnique({ where: { id: requested } })
      : await prisma.branch.findFirst({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        });

    const branchId = dbBranch?.isActive
      ? dbBranch.id
      : requested || FALLBACK_BRANCH.id;

    const branch = dbBranch?.isActive
      ? {
          id: dbBranch.id,
          name: dbBranch.name,
          city: dbBranch.city,
          servicePincodes: parsePincodes(dbBranch),
        }
      : { ...FALLBACK_BRANCH, id: branchId };

    const dbItems = await getMenuForBranch(branchId);

    const items = dbItems.length > 0
      ? dbItems
      : MENU.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.desc,
          category: item.category,
          basePrice: item.price,
          price: item.price,
          priceOverridden: false,
          isAvailable: true,
          isVeg: item.veg,
          imageUrl: item.imageUrl,
          isBestseller: item.isBestseller ?? false,
          badge: item.badge ?? null,
          rating: 4.5,
        }));

    return NextResponse.json({ branch, items });
  } catch (error) {
    console.error('GET /api/menu failed:', error);
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 });
  }
}
