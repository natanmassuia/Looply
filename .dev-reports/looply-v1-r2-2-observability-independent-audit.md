# Looply — V1-R2.2 Observability Independent Audit

Date: 2026-08-19 · Branch: `main` @ `2d4909e` · Audit only — no source modified, no commit, no push, no stage. `KORE_TOUCHED: NO`.

Purpose: independently audit the uncommitted R2.2 observability & alerting work against the 12
invariants, verify the R2.2 PARTIAL classification, and confirm it is safe to consolidate.

## Baseline

- HEAD `2d4909e807c1443800b691fb85c0d043eea532df` (unchanged, == origin/main).
- R2.2 changed files: `errors.ts`, `requestLogger.ts`, `requireAuth.ts`, `server.ts` (modified),
  `errorReporter.ts`, `observability.test.ts` (new).
- `git diff --check`: PASS (exit 0).
- No frontend / schema / migration / package.json changes (scope clean).

## Invariant 1 — Request correlation: PASS

- `requestId.ts` (pre-existing, preserved): generates a fresh UUID by default; accepts an incoming
  `x-request-id` ONLY if it matches `^[A-Za-z0-9_-]{8,64}$`; otherwise regenerates. No injection
  vector — restricted to URL-safe alphanumerics, cannot carry newlines/JSON structure.
- Set in the `x-request-id` response header and in `res.locals.requestId`.
- The SAME id reaches request logs (`requestLogger` reads `res.locals.requestId`) and error logs
  (`errorHandler` reads `res.locals.requestId`). Verified by test (header echoed + logged).

## Invariant 2 — Tenant correlation: PASS

- `requireAuth.ts` sets `res.locals.companyId = result.auth.companyId` exclusively from the
  authenticated `AuthContext` (session). Body/query/header company ids are never consulted — no
  client-supplied tenant can override it.
- `requestLogger.ts` emits `companyId` from `res.locals` on `finish`. Only the company *id* (an
  identifier, not a name/email) is logged. `PII_LOGGING_EXPANDED: NO`.

## Invariant 3 — API error path: PASS

- `errorHandler` (5xx) logs structured context: requestId, companyId, method, path, errorName,
  status, code, stack; and routes through `reportError`.
- Clients receive only `{code, message, requestId}` (+ `details` from AppError); stack is exposed
  to clients ONLY in `NODE_ENV=development` (pre-existing behavior). `CLIENT_ERROR_LEAKAGE: NO`.
- Expected 4xx AppErrors are only logged/reported when `status >= 500`, so client errors are NOT
  incorrectly escalated as fatal. Verified by test (404 AppError → no reporter call).

## Invariant 4 — Global process handlers: PASS

- Both `unhandledRejection` and `uncaughtException` are registered in `server.ts`.
- Each logs (errorName, message, stack — no secrets), routes through `reportError`
  (`component: "process"`), then `process.exit(1)`.
- `uncaughtException` exits → does NOT keep the process running unsafely.
- Existing graceful shutdown (SIGINT/SIGTERM → server.close → prisma.$disconnect → exit 0) is
  untouched. `GRACEFUL_SHUTDOWN_PRESERVED: YES`.
- **No recursion risk:** `reportError` wraps the active reporter in try/catch, so a failing reporter
  cannot re-trigger `uncaughtException`. The log fields are primitives (Error message/name/stack
  coerced to strings), so `JSON.stringify` cannot throw on them.

## Invariant 5 — errorReporter seam: PASS

- `errorReporter.ts`: `active` reporter is nullable; `setErrorReporter(fn|null)` toggles it;
  `reportError` is a no-op when no transport is configured (handled safely).
- Reporter failure cannot crash or recurse (try/catch inside `reportError`).
- No business logic depends on it — it is fire-and-forget called only at failure points.
- Entry fields are non-secret (message, errorName, code, requestId, companyId, method, path,
  status, error). No hardcoded vendor.
- `REPORTER_RECURSION_RISK: NONE` · `REPORTER_VENDOR_COUPLING: NONE`.

## Invariant 6 — Redaction: PASS

- `logger.ts` SENSITIVE_KEYS: `authorization, cookie, set-cookie, password, token, secret, apikey,
  api_key` — covers authorization headers, passwords, session tokens (token/cookie), approval
  tokens (token), API/provider secrets (secret/apikey/api_key).
- `DATABASE_URL` and storage credentials are never logged anywhere in `backend/src` (verified by
  grep — no `logger`/`console` reference to them). Verified by test (nested secrets redacted).

## Invariant 7 — Provider failures: PASS

- Provider transports (`whatsappProvider`, `gupshupProvider`, `assistantLanguageModel`,
  `whatsappIdempotencyStore`) contain NO logging → no body/credential leakage.
- WhatsApp webhook logs `whatsapp_inbound_failed` with masked sender (last 4 digits) + error
  detail, never the full payload.
- Provider errors propagate to the enriched `errorHandler` (requestId/companyId/method/path/
  errorName/status) when surfaced through routes.

## Invariant 8 — Health/readiness: PASS

- `/health` — liveness, no DB touch, 200 `{status:ok}`.
- `/health/ready` — DB round-trip, 200 ready / 503 unavailable (dependency failure → non-200).
- No secret/config dump. No change was needed.

