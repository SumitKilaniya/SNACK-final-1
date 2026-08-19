#!/bin/sh
# dev-doctor.sh — THE standard way to check "is my app actually working".
#
# Usage: ./scripts/dev-doctor.sh
#   - Confirms Docker is running
#   - Builds & starts the full stack (Postgres + Redis + app)
#   - Waits up to 30s for /api/health to return 200
#   - On success prints the real URL; on failure prints the last 50 app log
#     lines so the reason is visible instead of a generic gateway error.
#
# Run this BEFORE trusting a browser preview. See README.md.

set -e

echo "== 1. Docker running? =="
docker info > /dev/null || { echo "Docker is not running."; exit 1; }

echo "== 2. Building & starting stack =="
docker compose up --build -d

echo "== 3. Waiting for health =="
for i in $(seq 1 30); do
  if curl -fs http://localhost:3000/api/health > /dev/null; then
    echo "✅ Healthy. App is up at http://localhost:3000"
    exit 0
  fi
  sleep 1
done

echo "❌ App did not become healthy in 30s. Recent logs:"
docker compose logs --tail=50 app
exit 1
