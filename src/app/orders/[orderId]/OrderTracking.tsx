'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/toast-context';
import * as api from '@/lib/api-client';
import {
  CANCELLABLE_STATUSES,
  ORDER_PIPELINE,
  ORDER_STATUS_LABEL,
  type OrderDetail,
} from '@/lib/order-types';
import { useOrderStream } from '@/lib/use-order-stream';

function errorMessage(e: unknown): string {
  if (e instanceof api.ApiClientError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

const PAYMENT_LABEL: Record<string, string> = {
  cod: 'Cash on Delivery',
  card: 'Card',
};

/**
 * Live order confirmation / tracking — the single success destination after
 * checkout. All stream/poll logic lives in useOrderStream (shared with the
 * order list page); this component only renders.
 *
 * Phase 6 adds real review submission here once the Review model + API exist.
 */
export default function OrderTracking({ orderId }: { orderId: string }) {
  const { showToast } = useToast();
  const { order, mode, loadError, applyOrder } = useOrderStream(orderId);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(async () => {
    if (!order || cancelBusy) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const res = await api.authenticatedFetch<{ order: OrderDetail }>(
        `/api/orders/${encodeURIComponent(orderId)}/cancel`,
        { method: 'POST' }
      );
      applyOrder(res.order);
      setShowCancelConfirm(false);
      showToast('Your order has been cancelled.');
    } catch (e) {
      setCancelError(errorMessage(e));
      setShowCancelConfirm(false);
    } finally {
      setCancelBusy(false);
    }
  }, [order, cancelBusy, orderId, applyOrder, showToast]);

  /* ── Loading / error states ─────────────────────────────────────────── */

  if (mode === 'loading') {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 flex justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading your order…</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
          {loadError?.title === 'Not your order' ? '🔒' : '🤔'}
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">
          {loadError?.title ?? "Couldn't load the order"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {loadError?.detail ?? 'Please try again.'}
        </p>
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-accent transition-colors"
        >
          <Icon name="ArrowRightIcon" size={16} />
          Back to Menu
        </Link>
      </main>
    );
  }

  const pipelineIndex = ORDER_PIPELINE.indexOf(order.status);
  const isPipeline = pipelineIndex !== -1;
  const canCancel = CANCELLABLE_STATUSES.has(order.status);
  const paymentLabel = PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {mode === 'error' && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl px-3 py-2.5">
          <Icon name="ExclamationTriangleIcon" size={16} className="shrink-0 mt-0.5" />
          <span>Having trouble refreshing your order — retrying automatically.</span>
        </div>
      )}
      {/* ── Success header ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-3xl border border-border shadow-sm p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
            <Icon name="CheckIcon" size={26} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-extrabold tracking-[0.2em] text-primary uppercase mb-1">
              Order Confirmed
            </p>
            <h1 className="text-2xl font-black text-foreground">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Placed {formatDateTime(order.createdAt)} · {order.branch?.name ?? 'your branch'} ·{' '}
              {paymentLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-full border border-primary/30 bg-orange-50 text-primary text-xs font-extrabold">
              {ORDER_STATUS_LABEL[order.status]}
            </span>
            {mode === 'live' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : mode === 'polling' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-stone-600 text-[11px] font-bold">
                <Icon name="ArrowPathIcon" size={12} />
                Refreshing
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Status stepper (happy path) ──────────────────────────────── */}
        {isPipeline ? (
          <div className="relative mt-8 flex items-center justify-between">
            <div className="absolute top-4 left-4 right-4 h-1 bg-stone-200 -translate-y-1/2 z-0" />
            <div
              className="absolute top-4 left-4 h-1 bg-primary -translate-y-1/2 z-0 transition-all duration-500 ease-out"
              style={{
                width: `${Math.max(0, (pipelineIndex / (ORDER_PIPELINE.length - 1)) * 90)}%`,
              }}
            />
            {ORDER_PIPELINE.map((step, idx) => {
              const completed = idx < pipelineIndex;
              const current = idx === pipelineIndex;
              return (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      completed || current
                        ? 'bg-primary text-white shadow-md shadow-primary/30'
                        : 'bg-stone-200 text-stone-500'
                    } ${current ? 'ring-4 ring-orange-100 scale-110' : ''}`}
                  >
                    {completed ? <Icon name="CheckIcon" size={14} /> : <span>{idx + 1}</span>}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-bold mt-2 text-center max-w-[70px] leading-tight ${
                      current
                        ? 'text-primary font-black'
                        : completed
                          ? 'text-foreground font-semibold'
                          : 'text-stone-400'
                    }`}
                  >
                    {ORDER_STATUS_LABEL[step]}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 p-4 bg-stone-50 border border-stone-200 rounded-2xl text-sm text-muted-foreground">
            {order.status === 'CANCELLED_BY_CUSTOMER' &&
              'This order was cancelled by you. Any payment made will be refunded automatically.'}
            {order.status === 'REJECTED_BY_BRANCH' &&
              "We're sorry — the restaurant couldn't fulfil this order. Any payment made will be refunded automatically."}
            {order.status === 'PAYMENT_FAILED' && 'The payment for this order failed. You can retry — your order is saved.'}
            {order.status === 'REFUNDED' && 'The refund for this order has been processed.'}
          </div>
        )}
      </section>

      {/* ── Cancel (only from a cancellable state) ─────────────────────── */}
      {canCancel && (
        <section className="bg-white rounded-2xl border border-border p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">Changed your mind?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You can cancel this order within 5 minutes of placing it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            disabled={cancelBusy}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors disabled:opacity-60 flex items-center gap-1.5 shrink-0"
          >
            <Icon name="XMarkIcon" size={15} />
            Cancel Order
          </button>
        </section>
      )}
      {cancelError && (
        <div className="mb-6 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-3 py-2.5">
          <Icon name="ExclamationTriangleIcon" size={16} className="shrink-0 mt-0.5" />
          <span>{cancelError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Items + totals ───────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-extrabold text-foreground">Order Items</h2>
            </div>
            <div className="p-5 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground font-medium">
                    {item.name}{' '}
                    <span className="text-muted-foreground font-bold">× {item.quantity}</span>
                  </span>
                  <span className="font-bold text-foreground">₹{item.total}</span>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery fee</span>
                <span>₹{order.deliveryFee}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-semibold">
                  <span>Coupon discount</span>
                  <span>-₹{order.discount}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-foreground pt-2 border-t border-border">
                <span>Total (confirmed)</span>
                <span className="text-primary">₹{order.total}</span>
              </div>
            </div>
          </section>

          {order.notes && (
            <section className="bg-white rounded-2xl border border-border p-5">
              <h2 className="text-base font-extrabold text-foreground mb-2">Special Instructions</h2>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </section>
          )}

          {/* ── Status timeline ────────────────────────────────────────── */}
          {order.statusLogs.length > 0 && (
            <section className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-base font-extrabold text-foreground">Order Timeline</h2>
              </div>
              <div className="p-5 space-y-0">
                {order.statusLogs.map((log, idx) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                          idx === order.statusLogs.length - 1
                            ? 'bg-primary'
                            : 'bg-stone-300'
                        }`}
                      />
                      {idx < order.statusLogs.length - 1 && (
                        <div className="w-px flex-1 bg-stone-200" />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm font-bold text-foreground">
                        {ORDER_STATUS_LABEL[log.toStatus] ?? log.toStatus}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatTime(log.createdAt)}
                        {log.note ? ` · ${log.note}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {/* Phase 6 adds real review submission here once the Review model + API exist. */}
        </div>

        {/* ── Delivery address ─────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-extrabold text-foreground">Delivering To</h2>
            </div>
            <div className="p-5">
              {order.address ? (
                <>
                  <p className="text-sm font-bold text-foreground">
                    {order.address.label || 'Delivery address'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {[order.address.line1, order.address.line2].filter(Boolean).join(', ')}
                    <br />
                    {[order.address.city, order.address.state].filter(Boolean).join(', ')} —{' '}
                    {order.address.pincode}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No address recorded.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-border p-5">
            <h2 className="text-base font-extrabold text-foreground mb-2">Need help?</h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Order status updates appear here automatically — no need to refresh the page.
            </p>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <Icon name="ClipboardDocumentListIcon" size={14} />
              View all orders
            </Link>
          </section>
        </div>
      </div>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel this order?"
        message="Are you sure you want to cancel this order? This can't be undone."
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        busy={cancelBusy}
        onConfirm={() => void handleCancel()}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </main>
  );
}
