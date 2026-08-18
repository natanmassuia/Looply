# Looply — V1-R2.1 Backup / Restore / DR Independent Audit

Date: 2026-08-18 · Branch: `main` @ `730ad8a` · Audit only — no source modified, no commit, no push.

Purpose: independently audit the current R2.1 backup/restore implementation before Git
consolidation ahead of the Hostinger→Contabo VPS migration. Verify evidence is real, scripts
are safe, B2 stays PARTIAL (off-host not proven), and the work is safe to version in Git.

## Baseline

- HEAD `730ad8a9ebb22fed6f8988df52799271ccf096a2` (expected base, unchanged).
- Uncommitted R2.1 work: `.gitignore` (modified), `ops/backup/` (untracked: backup.sh,
  restore.sh, verify.sh, README.md), `.dev-reports/looply-v1-r2-1-backup-restore-dr.md` (untracked).
- Nothing staged, nothing committed, no push.
- `KORE_TOUCHED: NO`.

## Scope (Audit A)

Verified via `git diff --name-only` + untracked scan:

| File | Change |
|------|--------|
| `.gitignore` | adds `.backups/` and `ops/backup/.backups/` (backup ignore rules) only |
| `ops/backup/backup.sh` | new, backup tooling |
| `ops/backup/restore.sh` | new, restore tooling |
| `ops/backup/verify.sh` | new, verify tooling |
| `ops/backup/README.md` | new, DR runbook + config recovery inventory |
| `.dev-reports/looply-v1-r2-1-backup-restore-dr.md` | new, backup/restore/DR report |

No backend, frontend, Prisma/schema, migration, or `package.json` changes. `NEW_DEPENDENCY: NO`
(scripts use pre-existing CLIs: pg_dump/pg_restore/psql, mc; no new npm dependency).
`SCOPE_PURITY: PASS`.

## backup.sh review (Audit B) — PASS

- `set -euo pipefail` (safe shell mode). ✓
- Required vars validated with `: "${VAR:?}"` (DATABASE_URL, storage endpoint/bucket/keys). ✓
- Credentials never echoed; `PGPASSWORD="$DB_PASS"` env-use; `mc alias set ... >/dev/null 2>&1`. ✓
- pg_dump target derived by parsing DATABASE_URL (host/port/user/name). ✓
- Timestamped backup set (`$TS` → `$DEST`), no overwrite (fails if `$DEST` exists). ✓
- Restricted perms: `umask 077`, `chmod 700` on backup dir. ✓
- DB SHA-256 produced. ✓
- Object backup via `mc mirror` of the authoritative bucket; per-object sha256 inventory. ✓
- Manifest produced (timestamp, git SHA, DB filename/checksum, object count/checksum ref). ✓
- Release SHA captured (`git rev-parse --short HEAD`). ✓
- Remote-copy path optional and explicit (`BACKUP_REMOTE_TARGET`, empty default). ✓
- Configured remote failure returns non-zero (rsync under `set -e`; rsync-missing → exit 1). ✓
- Local backup preserved on remote failure (remote copy runs after local set is complete). ✓
- No retention/delete logic in backup.sh → cannot delete arbitrary paths. ✓

`BACKUP_SCRIPT_SAFE: PASS`.

## restore.sh review (Audit C) — SAFE with one documented finding

- Active DB overwrite refused: `if [[ "$RESTORE_DB" == "$ACTIVE_DB_NAME" && "$FORCE" != "yes" ]] → exit 1`. ✓
- Explicit isolated restore target by default (`looply_restore_test_$RANDOM`). ✓
- `RESTORE_TARGET_DB_URL` cross-cluster support does NOT weaken the guard — the guard compares
  against `ACTIVE_DB_NAME` parsed from `DATABASE_URL`, never the override. ✓
- Credentials not logged. ✓
- Backup checksum verified before pg_restore (archive validation). ✓
- Cross-cluster restore supported (`RESTORE_TARGET_DB_URL`). ✓
- Object restore excludes bookkeeping files (`--exclude manifest.txt --exclude objects.sha256`). ✓
- No broad destructive delete. ✓
- Object keys preserved (`mc mirror`). ✓

