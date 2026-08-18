# Looply — V1-R2.1D Backup Tooling Safety Independent Audit

Date: 2026-08-18 · Branch: `main` @ `730ad8a` · Audit only — no source modified, no commit, no push, no stage.

Purpose: independently audit the uncommitted R2.1D remediation of the two findings from the
prior independent audit (`.dev-reports/looply-v1-r2-1-backup-restore-independent-audit.md`):
- R2.1D-01 (was MEDIUM) — restore.sh object-bucket FORCE_DESTRUCTIVE guard documented but unenforced.
- R2.1D-02 (was LOW) — backup.sh swallowed object listing/checksum failures with `|| true`.

## Baseline

- HEAD `730ad8a9ebb22fed6f8988df52799271ccf096a2` (expected base, unchanged — re-verified).
- Uncommitted: `M .gitignore` (+4: `.backups/`, `ops/backup/.backups/`), untracked `ops/` (backup.sh,
  restore.sh, verify.sh, README.md), `.dev-reports/looply-v1-r2-1-backup-restore-dr.md`,
  `.dev-reports/looply-v1-r2-1-backup-restore-independent-audit.md`,
  `.dev-reports/looply-v1-r2-1d-backup-tooling-safety-remediation.md`, this report.
- Nothing staged, nothing committed, no push. `KORE_TOUCHED: NO`.

## R2.1D-01 — restore.sh destructive bucket guard

Guard present and correct at `ops/backup/restore.sh:120`:

```
if [[ "$RESTORE_BUCKET" == "$STORAGE_BUCKET" && "$FORCE" != "yes" ]]; then exit 1; fi
```

Verified:
- **Runs before mutation.** The only prior bucket-related statement is `mc alias set` (line 114),
  which registers a local alias — no server-side bucket mutation. The guard precedes
  `mc ls` / `mc mb` (126-127) and `mc mirror` (133). No object can be written before the guard passes.
- **Active bucket requires FORCE.** `RESTORE_BUCKET_TARGET=$STORAGE_BUCKET` (i.e. `looply-media`)
  without `FORCE_DESTRUCTIVE=yes` → exit 1, clear non-secret error, no mutation. Active bucket
  re-verified at 4 objects (unchanged).
- **Isolated target works without FORCE.** Default `looply-restore-test-$RANDOM` (line 115) and any
  non-active bucket name do not equal `$STORAGE_BUCKET` → guard passes, no acknowledgement needed.
- **DB guard unchanged and still correct.** Line 98 compares `RESTORE_DB` against `ACTIVE_DB_NAME`
  (parsed from `DATABASE_URL`), never the `RESTORE_TARGET_DB_URL` override — cross-cluster restore
  does not weaken it.
- Comparison target is `$STORAGE_BUCKET` from `.env` (canonical source bucket), not a name heuristic.

This matches the documented contract in README. `RESTORE_DESTRUCTIVE_GUARD_CORRECT: YES`.

## R2.1D-02 — backup.sh failure propagation

Verified at `ops/backup/backup.sh`:
- **Object listing failure fatal** — lines 81-84: `if ! mc ls --recursive ... > manifest.txt; then
  echo ERROR; exit 1; fi`. A failed listing can no longer produce an empty manifest.txt.
- **Checksum failure fatal** — lines 90-91: `find ... | xargs -0 -r sha256sum > objects.sha256`
  has no `|| true`; under `set -o pipefail` (line 14) any pipeline member failure aborts the backup.
- **Empty bucket valid** — a *successful* listing of an empty bucket yields 0 lines →
  `OBJECT_COUNT=0`, manifest records `object_count: 0`. Empty is not converted to failure;
  only inaccessible/broken buckets fail.
- **No misleading manifest** — manifest (line 96) is written only after listing + checksum
  enumeration succeed. Any object-verification failure exits before manifest creation.
- Kept `|| true` occurrences (line 55 chmod best-effort, line 65 git SHA fallback) are
  non-integrity and remain intentional.

