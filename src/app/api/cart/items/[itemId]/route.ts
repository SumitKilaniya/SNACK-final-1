import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError } from '@/lib/auth/errors';
import { computeCartSummary, removeCartItem, setCartQuantity } from '@/lib/cart';
import { cartQtySchema } from '@/lib/cart-schemas';

export const runtime = 'nodejs';

/** Set a line's quantity ({ quantity: 0 } removes it). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const { itemId } = await params;
    const input = cartQtySchema.parse(await req.json());

    await setCartQuantity(authed.user.id, itemId, input.quantity);
    const cart = await computeCartSummary(authed.user.id);
    return NextResponse.json({ cart });
  } catch (e) {
    return handleError(e);
  }
}

/** Remove a line from the cart. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const { itemId } = await params;

    await removeCartItem(authed.user.id, itemId);
    const cart = await computeCartSummary(authed.user.id);
    return NextResponse.json({ cart });
  } catch (e) {
    return handleError(e);
  }
}
