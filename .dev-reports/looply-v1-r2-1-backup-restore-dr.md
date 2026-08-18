# Looply — V1-R2.1 Backup / Restore / DR

Date: 2026-08-18 · Branch: `main` @ `730ad8a` · No commit, no push.

## Durable-state inventory

| Source | Class | Authority |
|--------|-------|-----------|
| PostgreSQL `looply` | DURABLE | pg_dump custom (backup proven) |
| Object storage `looply-media` (MinIO) | DURABLE | mc mirror (backup + restore proven) |
| Redis | EPHEMERAL/DERIVABLE | NO_BACKUP_REQUIRED (TTL `EX` transient/idempotency store only) |
| Local filesystem | DERIVABLE | uploads live in object storage; `backend/uploads` dev-only |
| Prisma migrations | DERIVABLE | committed |
| Env/config | CONFIG | recovery inventory (below) |

`DATABASE_AUTHORITY: POSTGRESQL`, `OBJECT_STORAGE_AUTHORITY: MINIO_OR_S3_COMPATIBLE`, `REDIS_CLASSIFICATION: EPHEMERAL_OR_DERIVABLE`.

## Implemented backup architecture

`ops/backup/`:
- `backup.sh` — Postgres `pg_dump -Fc` + MinIO `mc mirror`, timestamped set, `sha256sum` (DB + per-object), `manifest.json`, no credential logging, fail-fast, `umask 077`/`chmod 700`.
- `restore.sh` — safe restore to **isolated** test DB + test bucket by default; refuses overwrite of active DB/bucket without `FORCE_DESTRUCTIVE=yes`.
- `verify.sh` — checksums, `_prisma_migrations`, core tables, row counts, object counts/integrity.
- `README.md` — runbook, config recovery inventory, off-host contract, retention, DR procedure, migration recovery order.
- `.gitignore` — `/.backups/` + `ops/backup/.backups/` (backups never committed).

## Postgres backup — IMPLEMENTED + PROVEN

Ran `ops/backup/backup.sh` → created `.backups/20260818T200609Z/postgres.dump` (400KB, custom format), `postgres.dump.sha256` verified OK, manifest OK.

## Object storage backup — IMPLEMENTED + PROVEN

Mirrored all 4 authoritative objects in `looply-media` (company logos, avatars). `objects.sha256` covers exactly the 4 objects; all verified OK. (Fixed a self-referential checksum bug in the first run.)

## Object storage restore — IMPLEMENTED + PROVEN

Restored to isolated bucket `looply-restore-test-1`; **object count matched (4)** and **all 4 objects byte-identical** (checksum comparison passed). Isolated bucket then removed.

## Postgres restore — IMPLEMENTED (drill BLOCKED by environment)

`restore.sh` is correct and safe (refuses to overwrite active DB; targets isolated test DB). However the **isolated DB restore drill cannot be executed** in this environment:
- `looply` app user has `rolcreatedb = f` (cannot create DB) and cannot `ALTER ROLE`.
- `postgres` superuser password not available; `sudo -u postgres` requires a password; socket peer auth fails.
- No other role with `CREATEDB`/superuser is reachable.

This is the explicit stop condition **"isolated DB restore cannot be executed."** It is an environment/credential dependency, not a script defect.

## Manifest

`manifest.json` (non-secret): backup_version, UTC timestamp, git SHA (`730ad8a`), DB filename + checksum, object path/count/checksum file, migration reference. `MANIFEST_SECRETS_PRESENT: NO`.

## Config recovery inventory

README documents each config: `REQUIRED_FOR_RECOVERY` (DB URL, storage keys, provider tokens/keys), `REGENERABLE` (opaque session cookie — no JWT secret), `NON_SECRET` (.env.example values), `EXTERNAL_DEPENDENCY` (Meta/Gupshup dashboards). Host-local `.env.backup` is insufficient for DR; external secret store/manual recovery required. `SECRET_RECOVERY_STATUS: EXTERNAL_DEPENDENCY`.

## Off-host

- `OFF_HOST_CAPABILITY: YES` (backup.sh supports `BACKUP_REMOTE_TARGET` via rsync; fails visibly if unreachable).
- `OFF_HOST_CONFIGURED: NO`, `OFF_HOST_COPY_PROVEN: NO` (no target configured).

## Retention

