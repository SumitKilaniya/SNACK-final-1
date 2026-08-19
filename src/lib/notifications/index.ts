import { prisma } from '@/lib/auth/prisma';
import { getSmsProvider } from '@/lib/auth/sms';
import { getEmailProvider } from './email';
import type { Order, OrderStatus } from '@prisma/client';

/**
 * Notifications are best-effort: every dispatch is wrapped so a provider
 * outage, missing env vars, or a malformed phone number can NEVER break the
 * order state machine. Callers fire-and-forget with `void notify…()`.
 */

/** Transitions that warrant a customer-facing alert. */
const NOTIFY_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'ACCEPTED_BY_BRANCH',
  'READY_OR_OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED_BY_BRANCH',
  'CANCELLED_BY_CUSTOMER',
  'PAYMENT_FAILED',
  'REFUNDED',
]);

const TERMINAL = new Set<OrderStatus>([
  'DELIVERED',
  'REJECTED_BY_BRANCH',
  'CANCELLED_BY_CUSTOMER',
  'REFUNDED',
]);

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export function orderStatusCopy(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PLACED: 'Placed',
    ACCEPTED_BY_BRANCH: 'Accepted by the restaurant',
    PREPARING: 'Being prepared',
    READY_OR_OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    REJECTED_BY_BRANCH: 'Cancelled by the restaurant',
    CANCELLED_BY_CUSTOMER: 'Cancelled by you',
    PAYMENT_FAILED: 'Payment failed',
    REFUNDED: 'Refunded',
  };
  return map[status] ?? status;
}

function messageFor(order: Order, toStatus: OrderStatus, note?: string): string {
  const id = shortId(order.id);
  switch (toStatus) {
    case 'ACCEPTED_BY_BRANCH':
      return `Snack-Pod: Your order #${id} has been accepted and is being prepared. We'll update you when it's on the way!`;
    case 'READY_OR_OUT_FOR_DELIVERY':
      return `Snack-Pod: Your order #${id} is out for delivery 🛵 Get ready — it's almost there!`;
    case 'DELIVERED':
      return `Snack-Pod: Your order #${id} has been delivered. Enjoy your meal! 🍽️`;
    case 'REJECTED_BY_BRANCH':
      return `Snack-Pod: We're sorry — order #${id} could not be fulfilled (${note ?? 'restaurant unavailable'}). Any payment will be refunded automatically.`;
    case 'CANCELLED_BY_CUSTOMER':
      return `Snack-Pod: Order #${id} has been cancelled as requested. Any payment will be refunded automatically.`;
    case 'PAYMENT_FAILED':
      return `Snack-Pod: The payment for order #${id} failed. You can retry — your order is saved.`;
    case 'REFUNDED':
      return `Snack-Pod: The refund for order #${id} has been processed. It may take 3–5 business days to reflect.`;
    default:
      return '';
  }
}

interface NotifyItem {
  name: string;
  quantity: number;
  total: number;
}

function emailHtml(
  order: Order,
  items: NotifyItem[],
  toStatus: OrderStatus,
  note?: string
): string {
  const id = shortId(order.id);
  const statusLine = orderStatusCopy(toStatus);
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#3f3f46">${i.quantity}× ${escapeHtml(i.name)}</td><td style="padding:6px 0;text-align:right;color:#3f3f46">₹${i.total}</td></tr>`
    )
    .join('');
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:16px;overflow:hidden">
    <div style="background:#ea580c;padding:20px 24px;color:#fff">
      <div style="font-weight:800;font-size:18px">🍽️ Snack-Pod</div>
      <div style="font-size:13px;opacity:.9;margin-top:2px">Order #${id} — ${statusLine}</div>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 16px;color:#18181b;font-size:14px;line-height:1.6">${escapeHtml(
        messageFor(order, toStatus, note)
      )}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}
        <tr>
          <td style="padding:8px 0 0;border-top:1px solid #eee;font-weight:700;color:#18181b">Total</td>
          <td style="padding:8px 0 0;border-top:1px solid #eee;text-align:right;font-weight:800;color:#18181b">₹${
            order.total
          }</td>
        </tr>
      </table>
      <p style="margin:20px 0 0;color:#a1a1aa;font-size:12px">Track live at your Snack-Pod order page.</p>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Alert the customer on a key order transition (SMS to their phone + email).
 * Never throws — provider failures are logged and swallowed.
 */
export async function notifyOrderTransition(
  order: Order,
  toStatus: OrderStatus,
  note?: string
): Promise<void> {
  if (!NOTIFY_STATUSES.has(toStatus)) return;

  try {
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (!user) return;
    // Re-fetch with line items so the email can show what was ordered.
    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
    const items = (full?.items ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      total: i.total,
    }));
    const message = messageFor(order, toStatus, note);
    if (!message) return;

    await Promise.allSettled([
      user.phone ? getSmsProvider().send(user.phone, message) : Promise.resolve(),
      user.email
        ? getEmailProvider().send({
            to: user.email,
            subject: `Snack-Pod order #${shortId(order.id)}: ${orderStatusCopy(toStatus)}`,
            html: emailHtml(order, items, toStatus, note),
          })
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.error('[notify] order transition failed (non-fatal):', e);
  }
}

/**
 * Alert every branch admin of the order's branch that a new order just
 * arrived (SMS + email). Never throws.
 */
export async function notifyBranchNewOrder(order: Order): Promise<void> {
  try {
    const branch = await prisma.branch.findUnique({ where: { id: order.branchId } });
    const admins = await prisma.user.findMany({
      where: { role: 'BRANCH_ADMIN', branchId: order.branchId, deactivatedAt: null },
    });
    if (!branch || admins.length === 0) return;

    const message = `Snack-Pod: New order #${shortId(order.id)} — ₹${order.total} at ${
      branch.name
    }. Open the admin dashboard to accept or reject.`;

    await Promise.allSettled([
      ...admins.flatMap((a) =>
        a.phone ? [getSmsProvider().send(a.phone, message)] : []
      ),
      ...admins.flatMap((a) =>
        a.email
          ? [
              getEmailProvider().send({
                to: a.email,
                subject: `New order #${shortId(order.id)} at ${branch.name}`,
                html: `<div style="font-family:Arial,sans-serif"><p style="font-size:14px;color:#18181b">${escapeHtml(
                  message
                )}</p></div>`,
              }),
            ]
          : []
      ),
    ]);
  } catch (e) {
    console.error('[notify] branch new-order alert failed (non-fatal):', e);
  }
}

/** Terminal states — live-tracking streams close when the order lands here. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL.has(status);
}
