import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { otpVerifySchema } from '@/lib/auth/validation';
import { verifyOtp } from '@/lib/auth/otp';
import { clientIp } from '@/lib/auth/rate-limit';
import { assertSameOrigin } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const { phone, code } = otpVerifySchema.parse(body);

    const result = await verifyOtp(phone, code, clientIp(req));
    if (!result.ok) {
      // Generic message for every failure mode (invalid/expired/exhausted)
      // so an attacker can't distinguish a live code from a dead one.
      throw new ApiError(400, 'Invalid or expired code', 'OTP_INVALID');
    }

    return NextResponse.json({ ok: true, phoneVerified: true });
  } catch (e) {
    return handleError(e);
  }
}
