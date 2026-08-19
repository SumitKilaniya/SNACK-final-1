# Snack-Pod

Snack-Pod is a full-stack quick-service restaurant ordering platform for
Bangalore outlets: browse dishes by category, pick a branch (delivery is
pincode-scoped), build a cart, apply coupons, and check out with cash on
delivery or card (Stripe). Branch admins and super admins manage the menu,
orders, coupons, users, and reports from a built-in admin panel.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS**
- **Prisma ORM** — **Postgres** in local dev and production (migrations in `prisma/migrations`)
- **Redis** (optional, via docker-compose) for shared rate limiting
- **Auth**: email/password (Argon2id), Google OAuth, phone OTP via Twilio,
  JWT access tokens + rotating refresh tokens
- **Payments**: Stripe Checkout + webhooks; **Email**: Resend; **Monitoring**: Sentry

## Local development (docker compose)

The app is Postgres-only, so local dev runs against the same database engine
as production via docker-compose (app + Postgres + Redis).

Prereqs: Docker, and a recent Bun (`curl -fsSL https://bun.sh/install | bash`).

```bash
cp .env.example .env.local      # then fill in real values (see below)
bun install                     # installs deps + runs `prisma generate`
./scripts/dev-doctor.sh         # builds the stack and verifies it is actually healthy
```

- App: http://localhost:3000 — health check: http://localhost:3000/api/health
  (returns `{"ok":true,"db":"up"}` once Postgres answers)
- Seed dev data (branches, menu, test accounts) on a fresh database:
  `bunx prisma db seed`
- Browse the database: `bunx prisma studio`

`scripts/docker-entrypoint.sh` runs `prisma migrate deploy` on container start
(falling back to a schema sync on a fresh DB) and refuses to start the server
if the schema step fails; `docker-compose` healthchecks gate the app on
`db`/`redis` being healthy first.

### Is the app actually working? — `./scripts/dev-doctor.sh`

**This is the standard way to check the app.** Do not trust a browser preview
or a proxy URL to tell you the app is broken — a gateway error only says the
upstream isn't answering, not why. `dev-doctor.sh` does it properly:

```bash
./scripts/dev-doctor.sh
```

It confirms Docker is running, builds & starts the full stack
(`docker compose up --build -d`), waits up to 30s for
`/api/health` to return 200, prints **✅ Healthy. App is up at
http://localhost:3000** on success, or on failure prints the last 50 app log
lines so the actual reason is visible.

### If the app won't load

Run `./scripts/dev-doctor.sh` **first**. It will either confirm the app is
healthy with a real URL, or print the exact last 50 log lines showing why
not. Do not rely on any third-party preview/proxy URL to diagnose failures —
they only show a generic gateway error with no useful information.

Common startup failures are loud by design: missing required env vars print
`[startup] FATAL: missing required env var …` and the process exits; an
unreachable database prints `[startup] FATAL: cannot reach database — …`;
a schema that can't be applied stops the container in the entrypoint.

### Required env vars (local dev)

| Var | Local value |
| --- | --- |
| `DATABASE_URL` | `postgresql://snackpod:snackpod@localhost:5432/snackpod` (docker-compose `db`) |
| `APP_ORIGIN` | `http://localhost:3000` |
| `JWT_ACCESS_SECRET` | ≥32 random chars (generate: `openssl rand -hex 32`) |
| `JWT_RESET_SECRET` | ≥32 random chars |

Optional: Google OAuth, Stripe, Twilio, Resend, Sentry, Redis — see
`.env.example` for the full list with comments, and `DEPLOYMENT.md` for
production setup.

Seed accounts (dev only): `super_admin@snackpod.local / SuperAdmin@123!`,
`branch_admin@snackpod.local / BranchAdmin@123!`,
`customer@snackpod.local / Customer@123!`.

## Useful scripts

- `./scripts/dev-doctor.sh` — **the** health check: build + start + verify `/api/health`
- `bun run dev` — Next.js dev server on port 3000 (binds 0.0.0.0; honors `$PORT`)
- `bun run build` / `bun run start` — production build / server
- `bun run type-check` — TypeScript check (`tsc --noEmit`)
- `bun test` — unit tests (coupon pricing, order state machine)
- `bun run lint` / `bun run format` — ESLint / Prettier

## Deployment & operations

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — the operational manual: managed
Postgres, secrets, Stripe webhooks, Sentry, uptime monitoring, CI/CD, rollback,
and the fresh-deploy checklist. Self-hosting ships a `Dockerfile`,
`docker-compose.yml`, and a GitHub Actions pipeline (GHCR image on merge to
`main`).

## Project layout

```
src/
├── app/            # App Router pages + API routes (src/app/api)
├── components/     # Shared UI (header, footer, cart drawer, dish cards…)
└── lib/            # Auth, cart, catalog, coupons, orders, payments, notifications
prisma/             # Schema, migrations, seed script
scripts/            # Docker entrypoint, image tooling
.github/workflows/  # CI (typecheck + tests + build on Postgres) and deploy
```
