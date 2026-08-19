import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireBranchAccess } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { prisma } from '@/lib/auth/prisma';
import { requestContext } from '@/lib/auth/rate-limit';
import { auditLog } from '@/lib/auth/audit';
import { overrideDeleteSchema, overrideUpsertSchema } from '@/lib/catalog-schemas';
import { resolveItems } from '@/lib/catalog';

export const runtime = 'nodejs';

/**
 * Branch-scoped menu management.
 * Access control (server-side, on every verb): a BRANCH_ADMIN may only touch
 * their own branch; a SUPER_ADMIN may touch any branch. The branchId is taken
 * from the URL, never from the client.
 */

/** List the full catalog with this branch's effective price + availability. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    assertSameOrigin(req);
    const authed = await requireBranchAccess(req, branchId);

    const items = await prisma.menuItem.findMany({
      include: { overrides: { where: { branchId } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    await auditLog({
      userId: authed.user.id,
      action: 'menu_overrides_listed',
      ...requestContext(req),
      meta: { branchId },
    });
    return NextResponse.json({ items: resolveItems(items) });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Upsert an override for one item at this branch.
 * Body: { itemId, priceOverride?: number|null, isAvailable?: boolean }
 * priceOverride null/absent → fall back to master base price.
 * isAvailable absent → true.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    assertSameOrigin(req);
    const authed = await requireBranchAccess(req, branchId);

    const input = overrideUpsertSchema.parse(await req.json());
    const item = await prisma.menuItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new ApiError(404, 'Item not found', 'ITEM_NOT_FOUND');

    const override = await prisma.branchMenuOverride.upsert({
      where: { branchId_itemId: { branchId, itemId: input.itemId } },
      update: {
        priceOverride: input.priceOverride ?? null,
        isAvailable: input.isAvailable ?? true,
      },
      create: {
        branchId,
        itemId: input.itemId,
        priceOverride: input.priceOverride ?? null,
        isAvailable: input.isAvailable ?? true,
      },
    });

    await auditLog({
      userId: authed.user.id,
      action: 'menu_override_upsert',
      ...requestContext(req),
      meta: { branchId, itemId: input.itemId, priceOverride: override.priceOverride, isAvailable: override.isAvailable },
    });
    return NextResponse.json({ override });
  } catch (e) {
    return handleError(e);
  }
}

/** Clear the override for an item at this branch (falls back to base price). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    assertSameOrigin(req);
    const authed = await requireBranchAccess(req, branchId);

    const input = overrideDeleteSchema.parse(await req.json());
    const existing = await prisma.branchMenuOverride.findUnique({
      where: { branchId_itemId: { branchId, itemId: input.itemId } },
    });
    if (existing) {
      await prisma.branchMenuOverride.delete({
        where: { branchId_itemId: { branchId, itemId: input.itemId } },
      });
    }

    await auditLog({
      userId: authed.user.id,
      action: 'menu_override_cleared',
      ...requestContext(req),
      meta: { branchId, itemId: input.itemId },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
