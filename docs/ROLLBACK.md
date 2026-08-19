# Rollback Guide — Snack-Pod

Steps to roll back a bad deploy and verify the rollback succeeded.

---

## 1. Freebuff-managed hosting

Freebuff keeps prior deployments. To roll back:

1. Open the Freebuff dashboard → Deployments tab.
2. Find the last known-good deployment (before the broken one).
3. Click **Redeploy** on that deployment.
4. Wait for readiness: `freebuff-deploy status` should show `ready`.
5. Verify: `GET /api/health` → `200 {ok:true, db:'up'}`.

## 2. Docker / GHCR (self-hosted)

Images are tagged with both `latest` and the commit SHA.

```bash
# Roll back to the previous known-good SHA:
docker pull ghcr.io/<owner>/<repo>:<previous-sha>
docker stop snackpod
docker run -d --name snackpod \
  -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e JWT_ACCESS_SECRET="..." \
  -e JWT_RESET_SECRET="..." \
  -e APP_ORIGIN="..." \
  ghcr.io/<owner>/<repo>:<previous-sha>
```

## 3. Database migration considerations

**Additive-only migrations (safe):** All migrations through Phase 14 are
additive — new columns with defaults, new indexes, new tables. These do NOT
require rollback because the old code ignores columns it doesn't know about.

**Future non-additive migrations:** If a migration ever drops a column, renames
a table, or changes a column type:

1. **Never roll back the database schema.** Roll back the application code only.
2. If the new code requires the new schema and the old code requires the old
   schema, you must maintain backward compatibility in the migration (e.g.,
   keep the old column, add the new one, deploy code that reads both, then
   drop the old column in a later migration).
3. In an emergency, restore from the most recent Postgres backup (Neon supports
   point-in-time restore; Supabase supports PITR on Pro plans).

## 4. Verify rollback succeeded

After rolling back, check these endpoints:

| Check | Expected | Command |
|-------|----------|---------|
| Health | `200 {ok:true, db:'up'}` | `curl -s https://<host>/api/health` |
| Auth | Login works | Sign in via the app |
| Menu | Items load | Browse `/menu` |
| Admin | Admin portal loads | Sign in at `/admin` |
| Sentry | No new errors | Check Sentry dashboard |

## 5. Post-rollback

1. Investigate the root cause in the rolled-back deployment's logs.
2. Fix the issue on a branch, test thoroughly.
3. Deploy the fix as a new deployment (not a re-rollback).
