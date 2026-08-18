# Looply — V1-R2.1D Backup Tooling Safety Remediation

Date: 2026-08-18 · Branch: `main` @ `730ad8a` · No commit, no push, no stage.

Addresses the two independent-audit findings (`.dev-reports/looply-v1-r2-1-backup-restore-independent-audit.md`):
- MEDIUM R2.1D-01 — object-bucket FORCE_DESTRUCTIVE guard documented in README but not enforced.
- LOW R2.1D-02 — backup.sh swallowed object listing/checksum failures with `|| true`.

Off-host backup and B2 remain unchanged (not addressed here by design).

## R2.1D-01 — MEDIUM root cause

`restore.sh` guarded the **database** target against overwriting the active DB
(`RESTORE_DB == ACTIVE_DB_NAME` requires `FORCE_DESTRUCTIVE=yes`, lines 98-102), but the
**object** restore path (lines 113-128) had no equivalent guard. `RESTORE_BUCKET` defaulted to
an isolated `looply-restore-test-$RANDOM`, but if a user explicitly set
`RESTORE_BUCKET_TARGET=$STORAGE_BUCKET` (the active application bucket, `looply-media`), the
script mirrored into it unconditionally — even though `README.md` documents that overwriting the
production bucket requires `FORCE_DESTRUCTIVE=yes`. Implementation did not match documented
contract.

**Contract determined:**
- Active/source bucket: `$STORAGE_BUCKET` from `.env` (canonical existing config), not inferred
  from bucket-name substrings.
- Restore target: `RESTORE_BUCKET_TARGET` env, defaulting to isolated `looply-restore-test-$RANDOM`.
- Database guard: `RESTORE_DB == ACTIVE_DB_NAME && FORCE != yes` → exit 1.
- Object guard (new): `RESTORE_BUCKET == STORAGE_BUCKET && FORCE != yes` → exit 1.

**Fix (restore.sh):** added a destructive guard immediately after `RESTORE_BUCKET` is resolved and
BEFORE any bucket operation (`mc ls`/`mc mb`/`mc mirror`). Uses the existing `FORCE_DESTRUCTIVE`
convention. Isolated/different buckets require no acknowledgement. `README.md` already documented
this contract; the implementation now matches it, so no README rewrite was needed.

## R2.1D-02 — LOW root cause

`backup.sh` used `|| true` in two object-verification locations, suppressing failures that
undermine backup completeness/integrity:

1. Line 79 (was): `mc ls --recursive ... > manifest.txt || true` — a failed authoritative object
   listing was swallowed; `manifest.txt` could be empty and `OBJECT_COUNT` would read 0, letting
   the manifest claim a successful object backup when the bucket was unreadable.
2. Line 83-84 (was): `find ... | xargs -0 -r sha256sum > objects.sha256 || true` — a failed
   checksum enumeration was swallowed, producing an incomplete/missing checksum inventory without
   failing the backup.

**`|| true` classification (kept intentionally):**
- Line 55 `chmod 700 "$BACKUP_DIR" || true` — best-effort permission hardening on existing dir; not
  backup-integrity. KEPT.
- Line 65 `git rev-parse ... || echo "unknown"` — optional release-SHA discovery with explicit
  fallback; not backup-integrity. KEPT.

**Fix (backup.sh):**
- Object listing is now authoritative: `if ! mc ls --recursive ... ; then echo ERROR; exit 1; fi`.
  A successful listing of an EMPTY bucket yields 0 objects (valid, not an error) — distinguishes
  failure from empty.
- Checksum enumeration: removed `|| true`; under the existing `set -o pipefail` (line 14), any
  pipeline member failure propagates and aborts the backup. Manifest is only written after these
  steps succeed, so no misleading manifest is possible.

## Destructive bucket invariant

A restore targeting the active/source application object bucket (`STORAGE_BUCKET`) MUST NOT
proceed unless `FORCE_DESTRUCTIVE=yes` is explicitly set. If the target bucket is clearly
different/isolated, no destructive acknowledgement is required.

```
if [[ "$RESTORE_BUCKET" == "$STORAGE_BUCKET" && "$FORCE" != "yes" ]]; then exit 1; fi
```

Fail-before-write, non-zero exit, clear non-secret error, no bucket mutation before guard passes,
no credentials printed.

## Empty bucket behavior

- Successful listing with 0 objects → valid backup, `object_count=0`.
- Inaccessible/broken bucket → backup fails non-zero.
- Empty bucket is NOT converted to failure.

## Proofs

### A. Destructive bucket guard (disposable Postgres container, isolated DB; active bucket never mutated)

| Case | Target | FORCE | Result |
|------|--------|-------|--------|
| A1 isolated | `looply-r2d-isolated-test` | no | proceeds (exit 0), 4 objects mirrored |
| A2 active | `looply-media` | no | **BLOCKED** (exit 1), clear error, active bucket unchanged (4) |
| A3 active | `looply-media` | yes | guard permits progression (exit 0); synthetic set with no objects dir → no mutation |

