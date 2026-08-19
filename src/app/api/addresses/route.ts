import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { handleError } from '@/lib/auth/errors';
import { prisma } from '@/lib/auth/prisma';
import { addressCreateSchema } from '@/lib/cart-schemas';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** List the current user's saved addresses (default first). */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const addresses = await prisma.address.findMany({
      where: { userId: authed.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ addresses });
  } catch (e) {
    return handleError(e);
  }
}

/** Save a new address (ownership always scoped to the caller). */
export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const input = addressCreateSchema.parse(await req.json());

    const address = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { userId: authed.user.id },
          data: { isDefault: false },
        });
      }
      const hasAny = await tx.address.count({ where: { userId: authed.user.id } });
      return tx.address.create({
        data: {
          userId: authed.user.id,
          label: input.label ?? null,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          state: input.state ?? null,
          pincode: input.pincode,
          isDefault: input.isDefault ?? hasAny === 0, // first address becomes default
        },
      });
    });

    await auditLog({
      userId: authed.user.id,
      action: 'address_created',
      ...requestContext(req),
      meta: { addressId: address.id, pincode: address.pincode },
    });
    return NextResponse.json({ address }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
