# Pending Keys — features built but inactive until a key is added

A single, running checklist of every Snack-Pod feature that is fully built in
code but switched off because a real API key/credential hasn't been provided
yet. Add the keys (Freebuff Keys/API-keys tab, or production env vars) and the
feature lights up — no code changes needed.

**How to use:** tick a box when the key(s) are added and the feature is
verified working. This is the single source of truth for "what to add before
this is fully live." The exact var names for each feature are listed inline
below; the boot-time validation that warns about these lives in
`src/lib/env.ts`.

**Last updated:** Phase 14 (launch readiness audit)

---

## Required for basic operation

- [ ] **Database (Postgres)** — needs `DATABASE_URL`. Currently: the seed
      script creates a branch, menu items, and admin accounts. Without this,
      the app cannot start (the Docker entrypoint exits non-zero). Use a
      managed Postgres (Neon recommended — see DEPLOYMENT.md).

- [ ] **JWT secrets** — needs `JWT_ACCESS_SECRET` (≥32 random chars) and
      `JWT_RESET_SECRET` (≥32 random chars). Without these, login and
      registration fail immediately.

- [ ] **App origin** — needs `APP_ORIGIN` (e.g. `https://app.snackpod.in`).
      Used for CSRF origin checking, email links, and Stripe callback URLs.

## Auth

- [ ] **Google Sign-In** — needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
      `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Currently: the button is hidden on the
      auth page; the backend returns `GOOGLE_NOT_CONFIGURED` (503) if called
      anyway.

- [ ] **Phone OTP login (real SMS)** — needs `SMS_PROVIDER=twilio`,
      `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
      Currently: the dev provider is active — the 6-digit code is printed to
      the server log and shown on screen (`devCode`), never in production
      builds.

- [ ] **CAPTCHA on login (reCAPTCHA)** — needs `RECAPTCHA_SECRET`. Currently:
      the login route verifies a `captchaToken` when one is sent, but with no
      secret the dev provider accepts any non-empty token, and the client
      never renders a CAPTCHA widget.

## Payments

- [ ] **Card / online payments (Stripe)** — needs `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`. Currently: checkout is Cash-on-Delivery only.
      The Stripe backend (`src/lib/payments/stripe.ts`) and the
      signature-verified webhook route already exist but throw
      `PAYMENT_NOT_CONFIGURED` until the keys are set.

## Notifications / observability

- [ ] **Transactional email (Resend)** — needs `EMAIL_PROVIDER=resend`,
      `RESEND_API_KEY` (optional `RESEND_FROM`). Currently: order-status
      emails are printed to the server log by the console provider instead of
      being delivered.

- [ ] **Error monitoring (Sentry)** — needs `SENTRY_DSN`. Currently:
      `captureError` logs exceptions to the console instead of reporting them
      to Sentry. **The integration is fully wired:** `src/lib/monitoring/sentry.ts`
      lazy-initializes on first error, and `src/lib/auth/errors.ts` calls
      `captureError` for every 5xx. Set the DSN and it starts reporting
      immediately — no code changes needed.

## Infrastructure

- [ ] **Shared rate limiting (Redis)** — needs `REDIS_URL`. Currently: an
      in-process per-instance store is used — fine for a single instance, but
      set `REDIS_URL` so limits are shared across replicas/serverless
      instances.

## Media / object storage

- [ ] **Image upload to cloud storage** — needs `STORAGE_BUCKET`,
      `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`,
      `STORAGE_PUBLIC_URL_BASE`. Optional: `STORAGE_ENDPOINT` (omit for real
      AWS S3; set for Cloudflare R2 or Backblaze B2).
      Currently: the admin menu page shows a graceful fallback — a "paste an
      image URL" text input with an explanatory message. The presigned-upload
      route returns `STORAGE_NOT_CONFIGURED` (503) until the keys are set.
      **Bucket setup:** disable public listing on the bucket — only individual
      object URLs should be reachable (presigned URLs handle the rest).

## Reviews & Wishlist

No external keys required. Reviews and wishlist are fully functional with the
existing database — no third-party service dependency.

---

## Environment variable summary

| Feature | Required vars | Status without keys |
|---------|--------------|-------------------|
| Core app | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_RESET_SECRET`, `APP_ORIGIN` | App won't start / login fails |
| Google login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Button hidden, 503 if called |
| Phone OTP | `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Dev mode (code on screen) |
| CAPTCHA | `RECAPTCHA_SECRET` | Dev mode (any token accepted) |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | COD only, 503 if card used |
| Email | `EMAIL_PROVIDER`, `RESEND_API_KEY` | Console logging only |
| Sentry | `SENTRY_DSN` | Console logging only |
| Redis | `REDIS_URL` | In-process store (single instance) |
| Storage | `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL_BASE` | Paste-URL fallback, 503 |

---

_Add new entries here as later phases introduce more key-gated features._
