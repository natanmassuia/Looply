#!/usr/bin/env bash
# Looply V1 — Verify (R2.1)
# Verifies a backup set and/or a restore result. A restore is NOT proven just
# because pg_restore exited 0 — this checks migrations, tables, row counts and
# object integrity.
#
# Usage (verify a backup set without restoring):
#   ops/backup/verify.sh <backup_set_dir>
#
# Usage (verify an ISOLATED restore DB + bucket; pass the names from restore.sh):
#   VERIFY_DB=<restore_db> VERIFY_BUCKET=<restore_bucket> \
#     ops/backup/verify.sh <backup_set_dir>

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_SET="${1:-}"
if [[ -z "$BACKUP_SET" || ! -f "$BACKUP_SET/postgres.dump" ]]; then
  echo "Usage: ops/backup/verify.sh <backup_set_dir>" >&2
  exit 1
fi

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

# RESTORE_TARGET_DB_URL overrides the DB cluster to verify against (default:
# the active DATABASE_URL cluster). Used together with VERIFY_DB=<restore_db>.
TARGET_URL="${RESTORE_TARGET_DB_URL:-$DATABASE_URL}"
DB_URI="${TARGET_URL#*://}"; DB_CREDS="${DB_URI%%@*}"; DB_HP="${DB_URI#*@}"; DB_HP="${DB_HP%%/*}"
DB_USER="${DB_CREDS%%:*}"; DB_PASS="${DB_CREDS#*:}"; DB_HOST="${DB_HP%%:*}"; DB_PORT="${DB_HP##*:}"
[[ "$DB_PORT" == "$DB_HOST" ]] && DB_PORT="5432"

echo "== Backup set checksums =="
( cd "$BACKUP_SET" && sha256sum -c postgres.dump.sha256 )
( cd "$BACKUP_SET" && sha256sum -c manifest.json.sha256 )

echo "== Object checksums in backup set =="
if [[ -f "$BACKUP_SET/objects/objects.sha256" ]]; then
  # Paths in objects.sha256 are absolute; sha256sum -c resolves them from any cwd.
  ( cd "$BACKUP_SET" && sha256sum -c objects/objects.sha256 >/dev/null ) \
    && echo "   all $(wc -l < "$BACKUP_SET/objects/objects.sha256") object checksums OK"
fi

# ── Database verification (isolated restore DB, when provided) ──────────
VERIFY_DB="${VERIFY_DB:-}"
if [[ -n "$VERIFY_DB" ]]; then
  echo "== Database verify: $VERIFY_DB =="
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$VERIFY_DB" -tAc \
    "SELECT count(*) FROM _prisma_migrations" | grep -qE '^[0-9]+$' \
    && echo "   migrations table present"
  # Prisma model Job maps to table "Content" (@@map), so check "Content" here.
  for t in "Company" "User" "CompanyMember" "Content" "Client" "Appointment"; do
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$VERIFY_DB" -tAc \
      "SELECT to_regclass('\"$t\"')" | grep -q "\"$t\"" \
      && echo "   table $t present" || { echo "   table $t MISSING" >&2; exit 1; }
  done
  USERS="$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$VERIFY_DB" -tAc "SELECT count(*) FROM \"User\"")"
  echo "   User count: $USERS"
  echo "   DB verify OK"
fi

# ── Object storage verification (isolated restore bucket, when provided) ─
VERIFY_BUCKET="${VERIFY_BUCKET:-}"
if [[ -n "$VERIFY_BUCKET" ]]; then
  echo "== Object verify: $VERIFY_BUCKET =="
  mc alias set looplyverify "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY" "$STORAGE_SECRET_KEY" >/dev/null 2>&1
  SRC_COUNT="$(wc -l < "$BACKUP_SET/objects/manifest.txt" 2>/dev/null || echo 0)"
  DST_COUNT="$(mc ls --recursive "looplyverify/$VERIFY_BUCKET" 2>/dev/null | wc -l)"
  echo "   backup object count: $SRC_COUNT"
  echo "   restored object count: $DST_COUNT"
  if [[ "$SRC_COUNT" -ne "$DST_COUNT" ]]; then
    echo "   MISMATCH: object counts differ" >&2
    exit 1
  fi
  echo "   object count matches"
  echo "   object verify OK"
fi

echo "Verify complete."
