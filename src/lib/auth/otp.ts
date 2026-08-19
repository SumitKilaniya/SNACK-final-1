import { createHmac, randomBytes, randomInt } from 'crypto';
import { prisma } from './prisma';
import { safeEqual } from './errors';
import { checkRateLimit, type RateLimitRule } from './rate-limit';
import { getSmsProvider } from './sms';
import { auditLog } from './audit';

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 min between sends to the same phone

// Per-phone: max 3 sends per 15 minutes.
const phoneRule: RateLimitRule = { windowMs: 15 * 60 * 1000, max: 3 };
// Per-IP: max 10 sends per hour.
const ipRule: RateLimitRule = { windowMs: 60 * 60 * 1000, max: 10 };

function hashOtp(phone: string, code: string, salt: string): string {
  // salt$hmac — the salt is stored alongside the hash (HMAC key); the code
  // itself is never persisted in plaintext.
  const hmac = createHmac('sha256', salt).update(`${phone}:${code}`).digest('hex');
  return `${salt}$${hmac}`;
}

export type SendOtpResult =
  | { ok: true; devCode?: string; resendAfterMs: number }
  | { ok: false; code: 'rate_limited' | 'cooldown' | 'sms_failed'; retryAfterMs: number };

export interface SendOtpContext {
  ip: string;
  userId?: string;
}

/** Generate, persist (hashed) and dispatch a 6-digit OTP for a phone number. */
export async function sendOtp(phone: string, ctx: SendOtpContext): Promise<SendOtpResult> {
  // Per-phone window
  const phoneHit = await checkRateLimit(`otp:phone:${phone}`, phoneRule);
  if (!phoneHit.ok) return { ok: false, code: 'rate_limited', retryAfterMs: phoneHit.retryAfterMs };
  // Per-IP window
  const ipHit = await checkRateLimit(`otp:ip:${ctx.ip}`, ipRule);
  if (!ipHit.ok) return { ok: false, code: 'rate_limited', retryAfterMs: ipHit.retryAfterMs };

  // Resend cooldown (no new code within 60s of the previous one)
  const latest = await prisma.otp.findFirst({
    where: { phone, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const wait = OTP_RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime());
    return { ok: false, code: 'cooldown', retryAfterMs: wait };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = randomBytes(16).toString('hex');

  await prisma.otp.create({
    data: {
      phone,
      codeHash: hashOtp(phone, code, salt),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      userId: ctx.userId ?? null,
    },
  });

  try {
    await getSmsProvider().send(
      phone,
      `Your Snack-Pod verification code is ${code}. Valid for 5 minutes.`
    );
  } catch (e) {
    console.error('[otp] sms send failed:', e);
    return { ok: false, code: 'sms_failed', retryAfterMs: 0 };
  }

  await auditLog({ userId: ctx.userId, action: 'otp_sent', ip: ctx.ip, meta: { phone } });

  // DEV ONLY: echo the code so local flows can be tested without an SMS
  // gateway. Never returned when NODE_ENV=production.
  const devCode = process.env.NODE_ENV === 'production' ? undefined : code;
  return { ok: true, devCode, resendAfterMs: OTP_RESEND_COOLDOWN_MS };
}

export type VerifyOtpResult =
  { ok: true; userId: string | null } | { ok: false; code: 'invalid' | 'expired' | 'attempts' };

/** Verify a submitted code against the newest unverified OTP for the phone. */
export async function verifyOtp(phone: string, code: string, ip: string): Promise<VerifyOtpResult> {
  const otp = await prisma.otp.findFirst({
    where: { phone, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return { ok: false, code: 'invalid' };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, code: 'attempts' };
  if (otp.expiresAt.getTime() < Date.now()) return { ok: false, code: 'expired' };

  const [salt, stored] = otp.codeHash.split('$');
  if (!salt || !stored) return { ok: false, code: 'invalid' };

  const ok = safeEqual(createHmac('sha256', salt).update(`${phone}:${code}`).digest('hex'), stored);

  if (!ok) {
    const attempts = otp.attempts + 1;
    await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts },
    });
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otp.update({
        where: { id: otp.id },
        data: { verifiedAt: new Date(), attempts },
      });
    }
    return { ok: false, code: attempts >= OTP_MAX_ATTEMPTS ? 'attempts' : 'invalid' };
  }

  // Success → mark verified, flag the owning user's phone.
  await prisma.otp.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
  let userId = otp.userId;
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { phoneVerified: true, phone } });
  } else {
    const byPhone = await prisma.user.findFirst({ where: { phone } });
    if (byPhone) {
      userId = byPhone.id;
      await prisma.user.update({ where: { id: byPhone.id }, data: { phoneVerified: true } });
    }
  }
  await auditLog({ userId, action: 'otp_verified', ip, meta: { phone } });
  return { ok: true, userId };
}
