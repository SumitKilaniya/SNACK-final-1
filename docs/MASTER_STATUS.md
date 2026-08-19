# Snack-Pod — Master Status Report

**Generated:** Phase 15 (final audit)
**Branch:** `phase-15-master-status`

---

## 1. Part-by-Part Status Table

| Part | Branch | Status | Notes |
|------|--------|--------|-------|
| **I** — Coupons & Branches audit | `phase-9-admin-coupons-branches-audit` | ✅ Done | All checks pass. No code changes needed. |
| **II** — Reports & Users audit | `phase-10-admin-reports-users-audit` | ✅ Done | All checks pass. Reports nav-visibility already fixed. No code changes needed. |
| **III** — Security hardening | `phase-11-security-hardening` | ✅ Done | Added `assertSameOrigin()` CSRF defense-in-depth to 31 route files. Remaining audit items (rate limiting, input validation, CSP, secrets logging, audit logs, presigned uploads) all verified correct. |
| **IV** — Test suite | `phase-12-testing` | ✅ Done | Added Playwright config + critical-path e2e test, autocannon load test script, GitHub Actions CI workflow with 5 jobs. |
| **V** — Performance pass | `phase-13-performance` | ✅ Done | Added 5-min route-segment caching to `/api/menu` and `/api/branches`. Added `orders(createdAt)` and `orders(paymentStatus)` indexes. No raw `<img>` tags found. |
| **VI** — Deployment & observability | `phase-14-launch-readiness` | ✅ Done | Created `docs/ROLLBACK.md`, updated `docs/PENDING_KEYS.md` (final), updated `DEPLOYMENT.md` with staging path. Sentry wiring verified. |
| **VII** — Final status report | `phase-15-master-status` | ✅ Done | This document. |

---

## 2. Full Contents of docs/PENDING_KEYS.md

See [PENDING_KEYS.md](./PENDING_KEYS.md) for the complete, up-to-date checklist. Summary:

### Required for basic operation
- `DATABASE_URL` — Managed Postgres (Neon recommended)
- `JWT_ACCESS_SECRET` — ≥32 random chars
- `JWT_RESET_SECRET` — ≥32 random chars
- `APP_ORIGIN` — e.g. `https://app.snackpod.in`

### Auth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google Sign-In
- `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — Phone OTP
- `RECAPTCHA_SECRET` — CAPTCHA on login

### Payments
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Card/online payments

### Notifications / observability
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` — Transactional email
- `SENTRY_DSN` — Error monitoring (integration wired, inert until set)

### Infrastructure
- `REDIS_URL` — Shared rate limiting (optional for single instance)

### Media / object storage
- `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL_BASE` — Image uploads

---

## 3. What the Human Needs to Do Next

1. **Add core secrets:** Set `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_RESET_SECRET`, `APP_ORIGIN` in the Freebuff Keys/API-keys tab (or production env vars).

2. **Deploy to staging:** Push to `main`, let GitHub Actions run CI, then deploy via Freebuff. Set staging env vars with `freebuff-deploy env set`.

3. **Run the load test:** Execute `BASE_URL=https://staging.snackpod.in TOKEN=<jwt> node scripts/load-test-checkout.js` against staging.

4. **Final manual QA pass:**
   - Sign up / sign in (email + password)
   - Browse menu, add items to cart
   - Place a COD order, verify order confirmation
   - Check order history
   - Sign in as admin (`super_admin@snackpod.local` / `SuperAdmin@123!`)
   - Create a coupon, verify it appears in the list
   - Check reports page shows data
   - Verify Sentry receives a test error

5. **Add optional keys as needed:** Google login, Stripe, Resend email, Sentry DSN, Twilio SMS, Redis, S3 storage — each is independent and the app works without them.

6. **Run the Playwright e2e test:** `bunx playwright test` against the staging URL.

---

## 4. Verification Methodology — Part by Part

