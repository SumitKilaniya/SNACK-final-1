#!/bin/sh
# Container entrypoint: apply DB schema, then start the Next.js server.
#   SKIP_MIGRATIONS=1  → skip the schema step entirely
#
# Every step logs a clear timeline line. If a checked-in migration fails, the
# container exits non-zero and the Next.js server is never started.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is set"
else
  echo "[entrypoint] WARNING: DATABASE_URL is not set — the app will fail its startup DB probe"
fi

if [ -n "$DATABASE_URL" ] && [ "$SKIP_MIGRATIONS" != "1" ]; then
  echo "[entrypoint] 1/2 running prisma migrate deploy..."
  pnpm run db:migrate:deploy
  echo "[entrypoint]   migrations applied"
else
  if [ "$NODE_ENV" = "production" ] && [ -z "$DATABASE_URL" ]; then
    echo "[entrypoint] FATAL: DATABASE_URL is required in production." >&2
    exit 1
  fi
  echo "[entrypoint] skipping database schema step (SKIP_MIGRATIONS=1 or no DATABASE_URL)"
fi

echo "[entrypoint] 2/2 starting Next.js on 0.0.0.0:${PORT:-3000}"
exec pnpm run start
