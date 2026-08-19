import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/auth/errors';
import { requireAuth } from '@/lib/auth/guard';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    return NextResponse.json({ user });
  } catch (e) {
    return handleError(e);
  }
}
