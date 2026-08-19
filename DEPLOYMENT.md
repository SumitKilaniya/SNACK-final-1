# Snack-Pod — Deployment & Monitoring Guide (Phase 10)

This document is the operational manual for taking the app live. Everything
referenced here exists in the repo; the only steps you must do yourself are the
ones that need a real account/key (marked **YOU**).

---

## 1. Deploy targets

**Freebuff-managed hosting (recommended, zero-ops):** the Deploy button builds
with Next.js framework defaults (`next build`) and serves over HTTPS
automatically. After your first deploy you can redeploy with
`freebuff-deploy start`; watch errors with `freebuff-deploy status | logs`.

**Self-host (VPS / Render / Railway):** the repo ships a `Dockerfile`
(`docker build -t snackpod . && docker run -p 3000:3000 ...`), a
`docker-compose.yml` (app + Postgres + Redis for a local production-like test),
and a GitHub Actions pipeline that pushes a Docker image to GHCR on every merge
to `main` (`.github/workflows/deploy.yml`).

---

## 2. Database — managed Postgres (**YOU**)

The repo runs SQLite in dev for zero-setup. Production uses a managed Postgres.

1. Provision a Postgres instance — **Neon** is recommended (serverless,
   generous free tier, point-in-time backups + encryption at rest on by
   default). [Create a Neon project → Connection Details](https://index.trygravity.ai/go/661b6f80-9049-4c32-9987-c54eda2de627)
   (Supabase is a fine alternative).
2. Copy the connection string (use the **pooled** one for serverless).
3. Switch the datasource provider (one line) and regenerate Postgres migrations:

   ```diff
   - provider = "sqlite"
   + provider = "postgresql"
   ```
   ```bash
   bunx prisma migrate dev --name init_postgres   # once, against the prod DB
   bunx prisma db seed
   ```
4. Set the production env var: `DATABASE_URL=postgresql://...` (in Freebuff:
   `freebuff-deploy env set '{"DATABASE_URL":"..."}'`, or your host's env UI).
   Apply schema changes on deploy with `prisma migrate deploy` (the Docker
   entrypoint already does this, falling back to `db push` on a fresh DB).

Least-privilege: create a dedicated app role that owns only this schema
(no `DROP DATABASE` / access to other databases) and connect with that role.

---

## 3. HTTPS

- **Freebuff hosting / Vercel / Render / Railway:** TLS is automatic on the
  platform's `https://` domain — nothing to configure.
- **Self-managed VPS:** run Nginx in front of the app container and use
  certbot (`certbot --nginx -d yourdomain.com`), which installs Let's Encrypt
  certs and auto-renews. The app itself must only listen on localhost behind
  Nginx.

---

## 4. Redis — optional, opt-in (**YOU**, only if multi-instance)

Rate limiting is **already Redis-ready**: `src/lib/auth/rate-limit.ts` uses a
shared Redis sliding-window store whenever `REDIS_URL` is set, and gracefully
falls back to the in-process store otherwise. Cart/session state lives in
Postgres, so Redis is only needed once you run multiple app instances and want
strict cross-instance rate limits.

- Set `REDIS_URL=redis://...` (Upstash / Redis Cloud / self-hosted). Nothing
  else changes.

---

## 5. Error monitoring — Sentry (**YOU**)

- Create a Sentry project → copy the **DSN**
  (`https://<key>@<org>.ingest.sentry.io/<project>`).
- Set `SENTRY_DSN` in production env. That's it — the SDK is already wired at
  the single error choke point (`src/lib/auth/errors.ts`), so **every API
  route's unhandled 5xx** is captured (4xx client errors are intentionally
  skipped to avoid alert spam). Without the DSN the wrapper logs to the console
  and costs nothing.
- Frontend/browser tracing and sourcemap uploads are deliberately not enabled
  (they need `@sentry/nextjs` + a `SENTRY_AUTH_TOKEN`); add later if you want
  them.

---

## 6. Uptime monitoring — UptimeRobot (**YOU**)

- Sign up at [UptimeRobot](https://index.trygravity.ai/go/ce8dc63e-f53f-4b48-b0f7-1110f7c78ede)
  (free tier: 50 monitors @ 1-min checks).
- Add a monitor: **HTTP(S)** → `https://<your-prod-url>/api/health` →
  interval 1–5 min → alert contact = your email.
- `/api/health` returns `200 {ok:true, db:'up'}` only when the database
  answers, so a down DB (not just a down server) pages you. The optional
  `UPTIMEROBOT_API_KEY` can be used to create monitors programmatically.

---

## 7. CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — runs on every push/PR: install, Prisma
  generate, `tsc` typecheck, `bun audit` (non-blocking), and a full
  `next build`.
- **`.github/workflows/deploy.yml`** — on merge to `main`: builds the Docker
  image and pushes `ghcr.io/<owner>/<repo>:latest` + `:<sha>`. Set an optional
  `DEPLOY_WEBHOOK_URL` secret to trigger a host redeploy after the push.
- Lint is not gated because the repo ships no ESLint config; add
  `eslint.config.mjs` (flat config) first if you want a lint step.

---

## 8. Environment variables (production)

| Var | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Managed Postgres connection string (Neon/Supabase) |
| `JWT_ACCESS_SECRET` | ✅ | Signs 15-min access tokens (≥32 random chars) |
| `JWT_RESET_SECRET` | ✅ | Signs password-reset tokens (≥32 random chars) |
| `APP_ORIGIN` | ✅ | Canonical origin, e.g. `https://app.example.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | for Google login | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | for Google login | OAuth client secret |
| `STRIPE_SECRET_KEY` | for card payments | Stripe (test or live) key |
| `STRIPE_WEBHOOK_SECRET` | for card payments | Webhook signing secret |
| `RESEND_API_KEY` | for email | Transactional email |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | for SMS | OTP + order SMS |
| `SENTRY_DSN` | for alerts | Error monitoring |
| `REDIS_URL` | optional | Shared rate limiting (multi-instance) |
| `UPTIMEROBOT_API_KEY` | optional | Programmatic uptime monitors |

Sandbox `.env` values are dev values; anything that must differ in production
goes through `freebuff-deploy env set '{"KEY":"value"}'`.

---

## 9. Rollback plan

- **Freebuff hosting:** redeploy a previous good build — the platform keeps
  prior deployments.
- **Docker/GHCR:** images are tagged with both `latest` and the commit SHA.
  Roll back by pinning the last known-good SHA:
  `docker run ghcr.io/<owner>/<repo>:<previous-sha>`. Always migrate the
  database **forward** before deploying new code that needs the new schema, and
  never roll back a schema migration (roll back code only).

---

## 10. Fresh-deploy checklist (Phase 10 checkpoint)

1. `docker compose up --build` locally (app + Postgres + Redis) — or deploy to
   Freebuff hosting.
2. `GET /api/health` → `200 ok:true db:up`.
3. Signup with email/password → verify phone via OTP (dev SMS echoes the code).
4. Create a branch + menu items (super admin seed: `super_admin@snackpod.local`
   / `SuperAdmin@123!`).
5. Place an order, walk it through branch accept → delivered (COD) or pay via
   Stripe test mode (webhook-verified).
6. Trigger a deliberate 5xx once and confirm it appears in Sentry.
7. Confirm UptimeRobot is polling `/api/health` and that a stopped app pages
   you.