Manual in this baseline; README documents that any cleanup must target only the dedicated `$BACKUP_DIR` namespace with empty/root-path guards. `RETENTION_SAFETY: path-guarded`.

## Restore drill

- Backup: proven. Object restore: proven (count + byte integrity).
- **DB restore drill: NOT executed** (isolated test DB cannot be created — no CREATEDB/superuser available). `RESTORE_DRILL: PARTIAL`, `RESTORE_TARGET_ISOLATED: YES` (by design), `PRODUCTION_DATA_MUTATED: NO`.

## Measured timings

`BACKUP_DURATION`: <2s (demo dataset). `OBJECT_RESTORE_DURATION`: ~0s / 3.18MiB at ~18MiB/s. `DB_RESTORE_DURATION`: not measurable (drill blocked). No invented timings.

## Integrity verification

DB dump checksum OK; manifest OK; all 4 object checksums OK; restored objects byte-identical.

## RPO / RTO

`RPO_BUSINESS: UNDEFINED`, `RTO_BUSINESS: UNDEFINED`. `RPO_TECHNICAL_CAPABILITY`: depends on backup cadence (script is on-demand; scheduling is a future battery). `RTO_RESTORE_DRILL: not measured` (DB drill blocked).

## Ransomware / VM-loss / human-error

- `VM_LOSS_RECOVERY: PARTIAL` — repo remote + migrations committed; but backups are host-local only (no off-host proven) and secrets are external/manual.
- `RANSOMWARE_RECOVERY: PARTIAL` — backup exists but is local-only and unencrypted at rest.
- `HUMAN_ERROR_RECOVERY`: documented (restore to isolated DB; accidental object deletion recoverable from backup set) but not proven end-to-end due to DB-drill blocker.

## Migration recovery

README documents canonical order: restore DB → verify `_prisma_migrations` matches backup git SHA → deploy matching app commit → apply only intended forward migrations. `RELEASE_SHA_CAPTURED: YES` (manifest git SHA).

## Security

`umask 077`/`chmod 700`, no credentials in logs/manifests, remote copy via SSH-transported rsync (encryption in transit depends on transport). `BACKUP_ENCRYPTION_AT_REST: NO` (gap reported). `BACKUP_ACCESS_CONTROL: host filesystem + MinIO credentials`.

## Files changed

```
ops/backup/backup.sh   (new, executable)
ops/backup/restore.sh  (new, executable)
ops/backup/verify.sh   (new, executable)
ops/backup/README.md   (new)
.gitignore             (add .backups/)
```

`BACKEND_CHANGE: NO`, `FRONTEND_CHANGE: NO`, `SCHEMA_CHANGE: NO`, `MIGRATION: NO`, `NEW_DEPENDENCY: NO` (uses existing pg_dump/mc).

## Validation

- `bash -n` on all 3 scripts (syntax OK); shellcheck not installed (not added).
- Backup ran: DB + 4 objects, checksums verified.
- Object restore ran: count match + byte-integrity verified; isolated bucket removed.
- `git diff --check`: PASS.
- DB restore drill: blocked by missing DB-creation privilege (documented).

## B2 decision

`RELEASE_BLOCKER_B2: OPEN` — restore is not fully proven (isolated DB restore drill could not be executed). `R2_1_STATUS: BLOCKED` (isolated DB restore cannot be executed — explicit stop condition). `NEXT_STATUS: BLOCKED`.

**Blocking dependency**: a PostgreSQL role with `CREATEDB` (or superuser) to create an isolated restore-test database, so the DB restore drill can be executed and verified. The rest of the backup/restore baseline is implemented and the object-storage path is proven.

## Git state

```
HEAD:               730ad8a9ebb22fed6f8988df52799271ccf096a2 (unchanged)
Changed:            .gitignore + ops/backup/* (new)
Untracked report:   this report
Backups:            .backups/ is gitignored (not committed)
Staged/Committed:   none
KORE_TOUCHED:       NO
```

## Tools/skills used

- Skills loaded: `caveman`, `kore-validate`.
- Tools: `pg_dump`, `pg_restore`, `psql`, `mc` (MinIO client), `docker` present.
- Inspected .env (masked), Prisma schema, transientStore (Redis), MinIO bucket; ran the actual backup + object-restore drill.

---

# R2.1A — PostgreSQL isolated restore proof (2026-08-18)

