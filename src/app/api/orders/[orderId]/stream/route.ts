import { NextRequest, NextResponse } from 'next/server';
import { ApiError, forbidden, handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';
import { prisma } from '@/lib/auth/prisma';
import { isTerminalStatus, orderStatusCopy } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_INTERVAL_MS = 3000;
const MAX_DURATION_MS = 30 * 60 * 1000;

/**
 * Live order tracking via Server-Sent Events — a push stream that proxies
 * through anything HTTP (no raw-WebSocket firewall issues). The server polls
 * the DB (short interval) and pushes `status` events on change; the client
 * gets real-time updates with a plain fetch/EventSource and no polling code.
 *
 *   GET /api/orders/[orderId]/stream  (Bearer token, owner-only)
 *
 * Security: identical to the poll endpoint — requireAuth + the order must
 * belong to the caller (IDOR-safe). The stream closes on terminal statuses
 * (delivered / rejected / cancelled / refunded) or after 30 minutes.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const authed = await requireAuth(req);
    const { orderId } = await params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    if (order.userId !== authed.user.id) throw forbidden();

    const sp = req.nextUrl.searchParams;
    const requested = Number(sp.get('interval'));
    const interval = Number.isFinite(requested)
      ? Math.min(Math.max(Math.round(requested), 250), 30_000)
      : DEFAULT_INTERVAL_MS;

    const encoder = new TextEncoder();
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let lastStatus: string | null = null;
        const startedAt = Date.now();
        let closed = false;

        const clearAll = () => {
          if (pollTimer) clearInterval(pollTimer);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          pollTimer = null;
          heartbeatTimer = null;
        };

        const send = (status: string, at: string) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(
              `event: status\ndata: ${JSON.stringify({ status, label: orderStatusCopy(status as never), at })}\n\n`
            )
          );
        };

        const close = () => {
          if (closed) return;
          closed = true;
          clearAll();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        // Heartbeat every 15s keeps proxies from dropping the idle stream.
        heartbeatTimer = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            close();
          }
        }, 15_000);

        const check = async () => {
          if (closed) return;
          if (Date.now() - startedAt > MAX_DURATION_MS) {
            close();
            return;
          }
          try {
            const fresh = await prisma.order.findUnique({
              where: { id: orderId },
              select: { status: true, updatedAt: true },
            });
            if (!fresh) {
              close();
              return;
            }
            if (fresh.status !== lastStatus) {
              lastStatus = fresh.status;
              send(fresh.status, fresh.updatedAt.toISOString());
              if (isTerminalStatus(fresh.status)) close();
            }
          } catch {
            close();
          }
        };

        // Push the current status immediately, then poll.
        void check();
        pollTimer = setInterval(() => void check(), interval);
      },
      cancel() {
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        pollTimer = null;
        heartbeatTimer = null;
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
