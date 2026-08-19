import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError } from '@/lib/auth/errors';
import { clearCart, computeCartSummary, DELIVERY_FEE } from '@/lib/cart';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Current user's cart with server-recomputed prices. */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const summary = await computeCartSummary(authed.user.id);
    return NextResponse.json({
      cart:
        summary ?? {
          branchId: null,
          branchName: null,
          branchCity: null,
          items: [],
          subtotal: 0,
          deliveryFee: DELIVERY_FEE,
          total: 0,
        },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Empty the cart. */
export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    await clearCart(authed.user.id);
    await auditLog({ userId: authed.user.id, action: 'cart_cleared', ...requestContext(req) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