### Part I — Coupons & Branches audit
**Method:** Static code reading only (no live DB/browser in sandbox).
- Read `src/app/admin/coupons/page.tsx`, `src/app/admin/branches/page.tsx`
- Read all `/api/admin/coupons/**` and `/api/admin/branches/**` route handlers
- Read `src/lib/coupons.ts` (validation logic), `src/lib/branches-context.tsx`
- Read `src/lib/auth/guard.ts` (authorization)
- Confirmed: coupon usage is snapshot (not live reference), expired/inactive visually distinct, branch toggle uses "Open/Closed" (never "Delete"), deactivating selected branch falls back gracefully, all routes properly guarded.

### Part II — Reports & Users audit
**Method:** Static code reading only.
- Read `src/app/admin/layout.tsx` (NAV_ITEMS already has BRANCH_ADMIN for Reports)
- Read `src/app/admin/reports/page.tsx` (branch selector hidden for BRANCH_ADMIN)
- Read `src/app/api/admin/reports/route.ts` (revenue = paymentStatus 'paid' only, BRANCH_ADMIN branchId forced server-side)
- Read `src/app/admin/users/page.tsx` (self-lockout guardrails in UI, branchId required for BRANCH_ADMIN)
- Read `src/app/api/admin/users/route.ts` and `[id]/route.ts` (no passwordHash in select, self-deactivate guard)
- Confirmed: all checks pass, no code changes needed.

### Part III — Security hardening
**Method:** Static code reading + code changes.
- Created `src/lib/auth/csrf.ts` with `assertSameOrigin()` utility
- Added `assertSameOrigin(req)` to 30 route files (13 consumer + 17 admin routes)
- Excluded `payments/stripe/webhook/route.ts` (Stripe signature auth)
- Verified: rate limiting present on all high-risk mutating routes, every `req.json()` followed by Zod `.parse()`, CSP `img-src` covers `https:`, no secrets in logs, all admin actions audit-logged, presigned URLs expire in 5 min with server-generated keys
- Ran `tsc -b --noEmit` — passes clean.

### Part IV — Test suite
**Method:** Code creation + tooling setup.
- Installed `@playwright/test`, created `playwright.config.ts`
- Created `e2e/critical-path.spec.ts` (register → menu → cart → checkout → history)
- Created `scripts/load-test-checkout.js` (autocannon) with staging instructions
- Created `.github/workflows/ci.yml` with 5 jobs: typecheck, unit-tests, build, e2e-tests, audit
- Existing 28 unit tests (pricing, coupons, order-transitions, rate-limit) confirmed present in `src/lib/__tests__/`

### Part V — Performance pass
**Method:** Static code reading + code changes.
- Grep for `<img src=` in TSX files — none found (all use AppImage wrapper)
- Added `export const revalidate = 300` to `/api/menu` and `/api/branches` routes
- Added `@@index([createdAt])` and `@@index([paymentStatus])` to Order model in Prisma schema
- Confirmed: checkout always recomputes from DB regardless of route caching
- Load test script created in Part IV

### Part VI — Deployment & observability
**Method:** Static code reading + documentation.
- Read `src/lib/monitoring/sentry.ts` — lazy init, gated on `SENTRY_DSN`, called from `handleError()` in `src/lib/auth/errors.ts`
- Confirmed: every 5xx from every API route triggers `captureError()`, which initializes Sentry on first call when DSN is set
- Created `docs/ROLLBACK.md` (step-by-step for Freebuff and Docker)
- Updated `docs/PENDING_KEYS.md` (final, comprehensive)
- Updated `DEPLOYMENT.md` (staging path, Phase 14 checklist)

### Part VII — Final status report
**Method:** This document.

---

## Branches Created

| Branch | Part | Changes |
|--------|------|---------|
| `phase-9-admin-coupons-branches-audit` | I | Audit only (no code changes) |
| `phase-10-admin-reports-users-audit` | II | Audit only (no code changes) |
| `phase-11-security-hardening` | III | CSRF defense-in-depth (31 files) |
| `phase-12-testing` | IV | Playwright, load test, CI workflow |
| `phase-13-performance` | V | Caching, DB indexes |
| `phase-14-launch-readiness` | VI | ROLLBACK.md, PENDING_KEYS.md, DEPLOYMENT.md |
| `phase-15-master-status` | VII | This document |