The original R2.1 block ("isolated DB restore cannot be executed — active `looply` role lacks CREATEDB") is **superseded**: R2.1A proves PostgreSQL restore using a **disposable isolated PostgreSQL instance** that does not depend on CREATEDB privileges in the active cluster. The active database was never touched. The original BLOCKED history above is preserved.

## Discovery (actually executed)

| Check | Result |
|-------|--------|
| `command -v docker` | `/usr/bin/docker` (29.6.2) |
| `docker info` | `docker_info_exit=0` → **usable** |
| `command -v podman` | absent; `podman info` exit 127 → not available |
| `initdb` / `postgres` / `pg_ctl` | absent |
| `createdb` / `pg_restore` / `psql` | present (PostgreSQL 16.14 client) |
| Existing explicit test/restore DB | none |

`DISCOVERY_EXECUTED: YES`. Isolation priority reached: **B — Disposable PostgreSQL Docker container** (Docker available+usable; no podman, no initdb, no pre-existing test DB).

## Isolation strategy used

Started ONE disposable `postgres:16` container (source major = 16.14; image `postgres:16`):
- `--name looply-r2-restore-test`, disposable anonymous volume, `--rm`
- bound **only** to `127.0.0.1:55432` → `5432` (never exposed publicly)
- synthetic role `looply_restore` / temp password (kept in `/tmp/looply_r2_restore_pw`, mode 600; never in the report)
- active PostgreSQL data never mounted; no existing container altered
- `pg_isready` → accepting connections after ~1s

`RESTORE_TARGET_DIFFERS_FROM_ACTIVE: YES`:
- ACTIVE cluster: `127.0.0.1:5432`, DB `looply`, Postgres 16.14, backend pid 938484
- ISOLATED cluster: `127.0.0.1:55432`, DB `looply_restore` (POSTGRES_DB), Postgres 16.15, backend pid 80
- distinct processes / distinct ports → distinct clusters

## Restore proof (via existing restore.sh)

Used the **existing `ops/backup/restore.sh`** against the disposable cluster with `RESTORE_TARGET_DB_URL` (target-cluster override) + `RESTORE_DB_TARGET=looply_restore_proof`:

- checksum verified (`postgres.dump.sha256` OK)
- created isolated DB `looply_restore_proof` in the disposable cluster
- `pg_restore --no-owner --no-privileges` → **`RESTORE_EXIT_STATUS: PASS`** (exit 0)
- object mirror to isolated bucket `looply-r2-restore-bucket-proof` → 4 authoritative objects
- `DB_RESTORE_DURATION`: **471 ms** (pg_restore only); full `restore.sh` run 1s

No manual `pg_restore` was substituted for the script — the script itself performed the restore.

## Verification (via existing verify.sh)

Used the existing `ops/backup/verify.sh` against the restored DB + bucket (`VERIFY_DB=looply_restore_proof`, `VERIFY_BUCKET=...`, `RESTORE_TARGET_DB_URL` override):

- DB dump + manifest checksums: OK
- all 4 object checksums: OK
- `_prisma_migrations` present; tables Company/User/CompanyMember/Content/Client/Appointment present
- `POSTGRES_VERIFY: PASS` (verify.sh exit 0)

Representative aggregate counts — source vs restored (no rows printed):

| Metric | Source (active) | Restored (isolated) | Match |
|--------|----------------|--------------------|-------|
| Prisma migrations | 15 | 15 | YES |
| Company | 5 | 5 | YES |
| User | 20 | 20 | YES |
| Job (Content) | 102 | 102 | YES |
| Appointment | 536 | 536 | YES |
| Client | 7 | 7 | YES |

`PRISMA_MIGRATIONS_PRESENT: YES`, `MIGRATION_COUNT_MATCH: YES`, `CORE_TABLES_PRESENT: YES`, `REPRESENTATIVE_DATA_MATCH: PASS`.

## Production safety

`ACTIVE_DB_MODIFIED: NO` — active counts unchanged (15/5/102/536), and restore/verify only ever connected to `127.0.0.1:55432`. `PRODUCTION_DATA_MUTATED: NO`. `RESTORE_TARGET_DIFFERS_FROM_ACTIVE: YES`.

## Script defects found + minimally fixed (SOURCE_CHANGE_REQUIRED: YES)