`BACKUP_FAILURE_PROPAGATION_CORRECT: YES`.

## Findings by severity

- **CRITICAL: none.** **HIGH: none.**
- **MEDIUM (R2.1D-01): FIXED** — destructive bucket guard now enforced before mutation, matches
  README contract, verified active bucket not mutated.
- **LOW (R2.1D-02): FIXED** — object listing and checksum failures are now fatal; empty bucket
  remains valid; failed verification cannot yield a successful manifest.
- **LOW (informational, unchanged by design):** off-host not configured/proven, no encryption at
  rest, no backup schedule — operational gaps, not script defects. B2 stays PARTIAL.

## Prior evidence integrity

- Preserved backup set `.backups/20260818T200609Z` (the R2.1A-proven set) re-verified read-only:
  `postgres.dump` checksum OK, `manifest.json` checksum OK, all 4 object checksums OK, verify.sh
  exit 0. Prior PostgreSQL/object restore evidence remains valid — the restore source is intact.
- Active bucket `looply-media` object count re-checked via host `mc` with repo `.env`: **4** —
  unchanged, not mutated. (A `docker exec` check using the container's default `local` alias
  returned 0 only because that alias is not configured inside the container; host `mc` confirms 4.)
- No disposable containers lingering (`looply-r2*`): none — cleanup from R2.1D proofs confirmed.

## Scope / secrets / git

- `git ls-files`: no `.backups/`, dumps, checksum files, or manifests tracked. `git check-ignore`
  confirms `.backups/` is ignored (`.gitignore:40`).
- Untracked files outside `ops/backup/` + R2.1 reports: none.
- Secret scan: only format-comment placeholders (`postgresql://user:pass@...`, `u:p@...`) found;
  no real `.env` values present.
- No backend, frontend, Prisma schema, migration, or dependency changes. No app tests affected.
- `git diff --check`: PASS (exit 0). `bash -n` backup.sh / restore.sh / verify.sh: all OK.
- `free`/containers: no new containers started by this audit; checks were read-only.

## B2 status

`RELEASE_BLOCKER_B2: PARTIAL` — unchanged and correct. PostgreSQL backup/restore, object
backup/restore, local isolated restore drill are proven; off-host backup is not configured/proven
(R2.1B BLOCKED — no independent destination in this environment). B2 is NOT cleared.

## Consolidation decision

Both remediation findings are correctly and minimally fixed; the active bucket guard is correct;
backup failures propagate correctly; no new defects introduced; prior evidence remains valid. The
current full R2.1 diff (`.gitignore` + `ops/backup/*` + reports) is safe to version in Git.
`R2_1_CONSOLIDATION: PASS` → `NEXT_STATUS: READY_FOR_CONSOLIDATION`.

## Result

```
R2_1D_01_STATUS: CLOSED
R2_1D_02_STATUS: CLOSED
RELEASE_BLOCKER_B2: PARTIAL
R2_1_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
```

## Git state

```
HEAD:               730ad8a9ebb22fed6f8988df52799271ccf096a2 (unchanged)
Changed:            .gitignore + ops/backup/* (untracked) + R2.1/R2.1D reports
Staged/Committed:   none
Backups:            .backups/ gitignored (not committed)
KORE_TOUCHED:       NO
```

## Validation run

- `git rev-parse HEAD` → `730ad8a9ebb22fed6f8988df52799271ccf096a2`
- `git status --short` → ` M .gitignore`, `?? .dev-reports/...`, `?? ops/`
- `git diff --check` → PASS (exit 0)
- `bash -n` on `ops/backup/backup.sh` / `restore.sh` / `verify.sh` → all OK
- `ops/backup/verify.sh .backups/20260818T200609Z` → exit 0 (DB + manifest + 4 object checksums OK)
- host `mc ls` `looply-media` → 4 objects (active bucket not mutated)
- No containers started for this audit; no new PostgreSQL restore drill run (evidence consistent).

---

LOOPLY V1-R2.1D BACKUP TOOLING SAFETY INDEPENDENT AUDIT — PASS