import { PrismaClient } from '@prisma/client';

// Local-dev convenience. Production must always provide its managed Postgres
// connection string; never silently create or use a local database there.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL = 'postgresql://snackpod:snackpod@localhost:5432/snackpod';
}

// Prevent exhausting the database connection pool during Next.js dev hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
