import type { NextRequest } from 'next/server';

export interface RateLimitRule {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

/**
 * Sliding-window rate limiter (Phase 10 item 5).
 *
 * When REDIS_URL is configured the counters live in Redis (sorted set), so
 * limits are shared across instances — required for serverless or
 * multi-replica deploys. Without it (local dev, single instance) an in-process
 * store is used. The public API is identical either way: `await checkRateLimit`.
 * Any Redis failure degrades to the in-process store rather than erroring the
 * request.
 */
interface RateLimitStore {
  check(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

// ── In-process store (single instance) ──────────────────────────────────────
const hits = new Map<string, number[]>();

const memoryStore: RateLimitStore = {
  async check(key, rule) {
    const now = Date.now();
    const window = (hits.get(key) ?? []).filter((t) => now - t < rule.windowMs);
    if (window.length >= rule.max) {
      hits.set(key, window);
      const retryAfterMs = Math.max(0, rule.windowMs - (now - window[0]));
      return { ok: false, retryAfterMs };
    }
    window.push(now);
    hits.set(key, window);
    return { ok: true, retryAfterMs: 0 };
  },
};

// ── Redis store (multi-instance) ────────────────────────────────────────────
let redisClient: Promise<import('ioredis').Redis | null> | null = null;

function getRedis(): Promise<import('ioredis').Redis | null> {
  if (!process.env.REDIS_URL) return Promise.resolve(null);
  if (!redisClient) {
    redisClient = import('ioredis')
      .then(({ default: Redis }) => {
        return new Redis(process.env.REDIS_URL as string, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
      })
      .catch((e) => {
        console.error(
          '[rate-limit] redis unavailable, using in-process store:',
          (e as Error).message
        );
        redisClient = null; // retry the connection on the next call
        return null;
      });
  }
  return redisClient;
}

const redisStore: RateLimitStore = {
  async check(key, rule) {
    const redis = await getRedis();
    if (!redis) return memoryStore.check(key, rule);
    try {
      const now = Date.now();
      const k = `rl:${key}`;
      const results = await redis
        .multi()
        .zremrangebyscore(k, 0, now - rule.windowMs) // drop stale hits
        .zadd(k, now, `${now}:${Math.random()}`) // record this hit
        .zcard(k) // count hits inside the window
        .pexpire(k, rule.windowMs + 1_000) // bound the key's lifetime
        .exec();
      const count = Number(results?.[2]?.[1] ?? 0);
      if (count > rule.max) return { ok: false, retryAfterMs: rule.windowMs };
      return { ok: true, retryAfterMs: 0 };
    } catch (e) {
      console.error('[rate-limit] redis check failed, using in-process store:', e);
      return memoryStore.check(key, rule);
    }
  },
};

/**
 * Check a sliding-window limit for `key`. Backed by Redis when configured,
 * otherwise an in-process store — same signature everywhere.
 */
export async function checkRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  return redisStore.check(key, rule);
}

/** Best-effort client IP from proxy headers, then the socket address. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function requestContext(req: NextRequest) {
  return {
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  };
}

/** Convenience: hash an identifier so it is never stored/compared raw. */
export function key(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(':');
}
