#!/usr/bin/env bash
# /opt/fincontrol/scripts/backup.sh
# Nightly Mongo backup. Add to crontab: 0 4 * * * /opt/fincontrol/scripts/backup.sh

set -euo pipefail

APP_DIR=/opt/fincontrol
BACKUP_DIR="$APP_DIR/backups"
TS=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Load env
set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env.production"
set +a

: "${MONGO_CONTAINER:?MONGO_CONTAINER not set in .env.production}"
: "${MONGO_URL:?MONGO_URL not set in .env.production}"
: "${DB_NAME:?DB_NAME not set in .env.production}"

TMP_IN_CONTAINER="/tmp/fincontrol_${TS}.gz"

docker exec "$MONGO_CONTAINER" mongodump \
  --uri "$MONGO_URL" \
  --db "$DB_NAME" \
  --archive="$TMP_IN_CONTAINER" \
  --gzip

docker cp "$MONGO_CONTAINER:$TMP_IN_CONTAINER" "$BACKUP_DIR/"
docker exec "$MONGO_CONTAINER" rm -f "$TMP_IN_CONTAINER"

# Retain last 30 days
find "$BACKUP_DIR" -type f -name "fincontrol_*.gz" -mtime +30 -delete

echo "✓ Backup: $BACKUP_DIR/fincontrol_${TS}.gz"