`ISOLATED_BUCKET_RESTORE_WITHOUT_FORCE: PASS` · `ACTIVE_BUCKET_RESTORE_WITHOUT_FORCE: BLOCKED` ·
`FORCED_PATH_GUARD_PROOF: PASS` · `GUARD_RUNS_BEFORE_MUTATION: YES` · `ACTIVE_BUCKET_MUTATED: NO`
(active `looply-media` remained at 4 objects throughout).

### B. Object backup failure (controlled invalid targets)

- **B1** backup.sh against non-existent bucket (`looply-r2d-nonexistent-bucket`, temp script root so
  `.env` wasn't sourced): failed exit 1 at object mirror, **no `manifest.json` produced** (only the
  DB dump + checksum from the successful DB step). `OBJECT_LIST_FAILURE_FATAL: YES`,
  `MISLEADING_MANIFEST_POSSIBLE: NO`.
- **B2a** listing guard on non-existent bucket → fires (failure fatal).
- **B2b** listing guard on existing bucket (`looply-media`, 4 objects) → passes (exit 0).
- **B2c** empty bucket lists OK, 0 objects → valid, not failure. `EMPTY_BUCKET_SUPPORTED: YES`.
- **B3** checksum pipeline on a dir with an unreadable file → exit 123 (fatal, pipefail); readable
  dir → exit 0. `OBJECT_CHECKSUM_FAILURE_FATAL: YES`.

### C. Valid backup regression (real environment)

`backup.sh` (sources `.env`) ran clean: DB dump OK, object mirror OK (4 objects), manifest with
`object_count: 4` + `git_sha: 730ad8a` + DB checksum, `verify.sh` PASS (DB checksum, manifest
checksum, all 4 object checksums). `VALID_BACKUP_REGRESSION: PASS`, `VALID_OBJECT_BACKUP: PASS`,
`VALID_MANIFEST: PASS`, `VALID_CHECKSUMS: PASS`.

### D. Restore regression

Isolated object restore (A1) correctly mirrored all 4 objects with keys preserved into
`looply-r2d-isolated-test`; bucket cleaned up after. Active bucket untouched (4). `RESTORE_REGRESSION:
PASS`, `OBJECT_RESTORE_REGRESSION: PASS`.

## Validation

- `free -h`: 1.8Gi available before proofs (above 800MB guard).
- `bash -n ops/backup/backup.sh` / `restore.sh` / `verify.sh`: all OK.
- `shellcheck`: not installed (not added).
- `git diff --check`: PASS.
- No backend/frontend/Prisma/migration/dependency changes (no app tests run — none affected).

## Active bucket mutation status

`ACTIVE_BUCKET_MUTATED: NO` — `looply-media` remained at 4 objects across all proofs; only
isolated/disposable targets were used; disposable Postgres container removed; no production data
touched.

## Files changed

- `ops/backup/restore.sh` — added active-bucket FORCE_DESTRUCTIVE guard (R2.1D-01).
- `ops/backup/backup.sh` — object listing failure fatal + checksum pipeline failure fatal (R2.1D-02).
- `.dev-reports/looply-v1-r2-1d-backup-tooling-safety-remediation.md` — this report.

No change to `verify.sh` or `README.md` (implementation now matches the already-documented contract).

## Remaining R2.1 limitations

- `OFF_HOST_CONFIGURED: NO`, `OFF_HOST_COPY_PROVEN: NO` — no independent off-host destination
  (R2.1B BLOCKED). Not addressed here.
- `VM_LOSS_BACKUP_SURVIVES: NO` (off-host absent).
- `BACKUP_ENCRYPTION_AT_REST: NO`, `BACKUP_SCHEDULE_CONFIGURED: NO` (operational gaps).

## B2 status

`RELEASE_BLOCKER_B2: PARTIAL` — unchanged. PostgreSQL backup/restore, object backup/restore, local
DR drill proven; off-host backup not yet configured/proven. B2 is NOT cleared.

## Git state

```
HEAD:               730ad8a9ebb22fed6f8988df52799271ccf096a2 (unchanged)
Changed:            .gitignore, ops/backup/backup.sh, ops/backup/restore.sh
Untracked:          ops/backup/verify.sh, ops/backup/README.md, prior R2.1 reports, this report
Backups:            .backups/ gitignored (original R2.1A set preserved; Proof-C test set removed)
Staged/Committed:   none
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: `ops/backup/backup.sh`, `ops/backup/restore.sh`, `ops/backup/verify.sh`,
  `ops/backup/README.md`, `.dev-reports/looply-v1-r2-1-backup-restore-dr.md`,
  `.dev-reports/looply-v1-r2-1-backup-restore-independent-audit.md`.
- Ran: bash -n, git diff --check, mc (ls/mirror/mb/rb), disposable postgres:16 Docker container,
  focused safety proofs A/B/C/D. No secrets printed; no tenant PII printed; active DB and active
  bucket never mutated; no commit/push/stage.
