# R2.P10 — Mock Data / Demo Residue Cleanup

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

## Data creators inspected

| Creator | Classification | Notes |
|---|---|---|
| `src/seed.ts` (demo users/clients/contents with fake picsum media) | OPTIONAL_DEVELOPMENT_SEED | Explicit/manual via `npm run seed`. **Never auto-runs** — not referenced in `server.ts`/`app.ts`. Clearly dev-only; cannot be confused with production bootstrap (separate explicit command). Retained per rules. |
| `provisionWorkspace` (onboardingService) | REQUIRED_BOOTSTRAP | Official first tenant/user. Creates only real provisioning records (temp password, OWNER membership). No fake data. |
| `ensureDefaultWorkflow` (lazy on first content) | REQUIRED_BOOTSTRAP | Creates the required default workflow (stages). Not mock data — required defaults. |
| Onboarding (select template + complete) | REQUIRED_BOOTSTRAP | Marks workspace ACTIVE; no fake records. |
| Frontend fixtures (`frontend/src/tests/*`) | TEST_ONLY | All seed/mock/demo references live in test files; isolated to tests. |
| `DEV_DEMO_USER` flag (AGENTS.md) | FALSE_POSITIVE | Dead doc reference — **no backend code reads it**. Cannot inject anything. Stale documentation, not active residue. |

## Result

- LEGACY_DEMO_DATA: 0 (in code)
- UNSAFE_AUTOMATIC_MOCKS: 0 (nothing auto-creates sample data at startup/install)
- No startup code path auto-creates fake clients/demands/appointments/users/media/integrations.
- The only demo-data creator is `seed.ts`, which is an explicit manual dev tool (retained).

## Removals / changes

- FIXES_APPLIED: 0
- FILES_CHANGED: NONE
- BEHAVIOR_CHANGE: NO
- Nothing removed or disabled (no LEGACY_DEMO_DATA / UNSAFE_AUTOMATIC_MOCK found in code).

## Zero-state verification (reused from R2.P9 rerun — code unchanged)

Fresh disposable install (16 migrations, empty DB/Redis/bucket, backend start, official onboarding):
- Fresh install created **zero** fake users, clients, demands, appointments, media, or integrations.
- Only records present were those explicitly created via the API during the proof (Rerun Client, 3 contents, 1 appointment) + the required default workflow + provisioning user/company.
- DEFAULT_WORKFLOW_PRESENT: YES · ONBOARDING_PRESENT: YES · BOOTSTRAP_INTACT: YES
- FRESH_INSTALL_FAKE_USERS: 0 · FAKE_CLIENTS: 0 · FAKE_DEMANDS: 0 · FAKE_APPOINTMENTS: 0 · FAKE_MEDIA: 0 · FAKE_INTEGRATIONS: 0

## Active environment — cleanup candidates (reported, NOT deleted)

Read-only inventory of the active dev DB (no mutation):
- Demo company: "Loyal Tech" (slug `looply-studio` origin — seed residue, renamed historically)
- Demo users: natan@looply.dev, lucas@looply.dev, Isaac@looply.dev, marina@looply.dev, joao@looply.dev, ana@looply.dev
- Demo clients: Clínica Vitta, Studio Norte, Bistrô Onze, Academia Move, Restaurante Aurora, Restaurante do Gordão
- Demo content: 187 records in demo company
- Demo appointments: 638 in demo company

These are **ACTIVE_DATA_CLEANUP_CANDIDATES** for a **separate explicit cleanup task**. Not deleted here (per scope). ACTIVE_ENVIRONMENT_TOUCHED: NO (read-only inventory only).

## Validation

- BACKEND_TESTS: 481/481_PASS (no code change; existing evidence reused)
- FRONTEND_TESTS: 305/305_PASS (no code change)
- BACKEND_TYPECHECK: PASS (unchanged)
- BACKEND_BUILD: PASS (unchanged)
- DIFF_CHECK: PASS
- Fresh disposable install remains PASS (R2.P9 rerun, code unchanged)

## Result

RESULT: PASS
DATA_CREATORS_INSPECTED: 5
REQUIRED_BOOTSTRAP: 3 (provisionWorkspace, ensureDefaultWorkflow, onboarding)
OPTIONAL_DEVELOPMENT_SEEDS: 1 (seed.ts — manual, retained)
TEST_ONLY_DATA: 1 (frontend test fixtures)
LEGACY_DEMO_DATA: 0
UNSAFE_AUTOMATIC_MOCKS: 0

FIXES_APPLIED: 0
FILES_CHANGED: NONE
BEHAVIOR_CHANGE: NO

FRESH_INSTALL_FAKE_USERS: 0
FRESH_INSTALL_FAKE_CLIENTS: 0
FRESH_INSTALL_FAKE_DEMANDS: 0
FRESH_INSTALL_FAKE_APPOINTMENTS: 0
FRESH_INSTALL_FAKE_MEDIA: 0
FRESH_INSTALL_FAKE_INTEGRATIONS: 0

DEFAULT_WORKFLOW_PRESENT: YES
ONBOARDING_PRESENT: YES
BOOTSTRAP_INTACT: YES

ACTIVE_DATA_CLEANUP_CANDIDATES: demo company + 6 demo users + 6 demo clients + 187 contents + 638 appointments (reported, not deleted)
ACTIVE_ENVIRONMENT_TOUCHED: NO

BACKEND_TESTS: 481/481_PASS
FRONTEND_TESTS: 305/305_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

REMAINING_MOCK_FINDINGS: 0
MOCK_FREE_INSTALL: YES
R2_P10_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_ACTIVE_DATA_CLEANUP_REVIEW

REPORT: .dev-reports/looply-v1-r2-p10-mock-data-cleanup.md
GIT_STATE: no source/script changes; reports (M1/M2/P9/P9-rerun + this) untracked; HEAD ffe3f82
KORE_TOUCHED: NO

LOOPLY R2.P10 MOCK DATA CLEANUP — COMPLETE