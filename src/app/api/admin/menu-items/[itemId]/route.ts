import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth, requireRole } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import { menuItemUpdateSchema } from '@/lib/catalog-schemas';

export const runtime = 'nodejs';

/** Super admin: update a master menu item. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const existing = await prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new ApiError(404, 'Item not found', 'ITEM_NOT_FOUND');

    const input = menuItemUpdateSchema.parse(await req.json());
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        category: input.category ?? existing.category,
        basePrice: input.basePrice ?? existing.basePrice,
        isAvailable: input.isAvailable ?? existing.isAvailable,
        isVeg: input.isVeg !== undefined ? input.isVeg : existing.isVeg,
        imageUrl: input.imageUrl !== undefined ? input.imageUrl : existing.imageUrl,
        rating: input.rating ?? existing.rating,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'menu_item_updated',
      ...requestContext(req),
      meta: { itemId, changes: Object.keys(input) },
    });
    return NextResponse.json({ item });
  } catch (e) {
    return handleError(e);
  }
}

/** Super admin: delete a master menu item (branch overrides cascade). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    requireRole('SUPER_ADMIN')(authed);

    const existing = await prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new ApiError(404, 'Item not found', 'ITEM_NOT_FOUND');

    await prisma.menuItem.delete({ where: { id: itemId } });

    await auditLog({
      userId: authed.user.id,
      action: 'menu_item_deleted',
      ...requestContext(req),
      meta: { itemId, name: existing.name },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