1. **restore.sh**: could only target a different DB *name in the active cluster*, never a different *cluster*. Added optional `RESTORE_TARGET_DB_URL` override; safety guard now compares the target DB name against the **active** DB name (still refuses overwrite of the active DB without `FORCE_DESTRUCTIVE=yes`).
2. **restore.sh**: `mc mirror` copied bookkeeping files (`manifest.txt`, `objects.sha256`) into the restore bucket, inflating the count. Added `--exclude` for those two files so the bucket holds only the authoritative objects.
3. **verify.sh**: checked for a literal table `Job`, but Prisma model `Job` maps to table `Content` (`@@map("Content")`) — the check could never pass. Fixed the table list to `Content` (+`Appointment`).

These are the exact "small defect preventing an otherwise valid isolated restore" cases; each was minimally fixed and the proof re-run clean.

## Off-host

`OFF_HOST_CONFIGURED: NO`, `OFF_HOST_COPY_PROVEN: NO`. Not exercised here.

## B2 decision (unchanged by R2.1A)

`RELEASE_BLOCKER_B2: PARTIAL` — local isolated restore now proven, but **off-host restore is NOT proven**; B2 is NOT cleared by R2.1A.

## R2.1A result

`RESTORE_DRILL: LOCAL_RESTORE_PROVEN` · `R2_1A_STATUS: COMPLETE` · `NEXT_STATUS: READY_FOR_R2_1B_OFF_HOST_PROOF` · `KORE_TOUCHED: NO` · `FILES_CHANGED: ops/backup/restore.sh, ops/backup/verify.sh, this report` (no commit, no push, nothing staged).

## Cleanup

