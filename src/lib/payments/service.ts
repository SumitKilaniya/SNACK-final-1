import { prisma } from '@/lib/auth/prisma';
import { ApiError } from '@/lib/auth/errors';
import { transitionOrder, type TransitionActor } from '@/lib/orders';
import { codProvider } from '@/lib/payments/cod';
import { stripeProvider } from '@/lib/payments/stripe';
import type { PaymentMethod, PaymentProvider, PaymentStatus } from '@/lib/payments/types';

export function getProvider(method: PaymentMethod): PaymentProvider {
  return method === 'card' ? stripeProvider : codProvider;
}

/**
 * Initiate payment for an already-created order:
 *  - Records the Payment row (idempotent per order — one payment per order).
 *  - Calls the gateway (Stripe Checkout Session, or nothing for COD).
 *  - Returns the provider + checkout URL the frontend redirects to.
 * Card initiation failure leaves the order in PAYMENT_FAILED, never in limbo.
 */
export async function initiateOrderPayment(input: {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  baseUrl: string;
  idempotencyKey: string;
}) {
  const existing = await prisma.payment.findFirst({ where: { orderId: input.orderId } });
  if (existing) {
    // Idempotent retry: hand back the original Stripe Checkout URL (the gateway
    // itself also dedupes via its own idempotency key).
    return { payment: existing, checkoutUrl: existing.checkoutUrl };
  }

  const provider = getProvider(input.paymentMethod);
  const initiated = await provider.initiate({
    orderId: input.orderId,
    amount: input.amount,
    baseUrl: input.baseUrl,
    idempotencyKey: input.idempotencyKey,
  });

  const payment = await prisma.payment.create({
    data: {
      orderId: input.orderId,
      provider: input.paymentMethod,
      providerRef: initiated.providerRef,
      checkoutUrl: initiated.checkoutUrl,
      amount: input.amount,
      status: 'pending',
      idempotencyKey: `pay-${input.idempotencyKey}`,
    },
  });

  return { payment, checkoutUrl: initiated.checkoutUrl };
}

/** Webhook-confirmed success: the ONLY path that marks an order paid. */
export async function confirmPaymentSucceeded(input: {
  orderId: string;
  provider: string;
  providerRef: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { orderId: input.orderId } });
    if (!payment) {
      throw new ApiError(404, 'No payment record for order', 'PAYMENT_NOT_FOUND');
    }
    if (payment.status === 'succeeded') return; // idempotent — Stripe retries webhooks

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'succeeded', providerRef: input.providerRef, provider: input.provider },
    });
    await tx.order.update({
      where: { id: input.orderId },
      data: { paymentStatus: 'paid' },
    });
  });
}

/** Gateway reported failure/expiry → order ends in a clear PAYMENT_FAILED state. */
export async function confirmPaymentFailed(input: { orderId: string; actor: TransitionActor }): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { orderId: input.orderId } });
    if (payment && payment.status === 'pending') {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    }
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (order && order.status === 'PLACED') {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAYMENT_FAILED', paymentStatus: 'failed' },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: input.orderId,
          fromStatus: order.status,
          toStatus: 'PAYMENT_FAILED',
          actorUserId: input.actor.userId,
          actorRole: input.actor.role,
          note: 'Payment failed at the gateway',
        },
      });
    }
  });
}

/**
 * Full refund flow: gateway refund API → Payment row → order → REFUNDED.
 * Only super admins and branch admins (of the order's branch) may trigger it.
 * Refunds require money that actually moved: a Stripe order must be paid,
 * a COD order must have been collected (paid at delivery). Repeated calls are
 * rejected once the payment is already refunded.
 */
export async function refundOrderPayment(input: {
  orderId: string;
  actor: TransitionActor;
}): Promise<{ refundRef: string }> {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');

  const refundable = ['REJECTED_BY_BRANCH', 'CANCELLED_BY_CUSTOMER', 'PAYMENT_FAILED'] as const;
  if (!refundable.includes(order.status as (typeof refundable)[number])) {
    throw new ApiError(
      422,
      `Only rejected, cancelled or payment-failed orders can be refunded (current: ${order.status})`,
      'ORDER_NOT_REFUNDABLE'
    );
  }

  const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
  if (!payment) throw new ApiError(404, 'No payment record for order', 'PAYMENT_NOT_FOUND');
  if (payment.status === 'refunded') throw new ApiError(409, 'This payment is already refunded', 'ALREADY_REFUNDED');
  // Gateway payments need settled money to refund. COD never moved money — a
  // rejected/cancelled COD order is refunded as a bookkeeping close-out.
  if (order.paymentMethod !== 'cod' && payment.status !== 'succeeded') {
    throw new ApiError(422, 'Only settled payments can be refunded', 'PAYMENT_NOT_SETTLED');
  }

  const provider = getProvider(order.paymentMethod as PaymentMethod);
  const idempotencyKey = `order-${order.id}`;
  const { refundRef } = await provider.refund({
    providerRef: payment.providerRef ?? '',
    amount: order.total,
    idempotencyKey,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'refunded' as PaymentStatus, refundRef, refundedAmount: order.total, refundedAt: new Date() },
  });
  await transitionOrder(order.id, 'REFUNDED', input.actor, { note: `Refund ${refundRef}` });
  return { refundRef };
}
