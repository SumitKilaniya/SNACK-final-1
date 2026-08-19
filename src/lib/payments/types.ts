/** Supported checkout payment methods. 'card' = Stripe; 'cod' = cash on delivery. */
export type PaymentMethod = 'cod' | 'card';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface InitiatePaymentInput {
  orderId: string;
  /** Whole rupees. */
  amount: number;
  /** Origin base URL used to build Stripe success/cancel URLs. */
  baseUrl: string;
  /** Dedupe key — passed to the gateway so retries cannot create duplicate charges. */
  idempotencyKey: string;
}

export interface InitiatePaymentResult {
  provider: PaymentMethod;
  /** Gateway's payment/session identifier, if any (null for COD). */
  providerRef: string | null;
  /** For Stripe: hosted Checkout URL the customer is redirected to. Null for COD. */
  checkoutUrl: string | null;
}

export interface RefundInput {
  providerRef: string;
  /** Whole rupees. */
  amount: number;
  idempotencyKey: string;
}

export interface RefundResult {
  refundRef: string;
}

/** Normalized webhook event emitted by a provider's webhook handler. */
export interface PaymentWebhookEvent {
  type: 'payment.succeeded' | 'payment.failed';
  /** Gateway payment identifier (Stripe payment_intent id). */
  providerRef: string;
  orderId: string;
}

export interface WebhookResult {
  /** False for valid-but-uninteresting events (e.g. checkout.session.created) —
   *  the route acks them with 200 so the gateway stops retrying. */
  handled: boolean;
  event: PaymentWebhookEvent | null;
}

/**
 * Gateway abstraction. COD implements a no-op gateway (money never moves
 * through a processor); refunding a COD order is a bookkeeping action. Adding
 * Paytm later = one more implementation + wiring in `getProvider`.
 */
export interface PaymentProvider {
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  /**
   * Verify a webhook payload with the gateway's signing secret and return a
   * normalized event. Throws on an invalid/missing signature — the route layer
   * rejects with 400, so a forged webhook can never mark an order paid.
   */
  handleWebhook(rawBody: string, signature: string | null): Promise<WebhookResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}
