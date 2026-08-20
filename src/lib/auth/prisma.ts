import { PrismaClient } from '@prisma/client';

// Local-dev convenience: the schema reads `env("DATABASE_URL")`, and without
// it every DB-backed API fails at the first query. When unset and not in
// production, default to the docker-compose Postgres service (see
// docker-compose.yml) — production always provides a real DATABASE_URL, which
// is never overridden here.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL = 'file:./dev.db';
}

// Prevent exhausting the SQLite/connection pool during Next.js dev hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
