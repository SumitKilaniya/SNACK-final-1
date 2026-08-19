# Run Doc — Snack-Pod (QSR Order)

Next.js 15.5 App Router project (TypeScript, React 19, Tailwind 3, Prisma/SQLite).
Package manager is **bun** (`bun.lock` is committed). Dev/prod servers bind to
`0.0.0.0` and honor `$PORT` with a 3000 default (see `package.json` scripts).

## 1. Preview commands (registered via freebuff-preview)

- Install: `bun install` (the `postinstall` hook runs `prisma generate`)
- Dev/preview: `bun run dev` → `next dev -p ${PORT:-3000} -H 0.0.0.0`, port 3000
- Build: `bun run build` → `next build`

## 2. Environment

The app is sandbox-friendly and boots with **zero env vars**:

- `DATABASE_URL` unset → falls back to SQLite `file:./dev.db`
  (`src/lib/auth/prisma.ts`). Prisma resolves the relative path against
  `prisma/schema.prisma`, so the dev DB lives at `prisma/dev.db` (gitignored).
- `JWT_ACCESS_SECRET` / `JWT_RESET_SECRET` unset → dev-only fallbacks are used
  when `NODE_ENV !== 'production'` (`src/lib/auth/jwt.ts`). Real secrets are
  required for any non-sandbox environment.
- `APP_ORIGIN` unset → falls back to `http://localhost:3000`.

Optional keys for full functionality (see `DEPLOYMENT.md`): Google OAuth
(`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_STATE_SIGNING_KEY`),
Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), Twilio SMS
(`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`), Resend email
(`RESEND_API_KEY`), Sentry (`SENTRY_DSN`), Redis (`REDIS_URL`), UptimeRobot
(`UPTIMEROBOT_API_KEY`).

## 3. Preparing the dev database

First run only (or after deleting `prisma/dev.db`):

```bash
DATABASE_URL=file:./dev.db bunx prisma db push
DATABASE_URL=file:./dev.db bunx prisma db seed
```

Seed accounts (dev only): `super_admin@snackpod.local / SuperAdmin@123!`,
`branch_admin@snackpod.local / BranchAdmin@123!`, `customer@snackpod.local / Customer@123!`.
