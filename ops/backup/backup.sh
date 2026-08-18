#!/usr/bin/env bash
# Looply V1 — Backup (R2.1)
# Backs up the durable application state: PostgreSQL (pg_dump custom) + object
# storage (MinIO/S3 via mc mirror) into a timestamped, checksummed, gitignored
# directory under $BACKUP_DIR (default <repo>/.backups).
#
# Reads credentials from the repo .env (existing convention). Never prints
# credentials. Fail-fast. No overwrite of a previous backup set.
#
# Usage:
#   BACKUP_DIR=/path/to/backups ops/backup/backup.sh
# Optional: BACKUP_REMOTE_TARGET (rsync-style host:path) for an off-host copy.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/.backups}"
REMOTE_TARGET="${BACKUP_REMOTE_TARGET:-}"

# Load repo .env (existing config convention). Non-secret use only.
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

# ── Required config ──────────────────────────────────────────────────────
: "${DATABASE_URL:?DATABASE_URL required in .env}"
: "${STORAGE_ENDPOINT:?STORAGE_ENDPOINT required}"
: "${STORAGE_BUCKET:?STORAGE_BUCKET required}"
: "${STORAGE_ACCESS_KEY:?STORAGE_ACCESS_KEY required}"
: "${STORAGE_SECRET_KEY:?STORAGE_SECRET_KEY required}"

# ── Parse DATABASE_URL (postgresql://user:pass@host:port/db) ─────────────
DB_URI="${DATABASE_URL#*://}"
DB_CREDS="${DB_URI%%@*}"
DB_HOSTPORT="${DB_URI#*@}"
DB_HOSTPORT="${DB_HOSTPORT%%/*}"
DB_NAME="${DB_URI##*/}"
DB_NAME="${DB_NAME%%\?*}"
DB_USER="${DB_CREDS%%:*}"
DB_PASS="${DB_CREDS#*:}"
DB_HOST="${DB_HOSTPORT%%:*}"
DB_PORT="${DB_HOSTPORT##*:}"
# Handle port-less / IPv6-less form defensively.
if [[ "$DB_PORT" == "$DB_HOST" ]]; then DB_PORT="5432"; fi

: "${DB_NAME:?could not parse database name from DATABASE_URL}"
: "${DB_USER:?could not parse database user from DATABASE_URL}"
: "${DB_HOST:?could not parse database host from DATABASE_URL}"

# ── Backup dir + timestamp ───────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true
umask 077
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/$TS"
if [[ -e "$DEST" ]]; then
  echo "ERROR: destination already exists: $DEST" >&2
  exit 1
fi
mkdir -p "$DEST/objects"

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")"

# ── Postgres dump (custom format, pg_restore-compatible) ─────────────────
echo ">> Postgres dump ($DB_NAME)..."
PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
  -Fc -f "$DEST/postgres.dump" "$DB_NAME"
( cd "$DEST" && sha256sum postgres.dump > postgres.dump.sha256 )
echo "   ok"

# ── Object storage mirror (MinIO/S3) ─────────────────────────────────────
echo ">> Object storage mirror ($STORAGE_BUCKET)..."
mc alias set looplybackup "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY" "$STORAGE_SECRET_KEY" >/dev/null 2>&1
mc mirror "looplybackup/$STORAGE_BUCKET" "$DEST/objects/" --overwrite --quiet
# Object listing is authoritative: a failed listing must fail the backup, while
# a successful listing of an empty bucket yields 0 objects (valid, not an error).
if ! mc ls --recursive "looplybackup/$STORAGE_BUCKET" > "$DEST/objects/manifest.txt" 2>/dev/null; then
  echo "ERROR: failed to list object bucket '$STORAGE_BUCKET'" >&2
  exit 1
fi
OBJECT_COUNT="$(wc -l < "$DEST/objects/manifest.txt")"
# Per-object sha256 for integrity verification. Exclude the bookkeeping files
# (manifest.txt and objects.sha256 itself) so the checksum set is stable.
# Checksum enumeration is authoritative: a failure must fail the backup (set -o
# pipefail makes any pipeline member failure propagate).
find "$DEST/objects" -type f ! -name manifest.txt ! -name objects.sha256 -print0 \
  | xargs -0 -r sha256sum > "$DEST/objects/objects.sha256"
echo "   ok ($OBJECT_COUNT objects)"

# ── Manifest (non-secret metadata only) ──────────────────────────────────
DB_SHA="$(cut -d' ' -f1 "$DEST/postgres.dump.sha256")"
cat > "$DEST/manifest.json" <<EOF
{
  "backup_version": 1,
  "created_at_utc": "$TS",
  "git_sha": "$GIT_SHA",
  "database": {
    "name": "$DB_NAME",
    "backup_file": "postgres.dump",
    "checksum_sha256": "$DB_SHA",
    "format": "custom"
  },
  "object_storage": {
    "endpoint": "$STORAGE_ENDPOINT",
    "bucket": "$STORAGE_BUCKET",
    "backup_path": "objects/",
    "object_count": $OBJECT_COUNT,
    "checksum_file": "objects/objects.sha256"
  },
  "schema_migrations": "prisma/_prisma_migrations"
}
EOF
( cd "$DEST" && sha256sum manifest.json > manifest.json.sha256 )

echo "Backup complete: $DEST"

# ── Off-host copy (optional) ─────────────────────────────────────────────
if [[ -n "$REMOTE_TARGET" ]]; then
  echo ">> Off-host copy -> $REMOTE_TARGET ..."
  # rsync-style remote; must fail visibly if the target is unreachable.
  if command -v rsync >/dev/null 2>&1; then
    rsync -az --timeout=60 "$DEST/" "$REMOTE_TARGET/$TS/" >/dev/null
    echo "   ok"
  else
    echo "ERROR: BACKUP_REMOTE_TARGET set but rsync not available" >&2
    exit 1
  fi
fi

echo "Done."
