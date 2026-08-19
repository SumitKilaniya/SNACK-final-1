import { prisma } from '@/lib/auth/prisma';
import { ApiError } from '@/lib/auth/errors';
import { notifyOrderTransition } from '@/lib/notifications';
import type { Order, OrderStatus } from '@prisma/client';

/**
 * The ONLY legal transitions. Everything else is rejected with
 * INVALID_TRANSITION — e.g. PLACED → DELIVERED is impossible.
 *
 *   PLACED → ACCEPTED_BY_BRANCH → PREPARING → READY_OR_OUT_FOR_DELIVERY → DELIVERED
 *   PLACED → REJECTED_BY_BRANCH (reason required)
 *   PLACED → CANCELLED_BY_CUSTOMER (within CANCEL_WINDOW_MS)
 *   *     → PAYMENT_FAILED → (PLACED | REFUNDED)   [payment flows, Phase 5]
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['ACCEPTED_BY_BRANCH', 'REJECTED_BY_BRANCH', 'CANCELLED_BY_CUSTOMER', 'PAYMENT_FAILED'],
  ACCEPTED_BY_BRANCH: ['PREPARING', 'PAYMENT_FAILED'],
  PREPARING: ['READY_OR_OUT_FOR_DELIVERY', 'PAYMENT_FAILED'],
  READY_OR_OUT_FOR_DELIVERY: ['DELIVERED', 'PAYMENT_FAILED'],
  DELIVERED: [],
  REJECTED_BY_BRANCH: ['REFUNDED'],
  CANCELLED_BY_CUSTOMER: ['REFUNDED'],
  PAYMENT_FAILED: ['PLACED', 'REFUNDED'],
  REFUNDED: [],
};

/** Customers may self-cancel within this window of placing the order. */
export const CANCEL_WINDOW_MS = 5 * 60 * 1000;

export interface TransitionActor {
  userId: string;
  role: string;
}

/**
 * Move an order to `toStatus`, enforcing:
 *  - the transition map above,
 *  - the customer-cancel time window,
 *  - a rejection reason,
 *  - optimistic concurrency (only transitions from the currently-read status;
 *    a concurrent update yields ORDER_CONFLICT instead of a lost update).
 * Every successful transition is recorded in order_status_logs with the actor
 * and role, plus a timestamp.
 */
export async function transitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  actor: TransitionActor,
  opts: { note?: string } = {}
): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');

  const allowed = ORDER_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new ApiError(422, `Cannot move an order from ${order.status} to ${toStatus}`, 'INVALID_TRANSITION', {
      from: order.status,
      to: toStatus,
    });
  }

  if (toStatus === 'CANCELLED_BY_CUSTOMER') {
    const elapsed = Date.now() - order.createdAt.getTime();
    if (elapsed > CANCEL_WINDOW_MS) {
      throw new ApiError(
        422,
        'Orders can only be cancelled within 5 minutes of placing',
        'CANCEL_WINDOW_EXPIRED',
        { windowMinutes: CANCEL_WINDOW_MS / 60_000 }
      );
    }
  }

  if (toStatus === 'REJECTED_BY_BRANCH' && !opts.note) {
    throw new ApiError(400, 'A rejection reason is required', 'REASON_REQUIRED');
  }

  // Generous timeout: under concurrent writes the loser waits on the DB write
  // lock before its stale-status update can resolve to ORDER_CONFLICT.
  const updated = await prisma.$transaction(
    async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: toStatus },
      });
      if (res.count !== 1) {
        throw new ApiError(
          409,
          'This order was just updated by someone else — please refresh',
          'ORDER_CONFLICT'
        );
      }
      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus,
          actorUserId: actor.userId,
          actorRole: actor.role,
          note: opts.note ?? null,
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    },
    { timeout: 15_000 }
  );

  // Customer alerts (SMS + email) on key transitions — fire-and-forget so a
  // provider outage can never roll back or block the state machine.
  void notifyOrderTransition(updated, toStatus, opts.note);

  return updated;
}

/** Branch queue: active (non-terminal) orders for a branch, oldest first. */
export async function listBranchOrders(branchId: string) {
  return prisma.order.findMany({
    where: {
      branchId,
      status: { notIn: ['DELIVERED', 'REJECTED_BY_BRANCH', 'CANCELLED_BY_CUSTOMER', 'REFUNDED'] },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      items: true,
      address: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  });
}

/** A customer's own orders, newest first. */
export async function listCustomerOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      branch: { select: { id: true, name: true } },
      statusLogs: { orderBy: { createdAt: 'asc' } },
    },
  });
}

/** Order detail with the full status timeline, for polling / admin views. */
export async function getOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      address: true,
      branch: { select: { id: true, name: true } },
      statusLogs: { orderBy: { createdAt: 'asc' } },
    },
  });
}
