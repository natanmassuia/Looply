# R2.P6 — Test Isolation / Flakiness

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** 2d8ee41

## Test architecture inspected

- Vitest 3.2.7, `environment: node`, `globals: false`, no global setup file, no fake-timer setup.
- No `vi.useFakeTimers` anywhere → no fake-timer leak class.
- Two tiers:
  1. **In-memory fake-DB unit suites** (auth, contentService, transientState, reconciliation, appointmentService, attachments, etc.) — each test constructs its own fake DB/state; no cross-test leakage. Well isolated.
  2. **DB-gated suites** (`describe.skipIf(!process.env.DATABASE_URL)`) — hit the shared dev DB via `prisma`, using seeded demo users `natan@looply.dev` / `dono@testecorp.com`. Most perform explicit per-test cleanup (`cleanupJobs`/`cleanupClients` + `afterAll`) or create + delete their own fixtures.

## Representative suites inspected (8)

1. jobsWorkflow.test.ts
2. calendar.test.ts
3. appointmentsRoute.test.ts
4. auth.test.ts
5. observability.test.ts
6. transientState.test.ts
7. reconciliation.test.ts
8. contentService.test.ts

## Suspicious cases

| Case | Classification | Notes |
|---|---|---|
| Shared dev DB state across DB suites | SAFE (pre-existing, no defect) | Suites create/delete their own fixtures or clean up via `afterAll`. The known recurring jobsWorkflow failure from shared dev DB data was already fixed at the test-contract level; no new evidence of a remaining defect. |
| Order-dependent tests | SAFE | `jobsWorkflow` transition test reads `prisma.job.findFirst` (pre-existing data), but asserts only tenant-scoping/ownership, not specific rows — not order-fragile. `calendar` uses `orderBy: { id: "asc" }` (deterministic) instead of bare `findFirst`. |
| Time/date-sensitive tests | SAFE | `auth.test.ts` uses **relative** times (`Date.now() + 1h`), not absolute dates. `calendar` uses fixed ISO ranges in 2026 — unaffected by wall clock. |
| Random/non-deterministic data | SAFE | UUID/cuid ids via Prisma defaults; tests reference returned ids, not hardcoded values. `Date.now()`-suffixed client names avoid collisions. |
| Mock/spy/timer leaks | SAFE | `observability.test.ts` calls `vi.restoreAllMocks()` + `setErrorReporter(null)` in `afterEach`. No other suite mocks. No fake timers. |
| Shared env/global mutation | SAFE | No test mutates `process.env` or module globals except `errorReporter`, restored per-test. |
| Async teardown/resource leaks | SAFE | DB suites logout sessions + delete fixtures; no open handles observed. |

## Confirmed defects

None. All suspicious cases classified SAFE / FALSE_POSITIVE.

## Latent risk (documented, not a confirmed defect)

`calendar.test.ts` `afterAll` restores a job's `scheduledAt` by fuzzy `title: { contains: "Campanha Dia dos Pais" }`. If the suite aborts before `afterAll`, shared dev DB state could remain mutated. This is the known shared-dev-DB history already addressed at the test-contract level; it shows no current failure evidence across repeated runs. Not changed (would be touching a stable test without a confirmed defect).

## Fixes applied

None. Per scope: no defect confirmed → no source/test changes.

## Repeated-run evidence

Affected/representative suites run 3x consecutively:

- REPEATED_RUN_1: PASS (7 files, 69 tests)
- REPEATED_RUN_2: PASS (7 files, 69 tests)
- REPEATED_RUN_3: PASS (7 files, 69 tests)

Full backend suite: PASS (42 files, 481 tests).

## Validation

- BACKEND_TESTS: ALL_PASS (481/481)
- BACKEND_TYPECHECK: PASS (re-run)
- BACKEND_BUILD: PASS (re-run)
- DIFF_CHECK: PASS (no source/test changes)

## Files changed

None (no confirmed defect).

## Result

RESULT: PASS
TEST_ARCHITECTURE: vitest node env, no setup file, fake-DB unit tier + DB-gated integration tier
SUITES_INSPECTED: 8
SUSPICIOUS_CASES: 7
CONFIRMED_ISOLATION_DEFECTS: 0
CONFIRMED_FLAKINESS: 0
FALSE_POSITIVES: 7

SHARED_DB_STATE: SAFE
ORDER_DEPENDENCE: SAFE
TIME_SENSITIVITY: SAFE
RANDOMNESS: SAFE
MOCK_TIMER_LEAKS: SAFE
ENV_GLOBAL_LEAKS: SAFE
ASYNC_RESOURCE_LEAKS: SAFE

FIXES_APPLIED: 0
FILES_CHANGED: NONE
ASSERTIONS_WEAKENED: NO
RETRIES_ADDED: NO
TIMEOUTS_INCREASED: NO

REPEATED_RUN_1: PASS
REPEATED_RUN_2: PASS
REPEATED_RUN_3: PASS

BACKEND_TESTS: ALL_PASS
FRONTEND_TESTS: N/A (no frontend test changes)
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

REMAINING_TEST_FINDINGS: 0 (1 latent documented risk, not a confirmed defect)
R2_P6_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT
REPORT: .dev-reports/looply-v1-r2-p6-test-isolation-flakiness.md
GIT_STATE: no source/test changes; reports (M1/M2/P5/P6 + this) untracked; HEAD still 2d8ee41
KORE_TOUCHED: NO

LOOPLY R2.P6 TEST ISOLATION FLAKINESS — COMPLETE