# Production deployment — Hostinger Cloud

Snack-Pod is a long-running Next.js 15 Node.js application with a PostgreSQL
database. Hostinger Cloud plans and hPanel features vary: continue with this
guide only if your hPanel lets you create a **Node.js application**. If that
option is not available on your plan, deploy this repository to a Hostinger
VPS instead. Do not upload this project as a static site or PHP application.

## 1. Services and prerequisites

Before connecting the app to your public domain, provision:

- A Hostinger Cloud Node.js application with Node.js **22.x**.
- A managed PostgreSQL database, for example Neon or Supabase. Hostinger's
  MySQL database is not compatible with this Prisma schema or migration
  history. Use the provider's PostgreSQL connection string and allow access
  from the Hostinger app.
- A domain with HTTPS enabled in Hostinger.
- Resend for account/password-reset and order email, and Twilio for phone OTP.
  These delivery integrations must be configured before accepting real users.
- Optional live Stripe credentials and a webhook endpoint if enabling card
  payments. Cash on delivery does not require Stripe.

The committed Prisma migrations are PostgreSQL migrations. Do not change the
schema provider, run `prisma db push`, or run the development seed against the
production database.

## 2. Configure the Hostinger Node.js application

Connect the Git repository in hPanel and configure the application root to the
repository root. Use these commands (or the equivalent custom build/start
fields in your hPanel):

```sh
corepack enable
corepack prepare pnpm@11.18.0 --activate
pnpm install --frozen-lockfile
pnpm run build
pnpm run start
```

`pnpm run start` listens on `0.0.0.0` and respects Hostinger's assigned `PORT`.
Do not run `next dev` in production. Build with all dependencies installed;
the Prisma CLI is a production dependency because deployments apply migrations.

If the runtime log reports `Cannot find module 'react-dom/server.browser'`,
the deployed runtime dependencies are incomplete or stale. From the application
root, verify `node -e "require.resolve('react-dom/server.browser')"` succeeds.
If it does not, clear Hostinger's build/dependency cache, reinstall with the
locked pnpm command above, and rebuild; do not copy a local `node_modules` or
`.next` directory into the deployment.

Add the environment variables in the Hostinger app's environment/secret
settings, not in source control. Ensure `NEXT_PUBLIC_SITE_URL` is available
during the build because Next.js uses it for generated metadata. Set the same
values for the running app:

| Variable | Required value |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | HTTPS origin, e.g. `https://snackpod.example` (no trailing slash/path) |
| `NEXT_PUBLIC_SITE_URL` | The public HTTPS origin, e.g. `https://snackpod.example` |
| `DATABASE_URL` | PostgreSQL connection string for the production database |
| `JWT_ACCESS_SECRET` | Unique random secret, at least 32 characters |
| `JWT_RESET_SECRET` | A different unique random secret, at least 32 characters |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | Resend production API key |
| `RESEND_FROM` | Verified sender, e.g. `Snack-Pod <orders@yourdomain>` |
| `SMS_PROVIDER` | `twilio` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM` or `TWILIO_PHONE_NUMBER` | Twilio-enabled sender number |

Generate each JWT secret independently. For example, run this twice in a
trusted terminal and store the two outputs directly in Hostinger's secret
settings:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not use the development credentials in `.env.example`, commit live keys, or
reuse the same secrets across environments. Startup refuses to serve production
with missing/weak JWT secrets, non-PostgreSQL database URLs, non-HTTPS public
origins, or an unreachable database. HTTP is allowed only for localhost in
local development.

Optional integrations:

- **Google OAuth:** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; register
  `https://your-domain/api/auth/google/callback` as the OAuth redirect URI.
- **Stripe:** set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_CURRENCY`. Register
  `https://your-domain/api/payments/stripe/webhook` for the required payment
  events in Stripe. Use live credentials only after completing Stripe's
  account and payment-flow verification.
- **reCAPTCHA:** set `RECAPTCHA_SECRET` and
  `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` together to enable CAPTCHA after repeated
  failed sign-in attempts.
- **Monitoring/rate limits:** set `SENTRY_DSN` for error monitoring. Redis is
  optional for a single app instance; configure `REDIS_URL` if running multiple
  instances so rate limits are shared.

## 3. Apply database migrations and create the first administrator

After configuring the Hostinger environment and before opening the site:

1. Open the Node.js app's terminal in hPanel.
2. Run `pnpm run db:migrate:deploy`. This applies only checked-in migrations;
   if it fails, stop and correct the database connection/migration issue.
3. Create the first super-admin exactly once. Pass a unique email, name, and
   strong password as temporary terminal environment variables:

   ```sh
   NODE_ENV=production ADMIN_EMAIL=admin@yourdomain \
     ADMIN_NAME="Snack-Pod Admin" ADMIN_PASSWORD='use-a-unique-strong-password' \
     pnpm run admin:create:super-admin
   ```

   The command refuses to overwrite an existing account. Remove the temporary
   `ADMIN_PASSWORD` value from the terminal/session after it succeeds.
4. Do **not** run `pnpm exec prisma db seed` in production. The seed creates
   publicly documented development accounts and sample data; it exits without
   running when `NODE_ENV=production`.

## 4. Deploy and verify

Deploy the built Node.js app, attach the domain, enable HTTPS, then verify:

1. `https://your-domain/api/health` returns HTTP 200 and `"db":"up"`.
2. Sign in using the newly provisioned super-admin account.
3. Register a test customer and verify the Twilio OTP arrives.
4. Request a password reset and verify the email arrives.
5. Place a test cash-on-delivery order and verify customer/admin order views.
6. If Stripe is enabled, use Stripe test mode first and verify the webhook
   changes payment status; use live mode only after successful testing.
7. Check Hostinger logs for startup errors. Configure a public uptime monitor
   for `/api/health` and ensure it alerts on failure.

The app health route returns 503 if PostgreSQL is unavailable. Back up the
PostgreSQL database before deploying schema changes and enable the database
provider's automated backups/point-in-time recovery. Apply additive migrations
before shifting live traffic to code that depends on them.

## 5. Release checks

Before each production deployment, run:

```sh
pnpm install --frozen-lockfile
pnpm exec prisma validate
pnpm run type-check
pnpm test
pnpm run build
```

The build does not contact the production database or apply migrations. Never
run development seed data or destructive schema sync commands on production.
Keep the previous working deployment available for rollback, and take a
database backup before any release that changes the schema.

## 6. Docker-capable alternatives

The repository also includes a Dockerfile and a local Docker Compose stack.
The Docker image uses the same locked pnpm dependencies and checked-in
PostgreSQL migrations. Configure all production secrets at runtime; do not use
the local Compose credentials on a public server. Docker builds must receive
the public URL (and Google OAuth client ID if Google sign-in is enabled) as
build arguments because Next.js embeds `NEXT_PUBLIC_*` values in the compiled
app:

```sh
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id \
  -t snack-pod .
```

Pass database and private integration secrets only to the running container;
never use build arguments for secrets.
