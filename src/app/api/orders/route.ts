import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { handleError } from '@/lib/auth/errors';
import { listCustomerOrders } from '@/lib/orders';

export const runtime = 'nodejs';

/** The customer's own orders, newest first. */
export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const orders = await listCustomerOrders(authed.user.id);
    return NextResponse.json({ orders });
  } catch (e) {
    return handleError(e);
  }
}
