# Looply V1 — Backup / Restore / DR (R2.1)

Minimal operational backup/restore baseline for the durable Looply state:
**PostgreSQL** + **MinIO/S3 object storage** (+ configuration recovery inventory).

## Durable-state authority

| Source | Type | Backup required |
|--------|------|-----------------|
| PostgreSQL (`looply`) | DURABLE | YES (`pg_dump` custom) |
| Object storage (`looply-media`) | DURABLE | YES (`mc mirror`) |
| Redis (idempotency TTL store) | EPHEMERAL/DERIVABLE | NO (48h `EX` transient keys only) |
| Local filesystem | DERIVABLE | NO (uploads live in object storage; `backend/uploads` is dev-only) |
| Prisma migrations | DERIVABLE | committed in repo |
| Environment/config | CONFIG | see inventory below |

## Usage

```
# Backup (timestamped set under .backups/, checksummed + manifest)
ops/backup/backup.sh

# Restore to ISOLATED test DB + test bucket (safe default)
ops/backup/restore.sh <backup_set_dir>
# then verify
VERIFY_DB=<db> VERIFY_BUCKET=<bucket> ops/backup/verify.sh <backup_set_dir>

# Verify a backup set alone
ops/backup/verify.sh <backup_set_dir>
```

Defaults: `BACKUP_DIR` = `<repo>/.backups` (gitignored), `BACKUP_REMOTE_TARGET` empty.

## Postgres backup/restore

- `pg_dump -Fc` custom format (pg_restore-compatible), timestamped, `sha256sum`.
- Restore defaults to a **new isolated test DB** (`looply_restore_test_<n>`). Overwriting the active DB requires `RESTORE_DB_TARGET=<db> FORCE_DESTRUCTIVE=yes` and is never the default.
- `verify.sh` checks `_prisma_migrations`, core tables, and row counts.

## Object storage backup/restore

- `mc mirror` preserves keys/bytes; `manifest.txt` + per-object `sha256`.
- Restore defaults to an **isolated test bucket** (`looply-restore-test-<n>`). Overwriting the production bucket requires `RESTORE_BUCKET_TARGET=<bucket> FORCE_DESTRUCTIVE=yes`.
- `verify.sh` compares object counts and checksums.

## Manifest

Each set has `manifest.json` (non-secret): backup version, UTC timestamp, git SHA, DB filename + checksum, object path/count/checksum file, migration reference. **No secrets/credentials in manifests.**

## Configuration recovery inventory

| Config | Class | Recovery dependency |
|--------|-------|---------------------|
| `DATABASE_URL` | REQUIRED_FOR_RECOVERY | external secret store / manual |
| `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | REQUIRED_FOR_RECOVERY | external secret store / manual |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_APP_SECRET` / `WHATSAPP_VERIFY_TOKEN` | REQUIRED_FOR_RECOVERY | Meta portal / external |
| `GUPSHUP_API_KEY` | REQUIRED_FOR_RECOVERY | Gupshup portal / external |
| `RESEND_FROM` / `RESEND_REPLY_TO` (mail key if set) | REQUIRED_FOR_RECOVERY | external |
| `ASSISTANT_LLM_API_KEY` | REQUIRED_FOR_RECOVERY | external |
| `SESSION`/cookie secret | REGENERABLE (opaque random token, no JWT secret) | — |
| `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `PUBLIC_APP_URL`, `FRONTEND_URL`, `STORAGE_ENDPOINT/BUCKET/REGION`, `REDIS_URL` | NON_SECRET | `.env.example` |
| Provider webhook secrets | EXTERNAL_DEPENDENCY | Meta/Gupshup dashboards |

The only host-local config copy is `.env.backup.*` on the same host — **insufficient for DR**. Secrets must live in an external secret store or be manually re-regenerated from their provider portals.

## Off-host capability

- `BACKUP_REMOTE_TARGET` (rsync-style `host:path`) is supported and fails visibly if set but unreachable.
- `OFF_HOST_CAPABILITY: YES` (script supports it).
- `OFF_HOST_CONFIGURED: NO` / `OFF_HOST_COPY_PROVEN: NO` — no target is currently configured. **B2 stays PARTIAL until an actual off-host copy is proven.**

## Retention

- Retention is intentionally manual in this baseline (no lifecycle system). Cleanup must target only the dedicated `$BACKUP_DIR` namespace and guard against empty/root paths. A future battery may add a configurable retention-cleanup primitive.

## Restore drill (runbook)

1. `ops/backup/backup.sh`
2. `ops/backup/verify.sh <set>` (checksums)
3. `ops/backup/restore.sh <set>` (isolated DB + bucket)
4. `VERIFY_DB=... VERIFY_BUCKET=... ops/backup/verify.sh <set>`
5. Clean up isolated test targets.

## RPO / RTO

- `RPO_BUSINESS: UNDEFINED`, `RTO_BUSINESS: UNDEFINED` (no business commitment chosen).
- `RPO_TECHNICAL_CAPABILITY`: depends on backup cadence (backup.sh is manual/on-demand; scheduling is a future battery).
- `RTO_RESTORE_DRILL`: measured in the drill below.

## Ransomware / host-loss

- DB backup and object backup exist **on the primary host only** until an off-host target is configured. If the VM is destroyed, local `.backups` are lost with it.
- `HOST_LOSS_RECOVERY: PARTIAL` (repo is remote; migrations committed; but no proven off-host DB/object/secret backup).
- Secrets recovery depends on external provider portals/manual store.

## Migration recovery order

Restore DB → verify `_prisma_migrations` matches the backup's git SHA → deploy the matching application commit → apply only intended forward migrations. Do not auto-migrate a restored DB to HEAD unless that is the explicit scenario.

## Security

- Backups contain tenant data: `umask 077`, `chmod 700` backup dir, no credentials in logs/manifests.
- Remote copy uses rsync (over SSH by default); encryption in transit depends on the transport used (SSH).
- **Encryption at rest: NOT available** for the local backup dir (gap, reported). Use platform/OS-level encryption if required.
- Backup access is controlled by host filesystem permissions and MinIO credentials.
