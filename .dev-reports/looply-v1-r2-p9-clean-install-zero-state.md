# R2.P9 — Clean Install / Zero-State Readiness

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** c0b8812

## Phase 1 — R2.6A consolidation

- Committed `c0b8812` "docs(security): record final application security reaudit"; pushed origin/main.
- LOCAL_REMOTE_MATCH: YES · UNPUSHED_COMMITS: 0 · R2.6A clean · M1/M2 untouched.

## Phase 2 — R2.P9 isolated zero-state run

### Disposable isolated resources (all separate from active env, torn down after)

| Resource | Disposable | Active (untouched) |
|---|---|---|
| PostgreSQL | `127.0.0.1:55432` db `looply_p9` (container) | `127.0.0.1:5432` db `looply` |
| Redis | `127.0.0.1:56379` (container, empty) | `127.0.0.1:6379` |
| Object storage | MinIO `127.0.0.1:59000`, bucket `looply-p9` (empty) | MinIO `127.0.0.1:9100/9101` |
| Backend | `node dist/server.js` on port 4400 | active on port 4000 (PID 658458) |

No active DB / Redis / bucket / runtime was touched. Containers removed after the run. ACTIVE_ENVIRONMENT_TOUCHED: NO.

### Migration from zero

`prisma migrate deploy` against the empty disposable PG applied **all 15 committed migrations** successfully.

**MIGRATIONS_FROM_ZERO: PASS** (all applied).

### First-install flow (via official HTTP/bootstrap path)

| Step | Result |
|---|---|
| Backend starts against disposable resources | PASS (`server_started` port 4400; `/health` = `{status:ok, db:configured}`) |
| Bootstrap: `provisionWorkspace` → first tenant + OWNER user | PASS |
| Login with temp password (`mustChangePassword:true`) | PASS |
| Forced password change | PASS |
| Select template (MARKETING_AGENCY) | PASS |
| Complete onboarding → status `ACTIVE`, `onboardedAt` set | PASS |
| Default workflow (auto-created on first content attempt) | PASS (1 workflow, 6 stages) |
| First client | PASS (201) |
| **First demand / content** | **FAIL — blocked by migration drift (see below)** |
| First appointment | PASS (201) |
| Service restart (SIGTERM + relaunch) | PASS |
| Post-restart: relogin + read client/appointment/workflow | PASS (1 client, 1 appointment, 1 workflow/6 stages all persist) |
| Redis fresh-state | PASS (DBSIZE 0) |
| Storage fresh-state | PASS (bucket empty — no hidden dependency) |

### CONFIRMED HIDDEN DEPENDENCY (clean-install blocker)

**First demand/content creation fails with a Prisma error:**

```
Invalid `tx.job.create()` invocation … The column `Content.parentId` does not exist in the current database.
```

Root cause: **migration drift**. `prisma/schema.prisma` `Job` model declares `parentId String?` (with relation `JobGroup` + `@@index([parentId])`) — added for the group/ungroup feature. **No committed migration in `prisma/migrations/` creates `parentId`** (grep of all migration SQL returned empty; the migrated `Content` table confirmed to lack `parentId`).

Consequence: `prisma migrate deploy` from zero yields a schema incompatible with the generated Prisma client. Every `job.create` (content/demand creation) fails on a fresh install. The active dev environment only works because `parentId` was added historically via `db push` / a manual, uncommitted schema change — exactly the kind of "manual DB fix" that clean install must NOT depend on.

Classification:
- **HIDDEN_DEPENDENCIES: 1** — missing `parentId` column (schema/client vs committed migrations drift).
- This is NOT a mock/legacy-data issue; it is a missing-migration defect.

### Seed / bootstrap / mock classification

- REQUIRED_BOOTSTRAP: `provisionWorkspace` (first tenant/user) — required, correct.
- OPTIONAL_SEED: `src/seed.ts` demo seed — not required for the proven flow (onboarding + first tenant worked without it).
- LEGACY_MOCKS_FOUND: none exercised the working paths; the zero-state flow did not depend on demo seed data.
- HIDDEN_DEPENDENCY: 1 (the `parentId` migration drift above).

### No historical-fixture requirement proven for all non-content paths

Client, appointment, workflow, onboarding, auth, and restart all succeeded on an empty DB/Redis/bucket with no historical fixtures. Only content/demand creation is blocked — by schema/migration drift, not by missing mock data.

## Required remediation (out of scope — this battery only proves the requirement)

Commit a Prisma migration adding `parentId String?` (and its `@@index([parentId])`) to the `Content`/`Job` table so `prisma migrate deploy` from zero matches the schema/client. Do NOT use `db push` against the active DB. After the migration exists, re-run this zero-state battery to confirm first demand succeeds.

## Files changed

None (no source/test changes; report only, not staged).

## Validation

- Backend tests 481/481: NOT re-run — no source change; existing evidence reused.
- git diff --check: PASS (no changes).
- SOURCE_CHANGE: NO · SCHEMA_CHANGE: NO (schema file unchanged; the drift is between committed migrations and the schema, not a new schema edit) · NEW_MIGRATION: NO.

## Result

- ZERO_STATE_RESULT: **CONFIRMED_DEFECT** (first demand blocked by migration drift)
- MIGRATIONS_FROM_ZERO: PASS (applied; schema-compatibility FAIL)
- DISPOSABLE_DB / REDIS / STORAGE: PASS
- BOOTSTRAP_PATH: PASS · FIRST_TENANT: PASS · FIRST_USER_MEMBER: PASS · DEFAULT_WORKFLOW: PASS · FIRST_CLIENT: PASS · FIRST_DEMAND: **FAIL** · FIRST_APPOINTMENT: PASS
- RESTART_PROOF: PASS · POST_RESTART_VALIDATION: PASS
- REQUIRED_BOOTSTRAP_DATA: provisionWorkspace · OPTIONAL_SEEDS: seed.ts (not required) · LEGACY_MOCKS_FOUND: 0 (none required) · HIDDEN_DEPENDENCIES: 1 (missing `parentId` migration)
- ACTIVE_ENVIRONMENT_TOUCHED: NO · SOURCE_CHANGE: NO · SCHEMA_CHANGE: NO · NEW_MIGRATION: NO
- BACKEND_TESTS: 481/481_PASS (existing evidence) · DIFF_CHECK: PASS
- **CLEAN_INSTALL_READY: NO** (blocked by missing `parentId` migration)
- **MOCK_CLEANUP_READY: YES** (no mock/legacy data dependency for the working paths)
- **R2_P9_STATUS: COMPLETE (battery ran; zero-state defect surfaced)**
- **NEXT_STATUS: NEEDS_MIGRATION_DRIFT_REMEDIATION** (commit `parentId` migration, then re-run)
- REPORT: .dev-reports/looply-v1-r2-p9-clean-install-zero-state.md
- GIT_STATE: no source changes; R2.P9 report untracked + not staged/committed; HEAD c0b8812
- KORE_TOUCHED: NO

## Note on finish markers

The standard `CLEAN_INSTALL_READY: YES` ideal is **not** met. Per the task's classification contract, this battery is a **BLOCKED** outcome at the zero-state level because a confirmed migration defect prevents first demand creation on a fresh install. The battery successfully proved what is required before cleanup/removal.

LOOPLY R2.P9 CLEAN INSTALL ZERO STATE — DEFECT FOUND (MIGRATION DRIFT) — REMEDIATION REQUIRED BEFORE CLEAN INSTALL