## Invariant 9 — Worker classification: 0 workers

- No background workers/jobs exist: no `setInterval`, `new Worker`, queue, or scheduler in
  `backend/src`. The only `setTimeout` is the graceful-shutdown force-timer. The `scheduledAt`
  matches are data fields, not job runners. Nothing to instrument. No invented work.

## Invariant 10 — Test quality: PASS

`observability.test.ts` (7 tests) proves the guarantees, not just 200 responses:
- request ID set + echoed in header + logged (correlation);
- safe incoming id accepted / unsafe rejected with fresh id (spoofing/injection guard);
- error reporter invoked on unexpected 5xx WITH request+route+tenant context;
- 4xx AppErrors NOT reported (no false escalation);
- requestLogger emits companyId from res.locals (tenant source);
- redaction effective (nested secrets redacted).
Global-handler exit behavior is not unit-tested (would require mocking `process.exit`), but
reporter behavior on the error path IS tested, which satisfies the "global handlers OR reporter
behavior" requirement.

## Invariant 11 — Scope: clean

- Modified/new files: only observability (errors, requestLogger, requireAuth, server, errorReporter,
  observability test). No frontend, schema, migration, business-logic redesign, logging-framework
  replacement, or unrelated refactor. No new dependency.

## Invariant 12 — Existing suite failure: PRE_EXISTING_UNRELATED

- Full backend: 471 passed, 1 failed at `tests/jobsWorkflow.test.ts:28` (workflow stage-name
  comparison: a `"Teste"` stage vs expected `DEFAULT_WORKFLOW_STAGES.MARKETING_AGENCY`).
- Reproduces in isolation (zero interference from R2.2 files). R2.2 does not touch workflow
  domain/data. `jobsWorkflow.test.ts` imports `app/prisma/authService/session/jobWorkflow` — none
  of which are the R2.2-changed files. Last touched in commit `6fe8022` (unrelated). **Not
  introduced by R2.2; not fixed per audit scope.**

## Validation run

- `git status --short` — R2.2 files + reports only.
- `git diff --check` — PASS (exit 0).
- `vitest run tests/observability.test.ts` — 7/7 PASS.
- `npm run typecheck` — PASS (exit 0).
- Read-only inspection of all changed + supporting files (errors, requestLogger, requireAuth,
  server, errorReporter, requestId, logger, health, provider services, whatsappWebhook,
  jobsWorkflow.test.ts imports).
- No dependencies added; full suite not re-run (evidence from R2.2 session consistent and
  uncontradicted).

## Findings

- **CRITICAL: 0**
- **HIGH: 0**
- **MEDIUM: 0**
- No real defects found. One informational note (not a defect): the global-process log fields are
  primitives so `JSON.stringify` in the logger cannot throw and recurse into `uncaughtException`;
  behavior is already safe.

## B3 decision

Application observability is correct and a pluggable error-monitoring/alerting seam is implemented.
No external transport is configured/proven in this environment. Per the B3 rule (do not clear B3
when no external delivery is proven): **`RELEASE_BLOCKER_B3: PARTIAL`** — not cleared.
`ALERT_DELIVERY_PROVEN: NO`.

## Result

```
CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0

REQUEST_CORRELATION: PASS
TENANT_CORRELATION: PASS
CLIENT_ERROR_LEAKAGE: NO

UNHANDLED_REJECTION: PASS
UNCAUGHT_EXCEPTION: PASS
GRACEFUL_SHUTDOWN_PRESERVED: YES

ERROR_REPORTER_SAFE: PASS
REPORTER_RECURSION_RISK: NONE
REPORTER_VENDOR_COUPLING: NONE

LOG_REDACTION: PASS
PII_LOGGING_EXPANDED: NO

PROVIDER_FAILURE_VISIBILITY: PASS
HEALTH_ENDPOINT: PASS
READINESS_ENDPOINT: PASS

WORKERS_REQUIRING_INSTRUMENTATION: 0

TEST_QUALITY: PASS
FULL_SUITE_FAILURE_CLASSIFICATION: PRE_EXISTING_UNRELATED

BACKEND_CHANGE: YES
FRONTEND_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
NEW_DEPENDENCY: NO

ALERT_DELIVERY_PROVEN: NO
RELEASE_BLOCKER_B3: PARTIAL

R2_2_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
KORE_TOUCHED: NO
```

## Git state

```
HEAD:          2d4909e807c1443800b691fb85c0d043eea532df (unchanged)
Changed:       R2.2 source (4 modified + 2 new) + reports; nothing staged/committed
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: R2.2 report, `errors.ts`, `requestLogger.ts`, `requireAuth.ts`, `server.ts`,
  `errorReporter.ts`, `requestId.ts`, `logger.ts`, `health.ts`, provider services,
  `whatsappWebhook.ts`, `observability.test.ts`, `jobsWorkflow.test.ts` (imports).
- Ran: `git status`, `git diff --check`, focused observability tests, backend typecheck.
- No secrets printed; no tenant PII printed; no source modified.

---

LOOPLY V1-R2.2 OBSERVABILITY INDEPENDENT AUDIT — PASS