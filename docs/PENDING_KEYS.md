# Pending Keys — features built but inactive until a key is added

A single, running checklist of every Snack-Pod feature that is fully built in
code but switched off because a real API key/credential hasn't been provided
yet. Add the keys (Freebuff Keys/API-keys tab, or production env vars) and the
feature lights up — no code changes needed.

**How to use:** tick a box when the key(s) are added and the feature is
verified working. Keep this list accurate and complete after every phase —
it is the deliverable behind "when all phases are done, I should only need to
add keys". The exact var names for each feature are listed inline below (and
in the env-var table in `DEPLOYMENT.md`); the boot-time validation that warns
about these lives in `src/lib/env.ts`.

---

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
      never renders a CAPTCHA widget (deferred to a later phase).

## Payments

- [ ] **Card / online payments (Stripe)** — needs `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`. Currently: checkout is Cash-on-Delivery only.
      The Stripe backend (`src/lib/payments/stripe.ts`) and the
      signature-verified webhook route already exist but throw
      `PAYMENT_NOT_CONFIGURED` until the keys are set. No Stripe UI is wired
      yet — planned as its own dedicated phase.

## Notifications / observability

- [ ] **Transactional email (Resend)** — needs `EMAIL_PROVIDER=resend`,
      `RESEND_API_KEY` (optional `RESEND_FROM`). Currently: order-status
      emails are printed to the server log by the console provider instead of
      being delivered.

- [ ] **Error monitoring (Sentry)** — needs `SENTRY_DSN`. Currently:
      `captureError` logs exceptions to the console instead of reporting them
      to Sentry (integration is wired at the API error choke point, inert
      until set).

## Infrastructure

- [ ] **Shared rate limiting (Redis)** — needs `REDIS_URL`. Currently: an
      in-process per-instance store is used — fine for a single instance, but
      set `REDIS_URL` so limits are shared across replicas/serverless
      instances.

## Media / object storage (Phase 8)

- [ ] **Image upload to cloud storage** — needs `STORAGE_BUCKET`,
      `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`,
      `STORAGE_PUBLIC_URL_BASE`. Optional: `STORAGE_ENDPOINT` (omit for real
      AWS S3; set for Cloudflare R2 or Backblaze B2).
      Currently: the admin menu page shows a graceful fallback — a "paste an
      image URL" text input with an explanatory message. The presigned-upload
      route returns `STORAGE_NOT_CONFIGURED` (503) until the keys are set.
      **Bucket setup:** disable public listing on the bucket — only individual
      object URLs should be reachable (presigned URLs handle the rest).

## Reviews & Wishlist (Phase 6)

No external keys required. Reviews and wishlist are fully functional with the
existing database — no third-party service dependency.

---

_Add new entries here as later phases introduce more key-gated features
(e.g. payment refunds, SMS marketing, delivery-partner integrations)._
