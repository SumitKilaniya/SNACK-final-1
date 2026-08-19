import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { ApiError, handleError } from '@/lib/auth/errors';
import { addItemToCart } from '@/lib/cart';
import { cartAddSchema } from '@/lib/cart-schemas';
import { auditLog } from '@/lib/auth/audit';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/**
 * Add an item to the cart.
 *   { itemId, quantity?, branchId? }
 * If branchId is provided and differs from the cart's current branch, the
 * cart switches branches and previous items are cleared (cleared: true).
 */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);

    const ip = clientIp(req);
    const burst = await checkRateLimit(`cart:ip:${ip}`, { windowMs: 60_000, max: 60 });
    if (!burst.ok) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: burst.retryAfterMs,
      });
    }

    const input = cartAddSchema.parse(await req.json());

    const { summary, cleared } = await addItemToCart(authed.user.id, input.itemId, input.quantity, {
      branchId: input.branchId,
    });

    await auditLog({
      userId: authed.user.id,
      action: cleared ? 'cart_item_added_branch_switched' : 'cart_item_added',
      ...requestContext(req),
      meta: { itemId: input.itemId, quantity: input.quantity, cleared },
    });
    return NextResponse.json({ cart: summary, cleared });
  } catch (e) {
    return handleError(e);
  }
}
