import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { ApiError, handleError } from '@/lib/auth/errors';
import { runCheckout } from '@/lib/checkout';
import { checkoutSchema } from '@/lib/cart-schemas';
import { initiateOrderPayment } from '@/lib/payments/service';
import { transitionOrder } from '@/lib/orders';
import { prisma } from '@/lib/auth/prisma';
import { auditLog } from '@/lib/auth/audit';
import { checkRateLimit, clientIp, requestContext } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';

/**
 * Place an order from the current cart and start payment:
 *   { addressId, paymentMethod?: 'cod' | 'card', notes?, idempotencyKey? }
 * Totals are recomputed server-side from the DB catalog — any price sent by
 * the client is ignored. A repeated checkout with the same idempotencyKey
 * returns the same order (and the original Stripe Checkout URL) instead of
 * creating a new one.
 *
 * card → creates a Stripe Checkout Session; the frontend redirects to
 *        `payment.checkoutUrl`. The order is only marked paid by the
 *        signature-verified webhook — never by a client callback.
 * cod  → no gateway; payment is collected (order marked paid) when the branch
 *        marks the order DELIVERED.
 */
export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);

    // Phase 9: rate-limit order placement — per-IP burst and per-user cap so a
    // distributed attack can't spam order creation.
    const ip = clientIp(req);
    const burst = await checkRateLimit(`checkout:ip:${ip}`, { windowMs: 60_000, max: 15 });
    if (!burst.ok) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: burst.retryAfterMs,
      });
    }
    const perUser = await checkRateLimit(`checkout:user:${authed.user.id}`, { windowMs: 60_000, max: 5 });
    if (!perUser.ok) {
      throw new ApiError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED', {
        retryAfterMs: perUser.retryAfterMs,
      });
    }

    const input = checkoutSchema.parse(await req.json());

    const { order, duplicated } = await runCheckout(authed.user.id, input);

    // Payment initiation. A gateway failure must not leave the order in limbo:
    // the order moves to PAYMENT_FAILED so the customer can retry cleanly.
    let payment: { provider: string; checkoutUrl: string | null } | null = null;
    try {
      const origin =
        process.env.APP_ORIGIN?.replace(/\/$/, '') || new URL(req.url).origin;
      const initiated = await initiateOrderPayment({
        orderId: order.id,
        amount: order.total,
        paymentMethod: input.paymentMethod ?? 'cod',
        baseUrl: origin,
        idempotencyKey: order.idempotencyKey ?? order.id,
      });
      payment = { provider: initiated.payment.provider, checkoutUrl: initiated.checkoutUrl };
    } catch (initErr) {
      if (!duplicated && !(initErr instanceof ApiError && initErr.code === 'PAYMENT_NOT_CONFIGURED')) {
        await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'failed' } });
        await transitionOrder(order.id, 'PAYMENT_FAILED', {
          userId: authed.user.id,
          role: authed.user.role,
        }, { note: 'Payment initiation failed at the gateway' });
      }
      throw initErr;
    }

    await auditLog({
      userId: authed.user.id,
      action: duplicated ? 'checkout_duplicate' : 'checkout',
      ...requestContext(req),
      meta: { orderId: order.id, total: order.total, duplicated, provider: payment?.provider ?? null },
    });
    return NextResponse.json(
      { order, duplicated, payment },
      { status: duplicated ? 200 : 201 }
    );
  } catch (e) {
    return handleError(e);
  }
}
