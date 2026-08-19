import { describe, expect, it } from 'vitest';
import { CANCEL_WINDOW_MS, ORDER_TRANSITIONS } from '@/lib/orders';
import type { OrderStatus } from '@prisma/client';

const STATUSES = Object.keys(ORDER_TRANSITIONS) as OrderStatus[];

describe('ORDER_TRANSITIONS — the order state machine', () => {
  it('covers every OrderStatus exactly once as a source', () => {
    const modelStatuses: OrderStatus[] = [
      'PLACED',
      'ACCEPTED_BY_BRANCH',
      'PREPARING',
      'READY_OR_OUT_FOR_DELIVERY',
      'DELIVERED',
      'REJECTED_BY_BRANCH',
      'CANCELLED_BY_CUSTOMER',
      'PAYMENT_FAILED',
      'REFUNDED',
    ];
    expect(STATUSES.sort()).toEqual(modelStatuses.sort());
  });

  it('every transition target is itself a known status (map is closed)', () => {
    for (const [from, tos] of Object.entries(ORDER_TRANSITIONS)) {
      for (const to of tos) {
        expect(STATUSES, `${from} → ${to} must be a known status`).toContain(to);
      }
    }
  });

  it('walks the full legal happy path', () => {
    const path: OrderStatus[] = [
      'PLACED',
      'ACCEPTED_BY_BRANCH',
      'PREPARING',
      'READY_OR_OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(ORDER_TRANSITIONS[path[i]]).toContain(path[i + 1]);
    }
  });

  it('rejects every illegal jump in the original requirements list', () => {
    const illegal: Array<[OrderStatus, OrderStatus]> = [
      ['PLACED', 'DELIVERED'], // straight from placed to delivered
      ['ACCEPTED_BY_BRANCH', 'DELIVERED'], // skips preparing + ready
      ['ACCEPTED_BY_BRANCH', 'READY_OR_OUT_FOR_DELIVERY'], // skips preparing
      ['PREPARING', 'DELIVERED'],
      ['PREPARING', 'ACCEPTED_BY_BRANCH'], // backwards
      ['DELIVERED', 'PLACED'], // terminal, nothing after
      ['DELIVERED', 'REJECTED_BY_BRANCH'],
      ['REFUNDED', 'PLACED'], // terminal
      ['REJECTED_BY_BRANCH', 'ACCEPTED_BY_BRANCH'], // rejected is final (→ refund only)
      ['CANCELLED_BY_CUSTOMER', 'PLACED'],
      ['PLACED', 'PLACED'], // no self-transitions
      ['PAYMENT_FAILED', 'DELIVERED'],
    ];
    for (const [from, to] of illegal) {
      expect(ORDER_TRANSITIONS[from], `${from} → ${to} must NOT be legal`).not.toContain(to);
    }
  });

  it('branch admin actions only exist from the correct source states', () => {
    // Accept/reject only from PLACED; prepare only from ACCEPTED; deliver only from READY.
    expect(ORDER_TRANSITIONS['PLACED']).toContain('ACCEPTED_BY_BRANCH');
    expect(ORDER_TRANSITIONS['PLACED']).toContain('REJECTED_BY_BRANCH');
    expect(ORDER_TRANSITIONS['PLACED']).not.toContain('PREPARING');
    expect(ORDER_TRANSITIONS['ACCEPTED_BY_BRANCH']).toContain('PREPARING');
    expect(ORDER_TRANSITIONS['ACCEPTED_BY_BRANCH']).not.toContain('DELIVERED');
    expect(ORDER_TRANSITIONS['READY_OR_OUT_FOR_DELIVERY']).toContain('DELIVERED');
    expect(ORDER_TRANSITIONS['READY_OR_OUT_FOR_DELIVERY']).not.toContain('PREPARING');
  });

  it('customer cancel + refund edges are as specified', () => {
    expect(ORDER_TRANSITIONS['PLACED']).toContain('CANCELLED_BY_CUSTOMER');
    expect(ORDER_TRANSITIONS['REJECTED_BY_BRANCH']).toContain('REFUNDED');
    expect(ORDER_TRANSITIONS['CANCELLED_BY_CUSTOMER']).toContain('REFUNDED');
    expect(ORDER_TRANSITIONS['PAYMENT_FAILED']).toEqual(['PLACED', 'REFUNDED']);
  });

  it('the customer-cancel window is 5 minutes', () => {
    expect(CANCEL_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});
