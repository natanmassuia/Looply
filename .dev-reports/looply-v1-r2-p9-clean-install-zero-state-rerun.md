# R2.P9 — Clean Install / Zero-State Readiness — Rerun (after parentId migration fix)

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

## Comparison

### Original R2.P9 failure
A fresh install from committed migrations failed on **first content/demand creation**:
`The column Content.parentId does not exist`. Root cause: `schema.prisma` required `Content.parentId` (group/ungroup feature) but no committed migration created it (migration history drift). Dev DB worked only via historical `db push`/manual drift. Result: `CLEAN_INSTALL_READY: NO`, `FIRST_DEMAND: FAIL`, `HIDDEN_DEPENDENCIES: 1`.

### R2.P9A remediation
Added forward-only migration `20260826000000_add_content_parent_id` (adds `Content.parentId` TEXT nullable + FK `Content_parentId_fkey` ON DELETE SET NULL ON UPDATE CASCADE + index `Content_parentId_idx`). Committed `ffe3f82`. Audit PASS. **ORIGINAL_PARENTID_DRIFT: CLOSED.**

### This rerun
Re-ran the full zero-state battery with fresh disposable resources and the committed fix in place.

## Isolated resources (all disposable, torn down after; active env untouched)

| Resource | Disposable | Active (untouched) |
|---|---|---|
| PostgreSQL | `127.0.0.1:55436` db `looply_r` (container) | `127.0.0.1:5432` |
| Redis | `127.0.0.1:56380` (container, empty) | `127.0.0.1:6379` |
| Object storage | MinIO `127.0.0.1:59010`, bucket `looply-r` (empty) | MinIO `127.0.0.1:9100/9101` |
| Backend | port 4401 | active port 4000 (PID 658458) |

## Execution results

| Step | Result |
|---|---|
| Empty PostgreSQL | PASS |
| `prisma migrate deploy` from zero | PASS — **16** migrations applied (incl. parentId migration) |
| `Content.parentId` present in fresh DB | PASS |
| Empty Redis | PASS (DBSIZE 0 at start and end) |
| Empty storage bucket | PASS |
| Backend starts (disposable) | PASS (`server_started` 4401; `/health` db configured) |
| Official bootstrap: provision → login(temp) → change password → select template → complete onboarding | PASS (status ACTIVE, MARKETING_AGENCY) |
| First tenant | PASS |
| First user/member (OWNER) | PASS |
| Default workflow | PASS (1 workflow, 6 stages) |
| First client | PASS (201) |
| **First content/demand** | **PASS (201)** — no longer blocked |
| Parent/child content (group) | PASS (child.parentId set to parent id) |
| First appointment | PASS (201) |
| Storage write/read (upload-intent → presigned PUT 200 → complete AVAILABLE, 11B) | PASS |
| Restart backend once | PASS (relogin 200, health ok) |
| Post-restart reads (client, contents, appointment) | PASS (1 client, 3 contents, 1 appointment) |
| Redis fresh-state behavior | PASS (no persistent app state required; DBSIZE 0) |
| Storage fresh-state behavior | PASS (bucket empty at start; only the test upload object present) |
| No mock/legacy/manual data required | PASS (ran entirely on empty DB/Redis/bucket) |

## Install data classification

- REQUIRED_BOOTSTRAP_DATA: `provisionWorkspace` (first tenant/user) + onboarding template+complete — required, correct.
- OPTIONAL_SEEDS: `src/seed.ts` demo seed — NOT required (flow completed without it).
- LEGACY_MOCKS: 0 required.
- HIDDEN_DEPENDENCIES: 0.

## Validation

- SOURCE_CHANGE: NO (rerun used committed state; no code edits)
- SCHEMA_CHANGE: NO
- NEW_MIGRATION: NO (added in R2.P9A, already committed at ffe3f82)
- BACKEND_TESTS: 481/481_PASS (no source change → existing evidence reused)
- DIFF_CHECK: PASS
- ACTIVE_ENVIRONMENT_TOUCHED: NO · DB_PUSH_USED: NO · MANUAL_DB_PATCH_USED: NO

## Result

RESULT: PASS
DISPOSABLE_DB: PASS
DISPOSABLE_REDIS: PASS
DISPOSABLE_STORAGE: PASS

MIGRATIONS_FROM_ZERO: PASS
MIGRATION_COUNT: 16
BACKEND_START: PASS

BOOTSTRAP_PATH: PASS
FIRST_TENANT: PASS
FIRST_USER_MEMBER: PASS
DEFAULT_WORKFLOW: PASS
FIRST_CLIENT: PASS
FIRST_DEMAND: PASS
PARENT_CHILD_CONTENT: PASS
FIRST_APPOINTMENT: PASS

RESTART_PROOF: PASS
POST_RESTART_VALIDATION: PASS
REDIS_FRESH_STATE: PASS
STORAGE_FRESH_STATE: PASS

REQUIRED_BOOTSTRAP_DATA: provisionWorkspace + onboarding
OPTIONAL_SEEDS: seed.ts (not required)
LEGACY_MOCKS: 0_REQUIRED
HIDDEN_DEPENDENCIES: 0

ORIGINAL_PARENTID_DRIFT: CLOSED
PARENTID_REMEDIATION_PROVEN: YES

ACTIVE_ENVIRONMENT_TOUCHED: NO
DB_PUSH_USED: NO
MANUAL_DB_PATCH_USED: NO

SOURCE_CHANGE: NO
SCHEMA_CHANGE: NO
NEW_MIGRATION: NO

BACKEND_TESTS: 481/481_PASS
DIFF_CHECK: PASS

CLEAN_INSTALL_READY: YES
MOCK_CLEANUP_READY: YES
R2_P9_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_MOCK_DATA_CLEANUP

REPORT: .dev-reports/looply-v1-r2-p9-clean-install-zero-state-rerun.md
GIT_STATE: no source changes; reports (M1/M2 + original R2.P9 + this rerun) untracked; HEAD ffe3f82
KORE_TOUCHED: NO

LOOPLY R2.P9 CLEAN INSTALL ZERO STATE RERUN — PASS