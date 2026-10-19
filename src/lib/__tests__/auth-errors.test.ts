import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { ApiError, handleError } from '@/lib/auth/errors';

describe('handleError', () => {
  it('returns a clear service-unavailable response for database connection failures', async () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `localhost:5432`",
      '6.19.3',
      'P1001'
    );

    const response = handleError(error);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
      error: 'The service is temporarily unavailable because its database cannot be reached.',
    });
  });

  it('preserves intentional API errors', async () => {
    const response = handleError(new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      error: 'Invalid credentials',
    });
  });

  it('explains when the database is reachable but its schema is not initialized', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'The table `public.users` does not exist in the current database.',
      {
        code: 'P2021',
        clientVersion: '6.19.3',
      }
    );

    const response = handleError(error);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DATABASE_SCHEMA_NOT_READY',
      error: expect.stringContaining('Apply the project migrations to a development database'),
    });
  });
});
