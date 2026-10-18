import crypto from 'crypto';
import Stripe from 'stripe';
import { ApiError, safeEqual } from '@/lib/auth/errors';
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentProvider,
  WebhookResult,
  RefundInput,
  RefundResult,
} from '@/lib/payments/types';

function requireKey(name: string): string {
  const v = process.env[name];
  if (!v) throw new ApiError(500, `Stripe is not configured (missing ${name})`, 'PAYMENT_NOT_CONFIGURED');
  return v;
}

/**
 * Lazy singleton. Throws PAYMENT_NOT_CONFIGURED until STRIPE_SECRET_KEY is set
 * in Keys/API keys — checkout falls back to a clear error, never a crash.
 */
function getStripe(): Stripe {
  return new Stripe(requireKey('STRIPE_SECRET_KEY'), { apiVersion: '2026-08-26.dahlia' });
}

/** Stripe's signed header: t=<unix-seconds>,v1=<hmac-sha256(secret, `${t}.${payload}`) hex> */
function verifyStripeSignature(payload: string, header: string, secret: string): void {
  const parts = new Map<string, string>();
  for (const kv of header.split(',')) {
    const eq = kv.indexOf('=');
    if (eq > 0) parts.set(kv.slice(0, eq), kv.slice(eq + 1));
  }
  const t = parts.get('t');
  const v1 = parts.get('v1');
  if (!t || !v1) {
    throw new ApiError(400, 'Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }
  const ts = Number(t);
  // Reject replay of very old signatures (Stripe default tolerance: 300s).
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    throw new ApiError(400, 'Webhook signature expired', 'INVALID_WEBHOOK_SIGNATURE');
  }
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  if (!safeEqual(expected, v1)) {
    throw new ApiError(400, 'Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }
}

interface StripeWebhookObject {
  id?: unknown;
  metadata?: Record<string, string> | null;
  client_reference_id?: unknown;
  payment_intent?: unknown;
  type?: unknown;
}

export const stripeProvider: PaymentProvider = {
  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const stripe = getStripe();
    const currency = (process.env.STRIPE_CURRENCY || 'inr').toLowerCase();
    const origin = input.baseUrl.replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: `Snack-Pod Order #${input.orderId.slice(-8)}` },
              unit_amount: input.amount * 100, // rupees → smallest unit (paise)
            },
            quantity: 1,
          },
        ],
        metadata: { orderId: input.orderId },
        // Round-trip identifiers so webhooks can always map back to the order.
        client_reference_id: input.orderId,
        success_url: `${origin}/orders/${input.orderId}?paid=1`,
        cancel_url: `${origin}/orders/${input.orderId}?payment=cancelled`,
      },
      // Gateway-side idempotency: a retried checkout with the same key cannot
      // create a second session or double-charge.
      { idempotencyKey: `checkout-${input.idempotencyKey}` }
    );

    return {
      provider: 'card',
      providerRef: session.id,
      checkoutUrl: session.url,
    };
  },

  /**
   * Verify the webhook signature locally (HMAC-SHA256, constant-time compare)
   * and normalize the event. Implemented directly on Node crypto rather than
   * stripe.webhooks.constructEvent so it behaves identically across runtimes
   * (Next.js Node runtime). Throws INVALID_WEBHOOK_SIGNATURE on any
   * missing/invalid signature — BEFORE any side effect.
   */
  async handleWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
    if (!signature) {
      throw new ApiError(400, 'Missing stripe-signature header', 'INVALID_WEBHOOK_SIGNATURE');
    }
    verifyStripeSignature(rawBody, signature, requireKey('STRIPE_WEBHOOK_SECRET'));

    let payload: { type?: unknown; data?: { object?: unknown } };
    try {
      payload = JSON.parse(rawBody) as { type?: unknown; data?: { object?: unknown } };
    } catch {
      throw new ApiError(400, 'Invalid webhook payload', 'INVALID_WEBHOOK_PAYLOAD');
    }

    const obj = (payload.data?.object ?? {}) as StripeWebhookObject;
    const orderId =
      (typeof obj.metadata?.orderId === 'string' && obj.metadata.orderId) ||
      (typeof obj.client_reference_id === 'string' ? obj.client_reference_id : '');

    if (payload.type === 'checkout.session.completed') {
      const pi = obj.payment_intent;
      const providerRef = typeof pi === 'string' ? pi : typeof pi === 'object' && pi !== null && 'id' in pi ? String((pi as { id: unknown }).id) : '';
      if (!orderId || !providerRef) {
        throw new ApiError(422, 'Webhook missing order reference', 'WEBHOOK_MISSING_ORDER');
      }
      return { handled: true, event: { type: 'payment.succeeded', providerRef, orderId } };
    }

    if (payload.type === 'checkout.session.async_payment_failed' || payload.type === 'payment_intent.payment_failed') {
      if (!orderId) {
        throw new ApiError(422, 'Webhook missing order reference', 'WEBHOOK_MISSING_ORDER');
      }
      const providerRef =
        (typeof obj.id === 'string' && obj.id) ||
        (typeof obj.payment_intent === 'string' ? obj.payment_intent : 'unknown');
      return { handled: true, event: { type: 'payment.failed', providerRef, orderId } };
    }

    // Valid signature but an event we don't act on (session.created, …).
    return { handled: false, event: null };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    const stripe = getStripe();
    const refund = await stripe.refunds.create(
      {
        payment_intent: input.providerRef,
        amount: input.amount * 100,
      },
      { idempotencyKey: `refund-${input.idempotencyKey}` }
    );
    return { refundRef: refund.id };
  },
};
