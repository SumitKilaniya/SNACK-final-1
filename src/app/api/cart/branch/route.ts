import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { handleError } from '@/lib/auth/errors';
import { computeCartSummary, switchCartBranch } from '@/lib/cart';
import { cartBranchSchema } from '@/lib/cart-schemas';
import { auditLog } from '@/lib/auth/audit';
import { requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/** Switch the cart to another branch — existing items are cleared. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const authed = await requireAuth(req);
    const input = cartBranchSchema.parse(await req.json());

    await switchCartBranch(authed.user.id, input.branchId);
    const cart = await computeCartSummary(authed.user.id);

    await auditLog({
      userId: authed.user.id,
      action: 'cart_branch_switched',
      ...requestContext(req),
      meta: { branchId: input.branchId },
    });
    return NextResponse.json({ cart, cleared: true });
  } catch (e) {
    return handleError(e);
  }
}
