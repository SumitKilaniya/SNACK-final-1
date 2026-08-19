# ─────────────────────────────────────────────────────────────────────────────
# Snack-Pod — self-host Docker image (VPS / Render / Railway / any Docker host)
#
#   docker build -t snackpod .
#   docker run -p 3000:3000 \
#     -e DATABASE_URL=postgresql://... \
#     -e JWT_ACCESS_SECRET=... \
#     -e JWT_RESET_SECRET=... \
#     snackpod
#
# NOTE: the app is Postgres-only (see prisma/schema.prisma). Set
# DATABASE_URL at runtime and apply migrations before starting (the container
# entrypoint runs `prisma migrate deploy` — see scripts/docker-entrypoint.sh).
# ─────────────────────────────────────────────────────────────────────────────

FROM oven/bun:1 AS base
WORKDIR /app

# ---- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock* ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ---- build -------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time DB not required: all pages render client-side; no page hits Prisma
# during prerender. A well-formed dummy value keeps tooling happy if that ever
# changes (a valid Postgres URL, since the provider is postgresql).
ENV DATABASE_URL=postgresql://snackpod:snackpod@localhost:5432/snackpod
RUN bun run build

# ---- runtime -----------------------------------------------------------------
FROM oven/bun:1 AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
# Self-healing: any container host restarts a hung/crashed instance instead
# of serving 502s indefinitely. The probe targets /api/health, which returns
# 200 only when the app is up AND the database answers, so a dead DB also
# flags the container unhealthy. bun's built-in fetch is used because the
# base image ships no curl/wget (a wget-based probe would fail every check).
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"]
# Applies pending migrations (falling back to a schema sync on a fresh DB),
# then starts the Next.js production server.
CMD ["sh", "scripts/docker-entrypoint.sh"]
