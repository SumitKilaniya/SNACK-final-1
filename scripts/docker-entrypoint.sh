#!/bin/sh
# Container entrypoint: apply DB schema, then start the Next.js server.
#   SKIP_MIGRATIONS=1  → skip the schema step entirely
#
# Every step logs a clear timeline line. If the database schema cannot be
# applied (migrate deploy AND db push both fail), the container exits
# non-zero and the Next.js server is NEVER started — a broken schema can
# never be served silently.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is set"
else
  echo "[entrypoint] WARNING: DATABASE_URL is not set — the app will fail its startup DB probe"
fi

if [ -n "$DATABASE_URL" ] && [ "$SKIP_MIGRATIONS" != "1" ]; then
  echo "[entrypoint] 1/2 running prisma migrate deploy..."
  if bunx prisma migrate deploy; then
    echo "[entrypoint]   migrations applied"
  else
    echo "[entrypoint]   migrate deploy failed — falling back to schema sync (prisma db push)"
    if bunx prisma db push --skip-generate --accept-data-loss; then
      echo "[entrypoint]   schema synced via db push"
    else
      echo "[entrypoint] FATAL: could not apply the database schema — both 'prisma migrate deploy' and 'prisma db push' failed." >&2
      echo "[entrypoint] The Next.js server will NOT start. Check DATABASE_URL and the database logs above." >&2
      exit 1
    fi
  fi
else
  echo "[entrypoint] skipping database schema step (SKIP_MIGRATIONS=1 or no DATABASE_URL)"
fi

echo "[entrypoint] 2/2 starting Next.js on 0.0.0.0:${PORT:-3000}"
exec bun next start -p "${PORT:-3000}" -H 0.0.0.0
