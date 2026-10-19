import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { captureError } from '@/lib/monitoring/sentry';

const DATABASE_CONNECTION_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1010',
  'P1011',
  'P1013',
  'P1017',
]);

/** Error carrying an HTTP status + machine-readable code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorized = (msg = 'Authentication required') =>
  new ApiError(401, msg, 'UNAUTHENTICATED');
export const forbidden = (msg = 'You do not have permission to do this') =>
  new ApiError(403, msg, 'FORBIDDEN');

/** Turn any thrown value into a consistent JSON error response. */
export function handleError(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    // 5xx = an unexpected server failure → alert Sentry. 4xx are intentional
    // client errors and would only spam alerts, so they're deliberately skipped.
    if (e.status >= 500) captureError(e, { status: e.status, code: e.code });
    return NextResponse.json({ error: e.message, code: e.code, ...e.extra }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: 'Validation failed', issues: e.flatten() }, { status: 400 });
  }
  if (
    e instanceof Prisma.PrismaClientInitializationError ||
    (e instanceof Prisma.PrismaClientKnownRequestError &&
      DATABASE_CONNECTION_ERROR_CODES.has(e.code))
  ) {
    captureError(e, { status: 503, code: 'DATABASE_UNAVAILABLE' });
    return NextResponse.json(
      {
        error: 'The service is temporarily unavailable because its database cannot be reached.',
        code: 'DATABASE_UNAVAILABLE',
      },
      { status: 503 }
    );
  }
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === 'P2021' || e.code === 'P2022')
  ) {
    captureError(e, { status: 503, code: 'DATABASE_SCHEMA_NOT_READY' });
    return NextResponse.json(
      {
        error:
          'The database is connected, but its schema is not initialized. Apply the project migrations to a development database before using this feature.',
        code: 'DATABASE_SCHEMA_NOT_READY',
      },
      { status: 503 }
    );
  }
  console.error('[auth] unhandled error:', e);
  captureError(e);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

/** Constant-time comparison for sensitive strings (OTP hashes, states). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
