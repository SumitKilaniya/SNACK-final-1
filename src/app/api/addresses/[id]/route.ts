import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';
import { prisma } from '@/lib/auth/prisma';
import { addressUpdateSchema } from '@/lib/cart-schemas';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Update one of the caller's own addresses. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireAuth(req);
    const { id } = await params;

    const existing = await prisma.address.findFirst({ where: { id, userId: authed.user.id } });
    if (!existing) throw new ApiError(404, 'Address not found', 'ADDRESS_NOT_FOUND');

    const input = addressUpdateSchema.parse(await req.json());

    const address = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { userId: authed.user.id },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id },
        data: {
          label: input.label !== undefined ? input.label : existing.label,
          line1: input.line1 ?? existing.line1,
          line2: input.line2 !== undefined ? input.line2 : existing.line2,
          city: input.city ?? existing.city,
          state: input.state !== undefined ? input.state : existing.state,
          pincode: input.pincode ?? existing.pincode,
          isDefault: input.isDefault ?? existing.isDefault,
        },
      });
    });

    await auditLog({
      userId: authed.user.id,
      action: 'address_updated',
      ...requestContext(req),
      meta: { addressId: id },
    });
    return NextResponse.json({ address });
  } catch (e) {
    return handleError(e);
  }
}

/** Delete one of the caller's own addresses. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireAuth(req);
    const { id } = await params;

    const existing = await prisma.address.findFirst({ where: { id, userId: authed.user.id } });
    if (!existing) throw new ApiError(404, 'Address not found', 'ADDRESS_NOT_FOUND');

    await prisma.address.delete({ where: { id } });

    await auditLog({
      userId: authed.user.id,
      action: 'address_deleted',
      ...requestContext(req),
      meta: { addressId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
