'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api-client';
import { getAccessToken } from './api-client';
import { TERMINAL_STATUSES, type OrderDetail, type OrderStatus } from './order-types';

/**
 * Live order status — the SINGLE reusable subscription for one order.
 *
 * Extracted verbatim from OrderTracking (Phase 4) so the order LIST page can
 * reflect live status with the exact same logic instead of reimplementing it
 * (Phase 5). Behavior is identical to what OrderTracking had inline:
 *
 *  1. GET /api/orders/[orderId] once (owner-scoped; 403/404 → loadError).
 *  2. Subscribe to the SSE stream (GET .../stream, Bearer token).
 *  3. If the stream can't be established or drops, fall back to polling the
 *     GET endpoint every 5s.
 *  4. A terminal status (TERMINAL_STATUSES) stops everything and marks `done`
 *     — the stream is never restarted as a fallback poller afterwards.
 *
 * Consumers that need to overwrite the order (e.g. a cancel response) call
 * `applyOrder`, which also handles the terminal bookkeeping.
 */

export type LiveMode = 'loading' | 'live' | 'polling' | 'done' | 'error';

export interface OrderLoadError {
  title: string;
  detail: string;
}

function friendlyLoadError(e: unknown): OrderLoadError {
  if (e instanceof api.ApiClientError) {
    if (e.status === 403) return { title: 'Not your order', detail: 'This order belongs to a different account.' };
    if (e.status === 404 || e.code === 'ORDER_NOT_FOUND')
      return { title: 'Order not found', detail: "We couldn't find that order. It may have been removed." };
    return { title: "Couldn't load the order", detail: e.message };
  }
  return { title: "Couldn't load the order", detail: 'Check your connection and try again.' };
}

export function useOrderStream(orderId: string) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [mode, setMode] = useState<LiveMode>('loading');
  const [loadError, setLoadError] = useState<OrderLoadError | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Once a terminal status is seen (SSE event, poll, or cancel response), the
  // stream is done and must never be restarted as a fallback poller.
  const terminalRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  /**
   * Feed a freshly-fetched order (e.g. the response of a cancel mutation).
   * Sets the terminal bookkeeping so the fallback poller never restarts when
   * the resulting status is final.
   */
  const applyOrder = useCallback(
    (updated: OrderDetail) => {
      setOrder(updated);
      if (TERMINAL_STATUSES.has(updated.status)) {
        terminalRef.current = true;
        stopPolling();
        setMode('done');
      }
    },
    [stopPolling]
  );

  // Load the order, then subscribe to the SSE stream; if the stream can't be
  // established or drops, fall back to polling the GET endpoint.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    abortRef.current = controller;

    const poll = async () => {
      try {
        const res = await api.authenticatedFetch<{ order: OrderDetail }>(
          `/api/orders/${encodeURIComponent(orderId)}`
        );
        if (!active) return;
        setOrder(res.order);
        setLoadError(null);
        setMode((m) => (m === 'error' ? 'polling' : m));
        if (TERMINAL_STATUSES.has(res.order.status)) {
          terminalRef.current = true;
          stopPolling();
          setMode('done');
        }
      } catch (e) {
        if (!active) return;
        setLoadError(friendlyLoadError(e));
        setMode('error');
      }
    };

    const startPolling = () => {
      if (!active || terminalRef.current || pollTimerRef.current !== null) return;
      setMode('polling');
      pollTimerRef.current = window.setInterval(() => void poll(), 5000);
    };

    const handleSseBlock = (block: string) => {
      const eventLine = block.split('\n').find((l) => l.trim().startsWith('event:'));
      const dataLine = block.split('\n').find((l) => l.trim().startsWith('data:'));
      if (!eventLine || eventLine.trim() !== 'event: status' || !dataLine) return;
      try {
        const payload = JSON.parse(dataLine.slice(5).trim()) as {
          status: OrderStatus;
          label: string;
          at: string;
        };
        setOrder((prev) =>
          prev ? { ...prev, status: payload.status, updatedAt: payload.at } : prev
        );
        if (TERMINAL_STATUSES.has(payload.status)) {
          terminalRef.current = true;
          stopPolling();
          setMode('done');
        }
      } catch {
        /* malformed frame — ignore */
      }
    };

    const startStream = async () => {
      const token = getAccessToken();
      if (!token) {
        startPolling();
        return;
      }
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error('stream unavailable');
        if (!active) return;
        setMode('live');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            handleSseBlock(buffer.slice(0, idx));
            buffer = buffer.slice(idx + 2);
          }
        }
        // Stream ended (terminal status, 30-min cap, or proxy drop) — poll.
        if (active) startPolling();
      } catch {
        if (active) startPolling();
      }
    };

    (async () => {
      try {
        const res = await api.authenticatedFetch<{ order: OrderDetail }>(
          `/api/orders/${encodeURIComponent(orderId)}`
        );
        if (!active) return;
        setOrder(res.order);
        setLoadError(null);
        if (TERMINAL_STATUSES.has(res.order.status)) {
          terminalRef.current = true;
          setMode('done');
          return;
        }
        void startStream();
      } catch (e) {
        if (!active) return;
        setLoadError(friendlyLoadError(e));
        setMode('error');
      }
    })();

    return () => {
      active = false;
      stopPolling();
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
  }, [orderId, stopPolling]);

  return { order, mode, loadError, applyOrder };
}
