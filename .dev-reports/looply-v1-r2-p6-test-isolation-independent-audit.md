# R2.P6 — Test Isolation / Flakiness — Independent Audit

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** 2d8ee41

## Audit scope

- `.dev-reports/looply-v1-r2-p6-test-isolation-flakiness.md`
- Relevant suites referenced: calendar.test.ts, jobsWorkflow.test.ts, auth.test.ts, observability.test.ts, transientState.test.ts, reconciliation.test.ts, contentService.test.ts, appointmentsRoute.test.ts, workflowCoherenceDb.test.ts
- No new open-ended sweep; no source/test changes (no defect was confirmed in R2.P6).

## 1. Seven suspicious cases — false-positive review

| Case | Classification confirmed | Evidence |
|---|---|---|
| Shared dev DB state | SAFE | DB suites create/delete their own fixtures or clean up via `afterAll`; known jobsWorkflow issue already fixed at test-contract level. |
| Order dependence | SAFE | `jobsWorkflow` transition test asserts only tenant-scoping/ownership, not specific rows; `calendar` uses `orderBy: { id: "asc" }` (deterministic). No test asserts a specific pre-existing row's mutable field that another suite mutates. |
| Time sensitivity | SAFE | `auth.test.ts` uses relative times (`Date.now() + 1h`); calendar uses fixed 2026 ranges (unaffected by wall clock). |
| Randomness | SAFE | Tests reference returned ids, never hardcoded values; `Date.now()`-suffixed client names avoid collisions. |
| Mock/spy/timer leaks | SAFE | `observability.test.ts` restores all mocks + error reporter in `afterEach`; no `vi.useFakeTimers` anywhere. |
| Env/global mutation | SAFE | No `process.env` mutation; only `errorReporter`, restored per-test. |
| Async teardown leaks | SAFE | Sessions logged out, fixtures deleted; no open handles. |

**FALSE_POSITIVES_CONFIRMED: YES** — all 7 correctly classified.

## 2. Documented latent risk — exact classification

**The risk:** `calendar.test.ts` mutation test (lines 55-69) picks an arbitrary job via `prisma.job.findFirst` (no `orderBy`) and sets its `scheduledAt` to `2026-08-30T15:00:00.000Z`. The `afterAll` (lines 71-75) restores a job by fuzzy title `contains: "Campanha Dia dos Pais"`. **If `findFirst` returns a different job, that arbitrary job's `scheduledAt` is never restored** — a persistent shared-dev-DB pollution leak.

**Failure-potential analysis:** Does this cause nondeterministic test failures under normal execution?
- The leaked SCHEDULED event lands at `2026-08-30` — outside every asserted calendar range (all fixed within 08-16..08-31 with no exact-count assertion spanning 08-30).
- First calendar test asserts `events.length > 0` (weak, always true) and tenant isolation — unaffected.
- `workflowCoherenceDb.test.ts` line 148 asserts `after?.scheduledAt` is `null` — but on a **freshly created** content row, never the leaked pre-existing job.
- No test asserts a specific pre-existing job's `scheduledAt` value or an exact event list including 08-30.

**Conclusion:** the leak causes dev-DB **pollution**, not nondeterministic **failures**. It does not meet the bar for "realistically cause nondeterministic failures under normal test execution." It is consistent with the pre-existing shared-dev-DB history already addressed at the test-contract level.

**Classification: ACCEPTABLE_LATENT_RISK**
**LATENT_RISK_RELEASE_BLOCKING: NO**

## 3. Isolation guarantees — verified

- SHARED_DB_STATE: SAFE (no order dependence demonstrated; no assertion depends on a leaked value)
- ORDER_DEPENDENCE: SAFE
- TIME_SENSITIVITY: SAFE
- RANDOMNESS: SAFE
- MOCK_TIMER_LEAKS: SAFE
- ENV_GLOBAL_LEAKS: SAFE
- ASYNC_RESOURCE_LEAKS: SAFE
- ASSERTIONS_WEAKENED: NO
- RETRIES_ADDED: NO
- TIMEOUTS_INCREASED: NO

## 4. Repeated-run evidence (unchanged — no source/test changes)

- REPEATED_RUN_1: PASS (7 files, 69 tests)
- REPEATED_RUN_2: PASS (7 files, 69 tests)
- REPEATED_RUN_3: PASS (7 files, 69 tests)
- BACKEND_TESTS: 481/481_PASS
- BACKEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- DIFF_CHECK: PASS

## Result

RESULT: PASS
SUITES_REVIEWED: 9
SUSPICIOUS_CASES_REVIEWED: 7
FALSE_POSITIVES_CONFIRMED: YES

LATENT_RISK: calendar.test.ts afterAll restore targets "Campanha" job while mutation targets arbitrary findFirst job
LATENT_RISK_CLASSIFICATION: ACCEPTABLE_LATENT_RISK
LATENT_RISK_RELEASE_BLOCKING: NO

SHARED_DB_STATE: SAFE
ORDER_DEPENDENCE: SAFE
TIME_SENSITIVITY: SAFE
RANDOMNESS: SAFE
MOCK_TIMER_LEAKS: SAFE
ENV_GLOBAL_LEAKS: SAFE
ASYNC_RESOURCE_LEAKS: SAFE

ASSERTIONS_WEAKENED: NO
RETRIES_ADDED: NO
TIMEOUTS_INCREASED: NO

REPEATED_RUN_1: PASS
REPEATED_RUN_2: PASS
REPEATED_RUN_3: PASS

BACKEND_TESTS: 481/481_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

CONFIRMED_ISOLATION_DEFECTS: 0
CONFIRMED_FLAKINESS: 0
REMAINING_TEST_FINDINGS: 0

R2_P6_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
REPORT: .dev-reports/looply-v1-r2-p6-test-isolation-independent-audit.md
GIT_STATE: no source/test changes; reports (M1/M2/P5/P6 + this) untracked; HEAD still 2d8ee41
KORE_TOUCHED: NO

LOOPLY R2.P6 TEST ISOLATION INDEPENDENT AUDIT — PASS