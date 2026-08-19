import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/auth/errors';
import { otpSendSchema } from '@/lib/auth/validation';
import { sendOtp } from '@/lib/auth/otp';
import { clientIp } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/auth/prisma';
import { assertSameOrigin } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);

    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid request body', 'BAD_REQUEST');
    });
    const { phone } = otpSendSchema.parse(body);

    // Attach the user id when the phone already belongs to an account
    // (so phone_verified is set on the right row).
    const owner = await prisma.user.findFirst({ where: { phone } });

    const result = await sendOtp(phone, { ip: clientIp(req), userId: owner?.id ?? undefined });

    if (!result.ok) {
      const status = result.code === 'sms_failed' ? 500 : 429;
      throw new ApiError(
        status,
        result.code === 'sms_failed'
          ? 'Could not send the code right now. Please try again.'
          : 'Please wait before requesting another code.',
        result.code.toUpperCase(),
        { retryAfterMs: result.retryAfterMs }
      );
    }

    return NextResponse.json({
      ok: true,
      resendAfterMs: result.resendAfterMs,
      // DEV ONLY: never present in production builds.
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (e) {
    return handleError(e);
  }
}