**FINDING (MEDIUM):** the object-bucket path has NO `FORCE_DESTRUCTIVE` guard, though
`README.md` documents one ("Overwriting the production bucket requires
`RESTORE_BUCKET_TARGET=<bucket> FORCE_DESTRUCTIVE=yes`"). restore.sh defaults to an isolated
bucket and mirrors into `RESTORE_BUCKET_TARGET` unconditionally. Reaching the production bucket
requires explicitly setting `RESTORE_BUCKET_TARGET=looply-media` (never the default), and the
mirrored content is backup-origin (recoverable), so it is not a default-path vulnerability — but
the documented guard is unenforced, which is a safety inconsistency on a production-mutating
path. Recommend adding the same `ACTIVE_DB_NAME`-style guard for the active bucket before the
consolidation commit. `ACTIVE_DB_OVERWRITE_GUARD: PASS` (DB path), `CROSS_CLUSTER_RESTORE_SUPPORT:
PASS`, `BOOKKEEPING_FILE_EXCLUSION: PASS`.

## verify.sh review (Audit D) — PASS

- `Job` model → `Content` table mapping is CORRECT (confirmed in `schema.prisma`: `model Job` at
  line 321, `@@map("Content")` at line 362). verify.sh checks the physical table `Content`. ✓
- `_prisma_migrations` verified. ✓
- Core tables verified by physical name (Company, User, CompanyMember, Content, Client, Appointment). ✓
- Representative counts meaningful (User count reported; DB-restore drill compared migrations/Company/User/Content/Appointment/Client). ✓
- No row PII exposed — only counts, never rows. ✓
- Failure returns non-zero (missing table → exit 1; object-count mismatch → exit 1). ✓

`VERIFY_SCRIPT_SAFE: PASS`, `JOB_CONTENT_MAPPING_CORRECT: PASS`, `PII_SAFE_VERIFICATION: YES`.

## R2.1A evidence verification (Audit F) — PROVEN / PROVEN / YES

Report (`.dev-reports/looply-v1-r2-1-backup-restore-dr.md`) is internally consistent with the
scripts and the described history:
- isolated `postgres:16` container on `127.0.0.1:55432`, DB `looply_restore_proof`; ✓
- backup checksum verified; `restore.sh` used; `verify.sh` used; ✓
- migration count 15=15; Company 5=5; User 20=20; Content/Job 102=102; Appointment 536=536; Client 7=7; ✓
- active DB untouched; temporary resources cleaned. ✓
- Object restore evidence: count matched (4) and all 4 objects byte-identical. ✓

Evidence consistent with scripts → no remediation from evidence. `POSTGRES_RESTORE_EVIDENCE:
PROVEN`, `OBJECT_RESTORE_EVIDENCE: PROVEN`, `LOCAL_DRILL_CREDIBLE: YES`.

## Git / secrets (Audit E) — PASS

- `.backups/` is git-ignored (confirmed via `git check-ignore`). ✓
- `git ls-files` shows no generated DB dumps / object backups tracked. ✓
- No `ops/backup/.backups` directory. ✓
- No temporary Postgres container/dir represented in Git. ✓
- No credential file committed; `.env*` already git-ignored. ✓
- New files contain only scripts/docs/report. ✓
- Secret scan: only format-comment placeholders (`postgresql://user:pass@...`, `u:p@...`) found;
  no real `.env` values (DB password, MinIO keys) present in any R2.1 file. ✓

`GENERATED_BACKUPS_TRACKED: NO`, `SECRETS_IN_DIFF: NO`, `GIT_IGNORE_SAFE: YES`.

## Redis (Audit K) — NO backup required

`backend/src/lib/transientStore.ts` (the only Redis consumer) is a transient store: all
operations use `EX` TTL (`set`/`setIfAbsent`) and atomic single-use `getdel`; no durable business
state. README documents "48h EX transient keys only", consistent with the code.
`REDIS_BACKUP_REQUIRED: NO`.

## Config recovery (Audit J) — YES / EXTERNAL_DEPENDENCY

README documents a full config recovery inventory (required-for-recovery vs regenerable vs
non-secret vs external-dependency) without storing real secrets. `SECRET_RECOVERY_STATUS:
EXTERNAL_DEPENDENCY` is honestly documented. `CONFIG_RECOVERY_DOCUMENTED: YES`,
`SECRET_RECOVERY_CLASSIFICATION: EXTERNAL_DEPENDENCY`.

## Off-host (Audit L) — unchanged

No independent off-host destination exists (R2.1B BLOCKED): local MinIO is same-host loopback,
no external S3/GCS creds, no remote SSH/rsync host, no remote mount, no rclone/cloud CLIs.
`OFF_HOST_CAPABILITY: YES` (script supports BACKUP_REMOTE_TARGET), `OFF_HOST_CONFIGURED: NO`,
`OFF_HOST_COPY_PROVEN: NO`, `VM_LOSS_BACKUP_SURVIVES: NO`. Environment has not visibly changed.
`RELEASE_BLOCKER_B2: PARTIAL` (correct; not CLEARED).

## Contabo migration suitability (Audit M) — YES

Tooling is a suitable foundation for the Hostinger→Contabo move:
`backup.sh` → transfer set → `restore.sh` (cross-cluster via `RESTORE_TARGET_DB_URL`) →
`verify.sh`. The backup set is self-contained (manifest + DB dump + checksum + objects + object
checksums). `CONTABO_MIGRATION_TOOLING_READY: YES`. Limitations: off-host scheduled DR not
complete; secrets are EXTERNAL_DEPENDENCY (must be re-provisioned on Contabo); the restore.sh
bucket-guard MEDIUM finding should be fixed before relying on it during migration.

## Security (Audit N) — classified accurately

- Local permissions: strong (`umask 077`, `chmod 700`).
- Transport: rsync-over-SSH when a target is configured (none configured).
- Secrets: none in Git; env-vars only.
- Integrity: SHA-256 checksums for DB + objects + manifest.
- Encryption at rest: NOT implemented (documented gap).
- Scheduling: NOT configured (operational gap, ON_DEMAND cadence).
- Off-host destination: absent (operational/release gap, not a code vulnerability).

These are documented hardening/operational gaps, not silent HIGHs.

## Findings (Audit O)

- **MEDIUM (1)** — restore.sh does not enforce the object-bucket `FORCE_DESTRUCTIVE` guard that
  README documents. Reaching the production bucket requires explicit non-default
  `RESTORE_BUCKET_TARGET=looply-media`; content is backup-origin. Not a default-path vuln, but a
  safety-guard inconsistency on a production-mutating path. Recommend adding the active-bucket
  guard at consolidation time.
- **LOW (1)** — backup.sh swallows `mc ls`/object-checksum generation errors with `|| true`
  (lines 79/84), so a failed object enumeration/checksum write would not fail the backup run;
  verify.sh would catch a bad checksum later. Minor robustness note.

No CRITICAL, no HIGH. Lack of off-host destination is an operational/release gap, not classified
as a vulnerability.

## B2 decision (Audit P) — PARTIAL

`POSTGRES_BACKUP: PROVEN`, `POSTGRES_RESTORE: PROVEN`, `OBJECT_BACKUP: PROVEN`, `OBJECT_RESTORE:
PROVEN`, `OFF_HOST: NOT_PROVEN` → `RELEASE_BLOCKER_B2: PARTIAL` (not CLEARED, correctly).

## Consolidation decision

The implemented portion is technically sound, minimally scoped, safe to version in Git, and
sufficient to reuse during the Contabo migration. B2 is correctly PARTIAL. One MEDIUM safety
finding (bucket guard) is recommended to be fixed at the consolidation commit; it does not make
the work unsafe to version or reuse. `R2_1_CONSOLIDATION: PASS` → `NEXT_STATUS:
READY_FOR_CONSOLIDATION`.

## Validation

- `git branch --show-current`: `main`
- `git rev-parse HEAD`: `730ad8a9ebb22fed6f8988df52799271ccf096a2`
- `git status --short`: ` M .gitignore`, `?? .dev-reports/...dr.md`, `?? ops/`
- `git diff --stat`: `.gitignore` only (4 insertions)
- `git diff --name-status`: `M .gitignore`
- `git diff --check`: PASS
- `bash -n` on backup.sh / restore.sh / verify.sh: all OK
- `shellcheck`: NOT installed (not added)
- `free -h`: 1.9Gi available (above the 800MB guard; audit is read-only)

No backup was regenerated; no PostgreSQL restore was re-run (evidence on disk was sufficient and
consistent).

## Git state

```
HEAD:               730ad8a9ebb22fed6f8988df52799271ccf096a2 (unchanged)
Changed:            .gitignore + ops/backup/* (untracked) + this audit report (new)
Untracked report:   this report (audit) + looply-v1-r2-1-backup-restore-dr.md
Backups:            .backups/ gitignored (not committed)
Staged/Committed:   none
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: `.gitignore`, `ops/backup/backup.sh`, `ops/backup/restore.sh`, `ops/backup/verify.sh`,
  `ops/backup/README.md`, `backend/src/lib/transientStore.ts`, `backend/prisma/schema.prisma`,
  `.dev-reports/looply-v1-r2-1-backup-restore-dr.md`,
  `.dev-reports/looply-v1-r2-release-security-readiness-audit.md`.
- Ran: git status/diff/ls-files/check-ignore, bash -n, secret-value scans, free -h.
- No secrets printed; no tenant PII printed; no source modified; no commit/push/stage.
