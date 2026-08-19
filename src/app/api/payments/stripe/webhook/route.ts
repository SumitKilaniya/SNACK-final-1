import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { stripeProvider } from '@/lib/payments/stripe';
import { confirmPaymentSucceeded, confirmPaymentFailed } from '@/lib/payments/service';
import { prisma } from '@/lib/auth/prisma';

export const runtime = 'nodejs';

/**
 * Stripe webhook endpoint.
 *
 * Security model (Phase 5 + Phase 9 item 10):
 *  - The raw body is verified against `STRIPE_WEBHOOK_SECRET` via Stripe's
 *    signature scheme (timestamp + HMAC). Missing or invalid signatures are
 *    rejected with 400 BEFORE any side effect — a forged request can never
 *    mark an order paid.
 *  - Orders are marked paid ONLY here (or by the branch marking COD delivery).
 *    The frontend's `?paid=1` return URL is decorative; nothing trusts it.
 *  - Success handling is idempotent (Stripe retries webhooks).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    const { handled, event } = await stripeProvider.handleWebhook(rawBody, signature);
    if (!handled || !event) {
      // Valid signature but an event we don't act on (session.created, …).
      return NextResponse.json({ received: true });
    }

    if (event.type === 'payment.succeeded') {
      const order = await prisma.order.findUnique({ where: { id: event.orderId } });
      if (!order) throw new ApiError(404, 'Order not found for webhook', 'ORDER_NOT_FOUND');

      await confirmPaymentSucceeded({
        orderId: event.orderId,
        provider: 'stripe',
        providerRef: event.providerRef,
      });
    } else {
      const order = await prisma.order.findUnique({ where: { id: event.orderId } });
      if (!order) throw new ApiError(404, 'Order not found for webhook', 'ORDER_NOT_FOUND');
      await confirmPaymentFailed({
        orderId: event.orderId,
        actor: { userId: order.userId, role: 'CUSTOMER' },
      });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    // Invalid signature / malformed payload → 400; Stripe will not retry bad sigs.
    return handleError(e);
  }
}
