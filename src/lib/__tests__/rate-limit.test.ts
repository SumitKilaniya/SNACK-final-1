import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '@/lib/auth/rate-limit';

describe('checkRateLimit — sliding window in-process limiter', () => {
  it('allows hits within the burst limit', async () => {
    const key = `test_burst_${Date.now()}`;
    const rule = { windowMs: 1000, max: 3 };

    const r1 = await checkRateLimit(key, rule);
    const r2 = await checkRateLimit(key, rule);
    const r3 = await checkRateLimit(key, rule);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
  });

  it('rejects when exceeding max burst', async () => {
    const key = `test_exceed_${Date.now()}`;
    const rule = { windowMs: 1000, max: 2 };

    const r1 = await checkRateLimit(key, rule);
    const r2 = await checkRateLimit(key, rule);
    const r3 = await checkRateLimit(key, rule);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(false);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after window expires', async () => {
    const key = `test_expire_${Date.now()}`;
    const rule = { windowMs: 50, max: 1 };

    const r1 = await checkRateLimit(key, rule);
    expect(r1.ok).toBe(true);

    const r2 = await checkRateLimit(key, rule);
    expect(r2.ok).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 70));

    const r3 = await checkRateLimit(key, rule);
    expect(r3.ok).toBe(true);
  });
});
