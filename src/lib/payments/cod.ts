import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentProvider,
  WebhookResult,
  RefundInput,
  RefundResult,
} from '@/lib/payments/types';

/**
 * Cash on delivery — money never moves through a gateway.
 *  - initiate: nothing to create; payment is settled when the branch collects
 *    cash at delivery (order marked paid on DELIVERED in the admin route).
 *  - handleWebhook: not applicable (no gateway events).
 *  - refund: bookkeeping only; the "refund" is cash handed back at the store.
 */
export const codProvider: PaymentProvider = {
  async initiate(_input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    return { provider: 'cod', providerRef: null, checkoutUrl: null };
  },

  async handleWebhook(): Promise<WebhookResult> {
    throw new Error('COD has no webhooks');
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    return { refundRef: `cod-cash-${input.idempotencyKey}` };
  },
};
