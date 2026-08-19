/**
 * Client-safe order types (Phase 4). This module must stay free of any
 * server-only imports (no Prisma) so it can be imported by client components.
 * Shapes mirror the JSON returned by GET /api/orders/[orderId] and
 * POST /api/checkout.
 */

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED_BY_BRANCH'
  | 'PREPARING'
  | 'READY_OR_OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED_BY_BRANCH'
  | 'CANCELLED_BY_CUSTOMER'
  | 'PAYMENT_FAILED'
  | 'REFUNDED';

/** Happy-path pipeline used for the visual stepper. */
export const ORDER_PIPELINE: OrderStatus[] = [
  'PLACED',
  'ACCEPTED_BY_BRANCH',
  'PREPARING',
  'READY_OR_OUT_FOR_DELIVERY',
  'DELIVERED',
];

/** Mirrors orderStatusCopy in src/lib/notifications/index.ts (server-side). */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
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

/** Terminal statuses — the live stream closes on these (backend behavior). */
export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'DELIVERED',
  'REJECTED_BY_BRANCH',
  'CANCELLED_BY_CUSTOMER',
  'REFUNDED',
]);

/**
 * Customers may only self-cancel from PLACED (the ONLY source state with a
 * CANCELLED_BY_CUSTOMER transition in src/lib/orders.ts), and the backend
 * additionally enforces a 5-minute window. Button visibility keys off the
 * status alone; the API error surfaces if the window expired.
 */
export const CANCELLABLE_STATUSES: ReadonlySet<OrderStatus> = new Set(['PLACED']);

/**
 * Tailwind badge styles per status — THE canonical map both the order list
 * and any other status-badge consumer import from (Phase 5). All 9 real
 * OrderStatus values are covered, including the non-happy-path ones
 * (REJECTED_BY_BRANCH / PAYMENT_FAILED / REFUNDED) so those never render with
 * a misleading style.
 */
export const STATUS_BADGE_STYLE: Record<OrderStatus, string> = {
  PLACED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED_BY_BRANCH: 'bg-purple-50 text-purple-700 border-purple-200',
  PREPARING: 'bg-amber-50 text-amber-700 border-amber-200',
  READY_OR_OUT_FOR_DELIVERY: 'bg-orange-50 text-primary border-primary/30 animate-pulse',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED_BY_BRANCH: 'bg-red-50 text-red-600 border-red-200',
  CANCELLED_BY_CUSTOMER: 'bg-stone-100 text-stone-600 border-stone-300',
  PAYMENT_FAILED: 'bg-red-50 text-red-700 border-red-300',
  REFUNDED: 'bg-teal-50 text-teal-700 border-teal-200',
};

/** One-line plain-English description of each status, for list/detail UI. */
export const ORDER_STATUS_DESCRIPTION: Record<OrderStatus, string> = {
  PLACED: 'We received your order and sent it to the restaurant.',
  ACCEPTED_BY_BRANCH: 'The restaurant accepted your order.',
  PREPARING: 'The restaurant is preparing your food.',
  READY_OR_OUT_FOR_DELIVERY: 'Your order is out for delivery.',
  DELIVERED: 'Your order has been delivered. Enjoy!',
  REJECTED_BY_BRANCH: "The restaurant couldn't fulfil this order.",
  CANCELLED_BY_CUSTOMER: 'You cancelled this order.',
  PAYMENT_FAILED: 'Payment failed — you can retry payment from the order page.',
  REFUNDED: 'Your refund has been processed.',
};

export interface OrderAddress {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  pincode: string;
}

export interface OrderLineItem {
  id: string;
  itemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderStatusLog {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorUserId: string | null;
  actorRole: string | null;
  note: string | null;
  createdAt: string;
}

/** GET /api/orders/[orderId] → { order: OrderDetail } */
export interface OrderDetail {
  id: string;
  branchId: string;
  addressId: string | null;
  couponId: string | null;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  address: OrderAddress | null;
  branch: { id: string; name: string } | null;
  items: OrderLineItem[];
  statusLogs: OrderStatusLog[];
}

/**
 * One row from GET /api/orders (listCustomerOrders in src/lib/orders.ts) —
 * the order-list view's shape. Almost identical to OrderDetail but the list
 * endpoint does not include the address relation; keep the two in sync with
 * the backend's getOrderDetail vs listCustomerOrders includes.
 */
export interface OrderListItem {
  id: string;
  branchId: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; name: string } | null;
  items: OrderLineItem[];
  statusLogs: OrderStatusLog[];
}

/** POST /api/checkout → { order, duplicated, payment } */
export interface CheckoutResponse {
  order: { id: string };
  duplicated: boolean;
  payment: { provider: string; checkoutUrl: string | null } | null;
}

/** POST /api/coupons/validate → preview (estimate only, records nothing). */
export interface CouponPreview {
  coupon: {
    id: string;
    code: string;
    type: 'FLAT' | 'PERCENTAGE' | 'FREE_DELIVERY' | 'FIRST_ORDER';
    value: number;
    maxDiscount: number | null;
  };
  discount: number;
  finalTotal: number;
}
