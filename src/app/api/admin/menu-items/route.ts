import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { handleError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import { menuItemCreateSchema } from '@/lib/catalog-schemas';

export const runtime = 'nodejs';

/** Super admin: list the master catalog. */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const items = await prisma.menuItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });

    await auditLog({ userId: authed.user.id, action: 'menu_items_listed', ...requestContext(req) });
    return NextResponse.json({ items });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: create a master menu item. */
export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const input = menuItemCreateSchema.parse(await req.json());
    const item = await prisma.menuItem.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        basePrice: input.basePrice,
        isAvailable: input.isAvailable ?? true,
        isVeg: input.isVeg ?? null,
        imageUrl: input.imageUrl ?? null,
        rating: input.rating ?? 4.5,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'menu_item_created',
      ...requestContext(req),
      meta: { itemId: item.id, name: item.name, basePrice: item.basePrice },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
