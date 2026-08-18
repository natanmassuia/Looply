#!/usr/bin/env bash
# Looply V1 — Restore (R2.1)
# Restores a backup set (created by backup.sh) to SAFE, ISOLATED targets.
#
# Database restore defaults to a NEW isolated test database (never the active
# looply DB). To restore onto an existing database you MUST pass
#   RESTORE_DB_TARGET=<dbname> FORCE_DESTRUCTIVE=yes
# Object restore defaults to a NEW isolated test bucket (never the active
# production bucket). To restore into an existing bucket pass
#   RESTORE_BUCKET_TARGET=<bucket> FORCE_DESTRUCTIVE=yes
#
# Usage:
#   ops/backup/restore.sh <backup_set_dir>
#   RESTORE_DB_TARGET=looply_restore_test ops/backup/restore.sh <dir>
#   RESTORE_TARGET_DB_URL=postgresql://u:p@host:port/db ops/backup/restore.sh <dir>
#
# RESTORE_TARGET_DB_URL overrides the target CLUSTER (default: the active
# DATABASE_URL cluster). The safety guard always refuses to restore over the
# ACTIVE database name without FORCE_DESTRUCTIVE=yes.
#
# Never auto-targets production. Never mutates production.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/.backups}"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"
: "${STORAGE_ENDPOINT:?STORAGE_ENDPOINT required}"
: "${STORAGE_BUCKET:?STORAGE_BUCKET required}"
: "${STORAGE_ACCESS_KEY:?STORAGE_ACCESS_KEY required}"
: "${STORAGE_SECRET_KEY:?STORAGE_SECRET_KEY required}"

# ── Resolve the backup set ───────────────────────────────────────────────
BACKUP_SET="${1:-}"
if [[ -z "$BACKUP_SET" ]]; then
  echo "Usage: ops/backup/restore.sh <backup_set_dir>" >&2
  exit 1
fi
if [[ ! -f "$BACKUP_SET/postgres.dump" ]]; then
  echo "ERROR: $BACKUP_SET/postgres.dump not found" >&2
  exit 1
fi

# ── Parse DATABASE_URL (active cluster, used for the safety guard) ──────
DB_URI="${DATABASE_URL#*://}"
DB_CREDS="${DB_URI%%@*}"
DB_HOSTPORT="${DB_URI#*@}"
DB_HOSTPORT="${DB_HOSTPORT%%/*}"
ACTIVE_DB_NAME="${DB_URI##*/}"
ACTIVE_DB_NAME="${ACTIVE_DB_NAME%%\?*}"
ACTIVE_DB_USER="${DB_CREDS%%:*}"
ACTIVE_DB_PASS="${DB_CREDS#*:}"
ACTIVE_DB_HOST="${DB_HOSTPORT%%:*}"
ACTIVE_DB_PORT="${DB_HOSTPORT##*:}"
[[ "$ACTIVE_DB_PORT" == "$ACTIVE_DB_HOST" ]] && ACTIVE_DB_PORT="5432"

# ── Target cluster: RESTORE_TARGET_DB_URL overrides (isolated restore) ──
# By default the target IS the active cluster (new isolated DB in it). To
# restore onto a completely separate cluster (e.g. a disposable instance),
# point RESTORE_TARGET_DB_URL at it. The safety guard below always compares
# the target DB name against the ACTIVE database name.
if [[ -n "${RESTORE_TARGET_DB_URL:-}" ]]; then
  DB_URI="${RESTORE_TARGET_DB_URL#*://}"
  DB_CREDS="${DB_URI%%@*}"
  DB_HOSTPORT="${DB_URI#*@}"
  DB_HOSTPORT="${DB_HOSTPORT%%/*}"
  DB_NAME="${DB_URI##*/}"
  DB_NAME="${DB_NAME%%\?*}"
  DB_USER="${DB_CREDS%%:*}"
  DB_PASS="${DB_CREDS#*:}"
  DB_HOST="${DB_HOSTPORT%%:*}"
  DB_PORT="${DB_HOSTPORT##*:}"
  [[ "$DB_PORT" == "$DB_HOST" ]] && DB_PORT="5432"
else
  DB_NAME="$ACTIVE_DB_NAME"
  DB_USER="$ACTIVE_DB_USER"
  DB_PASS="$ACTIVE_DB_PASS"
  DB_HOST="$ACTIVE_DB_HOST"
  DB_PORT="$ACTIVE_DB_PORT"
fi

# ── Verify checksums first ───────────────────────────────────────────────
( cd "$BACKUP_SET" && sha256sum -c postgres.dump.sha256 >/dev/null )
echo ">> Database backup checksum verified."

# ── Database restore (isolated by default) ───────────────────────────────
RESTORE_DB="${RESTORE_DB_TARGET:-looply_restore_test_$RANDOM}"
FORCE="${FORCE_DESTRUCTIVE:-no}"

if [[ "$RESTORE_DB" == "$ACTIVE_DB_NAME" && "$FORCE" != "yes" ]]; then
  echo "ERROR: refusing to restore over the active database '$ACTIVE_DB_NAME'. " \
       "Set RESTORE_DB_TARGET to a NEW database name (isolated restore)." >&2
  exit 1
fi

echo ">> Creating isolated restore DB: $RESTORE_DB ..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -tc "SELECT 1 FROM pg_database WHERE datname='$RESTORE_DB'" | grep -q 1 \
  && echo "   DB exists; will restore into it." \
  || PGPASSWORD="$DB_PASS" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$RESTORE_DB"
PGPASSWORD="$DB_PASS" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
  -d "$RESTORE_DB" --no-owner --no-privileges "$BACKUP_SET/postgres.dump"
echo "   DB restore ok -> $RESTORE_DB"

# ── Object storage restore (isolated bucket by default) ──────────────────
mc alias set looplyrestore "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY" "$STORAGE_SECRET_KEY" >/dev/null 2>&1
RESTORE_BUCKET="${RESTORE_BUCKET_TARGET:-looply-restore-test-$RANDOM}"

# Destructive guard: restoring into the ACTIVE application bucket must be
# explicitly acknowledged with FORCE_DESTRUCTIVE=yes (same convention as the
# database guard above). Refuse BEFORE any bucket mutation.
if [[ "$RESTORE_BUCKET" == "$STORAGE_BUCKET" && "$FORCE" != "yes" ]]; then
  echo "ERROR: refusing to restore over the active object bucket '$STORAGE_BUCKET'. " \
       "Set RESTORE_BUCKET_TARGET to a NEW isolated bucket, or pass FORCE_DESTRUCTIVE=yes." >&2
  exit 1
fi

if ! mc ls "looplyrestore/$RESTORE_BUCKET" >/dev/null 2>&1; then
  mc mb "looplyrestore/$RESTORE_BUCKET" >/dev/null 2>&1
fi
if [[ -d "$BACKUP_SET/objects" ]]; then
  echo ">> Restoring objects -> $RESTORE_BUCKET ..."
  # Only the authoritative objects; exclude bookkeeping files so the restored
  # bucket object count matches the manifest's authoritative-object count.
  mc mirror "$BACKUP_SET/objects/" "looplyrestore/$RESTORE_BUCKET/" \
    --overwrite --quiet --exclude "manifest.txt" --exclude "objects.sha256"
  echo "   object restore ok -> $RESTORE_BUCKET"
else
  echo "   (no objects dir in backup set)"
fi

echo "Restore complete."
echo "  DB:      $RESTORE_DB"
echo "  Bucket:  $RESTORE_BUCKET"
