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

Prereqs: Docker, Node.js 22, and pnpm 11.

```bash
cp .env.example .env.local      # then fill in real values (see below)
pnpm install                    # installs locked deps + runs `prisma generate`
./scripts/dev-doctor.sh         # builds the stack and verifies it is actually healthy
```

- App: http://localhost:3000 — health check: http://localhost:3000/api/health
  (returns `{"ok":true,"db":"up"}` once Postgres answers)
- Seed dev data (branches, menu, test accounts) on a fresh database:
  `pnpm exec prisma db seed`
- Browse the database: `pnpm exec prisma studio`

Compose applies checked-in PostgreSQL migrations and then starts the app in
development mode; startup stops if a migration fails. The production Docker
image uses `scripts/docker-entrypoint.sh` to apply migrations before starting
Next.js in production. Compose healthchecks gate the app on `db`/`redis` being
healthy first.

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

Common startup failures are loud by design: missing production env vars print
`[startup] FATAL: missing required production env var(s) …`; an unreachable
database prints `[startup] FATAL: cannot reach PostgreSQL — …`; a schema that
can't be applied stops the container in the entrypoint.

### Required env vars (local dev)

| Var | Local value |
| --- | --- |
| `DATABASE_URL` | `postgresql://snackpod:snackpod@localhost:5432/snackpod` (docker-compose `db`) |
| `APP_ORIGIN` | `http://localhost:3000` |
| `JWT_ACCESS_SECRET` | ≥32 random chars (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `JWT_RESET_SECRET` | A separate ≥32 random chars |

Optional: Google OAuth, Stripe, Twilio, Resend, Sentry, Redis — see
`.env.example` for the full list with comments, and `DEPLOYMENT.md` for
production setup.

Seed accounts (dev only): `super_admin@snackpod.local / SuperAdmin@123!`,
`branch_admin@snackpod.local / BranchAdmin@123!`,
`customer@snackpod.local / Customer@123!`.

## Useful scripts

- `./scripts/dev-doctor.sh` — **the** health check: build + start + verify `/api/health`
- `pnpm dev` — Next.js dev server on port 3000 (binds 0.0.0.0)
- `pnpm build` / `pnpm start` — production build / server (start honors `PORT`)
- `pnpm type-check` — TypeScript check (`tsc --noEmit`)
- `pnpm test` — unit tests
- `pnpm format` — Prettier

For production-like response times, use `pnpm build` followed by
`pnpm start`; the development server compiles routes on demand. The
development component tagger is disabled by default to reduce compile
overhead; set `ENABLE_COMPONENT_TAGGER=true` when you need it.

## Deployment & operations

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the Hostinger Cloud Node.js
deployment steps, PostgreSQL setup, required secrets, first-admin bootstrap,
payments, backups, and post-deploy checks. A `Dockerfile` and
`docker-compose.yml` are also included for Docker-capable hosts.

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
