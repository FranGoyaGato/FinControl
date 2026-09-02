#!/usr/bin/env bash
# /opt/fincontrol/scripts/deploy.sh
# Called by GitHub Actions AND by the operator manually.
# Pulls latest main, rebuilds, health-checks, and rolls back automatically on failure.

set -euo pipefail

APP_DIR=/opt/fincontrol
cd "$APP_DIR"

if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "!! Missing $APP_DIR/.env.production — copy .env.example and fill it in."
  exit 1
fi

PREVIOUS=$(git rev-parse HEAD)
echo "==> Current commit: $PREVIOUS"

echo "==> Fetching latest main"
git fetch --all --prune
git reset --hard origin/main
NEW=$(git rev-parse HEAD)
echo "==> New commit: $NEW"

if [ "$PREVIOUS" = "$NEW" ]; then
  echo "==> Nothing to deploy (already up to date). Still ensuring containers are up."
fi

echo "==> Building images"
docker compose --env-file .env.production build --pull

echo "==> Rolling containers"
docker compose --env-file .env.production up -d --remove-orphans

echo "==> Health-checking backend (max 90 s)"
READY=0
for i in $(seq 1 30); do
  STATUS=$(docker exec fincontrol-backend curl -s -o /dev/null -w "%{http_code}" \
    http://127.0.0.1:8001/api/auth/me 2>/dev/null || echo "000")
  # 401 is the expected response for /me without a token — the app IS up.
  # 200 also fine (unlikely without token). Anything else = not ready yet.
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
    READY=1
    break
  fi
  sleep 3
done

if [ "$READY" != "1" ]; then
  echo "!! Backend did not come up. Rolling back to $PREVIOUS"
  git reset --hard "$PREVIOUS"
  docker compose --env-file .env.production build --pull
  docker compose --env-file .env.production up -d --remove-orphans
  echo "!! Rollback complete — deploy FAILED."
  exit 1
fi

echo "==> Pruning old images"
docker image prune -f >/dev/null

echo "==> State:"
docker compose --env-file .env.production ps

echo "✓ Deploy OK — $NEW"
