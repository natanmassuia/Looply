# Looply — Restore Drill (empty-DB restore, proven)

Goal: prove that a Looply PostgreSQL backup restores into an **empty** database
and that the application **boots** against the restored data.

Scope of this drill: **PostgreSQL** (the authoritative durable state for the
app to boot). Object storage (MinIO/S3) restore is covered by
`ops/backup/restore.sh` + `verify.sh`, but is **not** exercised here because this
environment has no object storage provisioned (`mc` is not installed and no
`STORAGE_*` credentials are set). Object-storage restore must be drilled
separately on a host where MinIO/S3 is configured.

## Prerequisites

- `pg_dump`, `pg_restore`, `psql`, `createdb`, `dropdb` (PostgreSQL client ≥ 14).
- A reachable PostgreSQL cluster and a `.env` with a valid `DATABASE_URL`.
- Never print `DATABASE_URL` or any secret. The steps below read the password
  from `.env` into `PGPASSWORD` without echoing it.

## Step-by-step (copy/paste)

```bash
cd ~/looply
set -a; source .env; set +a                      # load config (no echo)

# Parse DATABASE_URL into parts without printing it.
URL="${DATABASE_URL%\"}"; URL="${URL#\"}"
rest="${URL#*://}"; creds="${rest%%@*}"; hp="${rest#*@}"; hp="${hp%%/*}"
U="${creds%%:*}"; export PGPASSWORD="${creds#*:}"
H="${hp%%:*}"; PT="${hp##*:}"; [ "$PT" = "$H" ] && PT=5432
SRC_DB="${URL##*/}"; SRC_DB="${SRC_DB%%\?*}"      # e.g. looply (prod) / looply_dev
DRILL_DB="looply_restore_drill"

# 1. Back up the source DB (custom format, pg_restore-compatible).
pg_dump -h "$H" -p "$PT" -U "$U" -Fc -f /tmp/looply.dump "$SRC_DB"

# 2. Create a NEW, EMPTY database (the restore target).
dropdb   -h "$H" -p "$PT" -U "$U" --if-exists "$DRILL_DB"
createdb -h "$H" -p "$PT" -U "$U" "$DRILL_DB"

# 3. Restore the dump into the empty DB.
pg_restore -h "$H" -p "$PT" -U "$U" -d "$DRILL_DB" --no-owner --no-privileges /tmp/looply.dump

# 4. Verify the restore (migrations applied + core rows present).
psql -h "$H" -p "$PT" -U "$U" -d "$DRILL_DB" -tA -c \
 "SELECT 'migrations='||count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL
  UNION ALL SELECT 'companies='||count(*) FROM \"Company\"
  UNION ALL SELECT 'users='||count(*) FROM \"User\"
  UNION ALL SELECT 'appointments='||count(*) FROM \"Appointment\";"

# 5. Boot the app against the restored DB (isolated port). DATABASE_URL is
#    passed to the child only; it is never printed.
RESTORED_URL="${URL/$SRC_DB/$DRILL_DB}"
DATABASE_URL="$RESTORED_URL" PORT=4999 npm --prefix backend run dev &

# 6. Prove it is up and talks to the restored data.
curl -s http://localhost:4999/health                      # -> {"status":"ok",...,"db":"configured"}
curl -s -X POST http://localhost:4999/api/auth/login \
  -H "content-type: application/json" -H "Origin: $CORS_ORIGIN" \
  -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"$SEED_ADMIN_PASSWORD\"}"

# 7. Tear down.
kill %1 2>/dev/null
dropdb -h "$H" -p "$PT" -U "$U" --if-exists "$DRILL_DB"
```

> Restoring over the **active** database is never the default. For a real
> recovery onto an existing DB, use `ops/backup/restore.sh` with
> `RESTORE_DB_TARGET=<db> FORCE_DESTRUCTIVE=yes` (see `ops/backup/README.md`).

## Proven result (2026-10-26, dev cluster `looply_dev`)

| Step | Evidence |
|------|----------|
| Empty target before restore | `SELECT … FROM "Company"` → `ERROR: relation "Company" does not exist` |
| `pg_restore` into empty DB | completed with no errors (dump 81,365 bytes) |
| Verify restored rows | `migrations=21`, `companies=2`, `users=3`, `appointments=3` |
| App boots on restored DB | `GET /health` → `200 {"status":"ok","service":"looply-backend","db":"configured"}` |
| App reads restored data | `POST /api/auth/login` (seed admin) → `200`, `user.email=admin@looply.dev` |
| Teardown | drill DB dropped |

**Conclusion:** a Looply Postgres backup restores into an empty database and the
backend boots and serves authenticated, data-backed requests against it.

## Still open (not covered by this drill)

- Object-storage (MinIO/S3) restore + `verify.sh` on a storage-provisioned host.
- A proven **off-host** copy (`BACKUP_REMOTE_TARGET`) — see `ops/backup/README.md`
  (`OFF_HOST_COPY_PROVEN: NO`).
- Production (`/opt/looply`) is a separate cluster; run this drill there before
  relying on it for prod recovery.