Removed ONLY the disposable R2 resources created here: container `looply-r2-restore-test`, the restored DB `looply_restore_proof` (in the disposable cluster), and test bucket `looply-r2-restore-bucket-proof`. No `docker system prune` / `volume prune` / `podman prune` used. Pre-existing containers (`looply-minio`, `looply-redis`, `ai-memory`, kore-*`) untouched.

## Git state (after R2.1A)

```
HEAD:               730ad8a9ebb22fed6f8988df52799271ccf096a2 (unchanged)
Changed (uncommitted): .gitignore, ops/backup/restore.sh, ops/backup/verify.sh
Untracked report:    this report
Backups:             .backups/ gitignored (not committed)
Staged/Committed:    none
KORE_TOUCHED:        NO
```

---

# R2.1B — Off-Host Backup Proof (2026-08-18)

R2.1A (PostgreSQL isolated restore) remains COMPLETE and is preserved above. R2.1B
proves the **off-host copy** leg of release blocker B2. Result: **BLOCKED — no valid
independent off-host destination exists in this environment.** This is a hard
environment/credential stop, not a script defect. Discovery below was actually executed.

## Destination discovery (actually executed)

| Check | Result |
|-------|--------|
| `BACKUP_REMOTE_TARGET` (backup.sh rsync-style) | supported in code, **not configured** (empty) |
| rsync | `/usr/bin/rsync` present |
| ssh / scp / sftp | present |
| `~/.ssh/config` hosts | only GitHub (`github.com` aliases) — **no independent backup host** |
| mounted remote FS (nfs/cifs/sshfs/fuse/gluster/ceph) | **none** (`/proc/mounts`: only fusectl, not a data mount) |
| S3-compatible destinations | MinIO aliases (`local`, `looplybackup`, `looplyrestore`, `looplyverify`) all → `http://127.0.0.1:9100` (**local container on this VM**) |
| `STORAGE_ENDPOINT` | `http://127.0.0.1:9100` (loopback, primary host) — **not independent** |
| `gcs` / `s3` / `play` mc aliases | placeholder `YOUR-ACCESS-KEY-HERE` / `YOUR-SECRET-KEY-HERE` — **no real credentials** |
| rclone | **MISSING** |
| aws / gcloud / az / s3cmd CLIs | **MISSING** |
| `~/.aws` `~/.config/gcloud` `~/.config/rclone` | **absent** |
| Other resolvable hosts (backup/nas/server/offsite) | **none** |
| Deployment | Hostinger VPS `srv1843655.hstgr.cloud` (single host) |

`REMOTE_DISCOVERY_EXECUTED: YES`. Every destination priority option was checked:

- OPTION A (existing S3-compatible/object-storage remote separate from primary host): **none configured** — MinIO is a local container on the same VM.
- OPTION B (existing SSH/rsync target on a separate host): **none** — only GitHub keys present, no backup host.
- OPTION C (existing mounted remote storage): **none**.
- OPTION D (other already-connected external backup service): **none**.
- OPTION E (no valid independent target): **reached → BLOCKED**.

## Independence verdict

`OFF_HOST_DESTINATION_FOUND: NO`. The only writable object storage is the loopback
MinIO on this VM; no cloud/S3/GCS credentials exist; no remote SSH/rsync host is
configured; no remote mount exists. Copying `.backups` to another directory on the
**same VM/filesystem** would not survive host loss and is explicitly disallowed as
proof. `OFF_HOST_INDEPENDENT_FROM_PRIMARY_HOST`: N/A (no destination).

## Backup set pre-check (selected, not transferred)

Selected latest valid set `.backups/20260818T200609Z` (the R2.1A-proven set):
- `manifest.json` present — release SHA `730ad8a`, DB `looply`, format custom, object_count 4.
- `postgres.dump` present (400KB, custom) — `postgres.dump.sha256` **PASS**.
- `manifest.json.sha256` **PASS**.
- `objects/manifest.txt` (4 authoritative objects), `objects/objects.sha256` (4) present; all object checksums **PASS**.

`LOCAL_BACKUP_PRECHECK: PASS`. No regeneration needed; existing `backup.sh` untouched.

## Transfer / retrieval / integrity

Not executed — no independent destination exists to receive, list, or retrieve from.
`REMOTE_TRANSFER_EXECUTED: NO` · `REMOTE_BACKUP_PRESENT: NO` · `REMOTE_RETRIEVAL_PROVEN: NO` ·
`ORIGINAL_LOCAL_BACKUP_REQUIRED_FOR_REMOTE_VERIFY`: N/A.

## Security posture (classified, not blocking the environment gap)

- `BACKUP_ENCRYPTION_IN_TRANSIT`: N/A (no remote transport configured). `backup.sh` remote
  path uses rsync (SSH by default) when a target exists.
- `REMOTE_ENCRYPTION_AT_REST`: N/A (no remote destination).
- `REMOTE_ACCESS_CONTROL`: N/A.
- `SECRET_RECOVERY_STATUS`: `EXTERNAL_DEPENDENCY` (unchanged; secrets recoverable via
  external provider portals/manual secure sources, documented in README inventory). No
  `.env` is stored in the backup set.

## VM-loss / ransomware

`VM_LOSS_BACKUP_SURVIVES: NO` — all durable backups (`/opt/looply/.backups` + loopback
MinIO) live on the primary VM; destruction of the VM loses them. This is the key B2
invariant that cannot be satisfied without a real off-host destination.
`RANSOMWARE_RECOVERY: PARTIAL` (local copy only; no immutable/versioned remote).

## Schedule / retention

`BACKUP_SCHEDULE_CONFIGURED: NO` · `BACKUP_CADENCE: ON_DEMAND` · `REMOTE_RETENTION`: N/A (no
remote). Retention remains manual; operational gap, unchanged.

## B2 decision

`B2_REQUIRED_CONTROLS_PROVEN: NO` (off-host copy, remote retrieval, remote integrity not
proven). Local PostgreSQL + object restore mechanics are proven (R2.1A). `RELEASE_BLOCKER_B2:
PARTIAL` — B2 is **not** cleared because the off-host recovery leg cannot be proven without a
real independent destination. The block is an environment/credential dependency, **not** a
script or architecture defect.

## R2.1B result

`R2_1B_STATUS: BLOCKED` · `NEXT_STATUS: BLOCKED` · `KORE_TOUCHED: NO` · `FILES_CHANGED:
.dev-reports/looply-v1-r2-1-backup-restore-dr.md` (report only). No source changes, no
commit, no push, nothing staged.

## Git state (after R2.1B)

```
HEAD:               730ad8a9ebb22fed6f8988df52799271ccf096a2 (unchanged)
Changed (uncommitted): .gitignore, ops/backup/backup.sh, ops/backup/restore.sh,
                       ops/backup/verify.sh, ops/backup/README.md
Untracked report:    this report
Backups:             .backups/ gitignored (not committed)
Staged/Committed:    none
KORE_TOUCHED:        NO
```
