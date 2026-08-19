# Looply — V1-R2.2 Observability & Alerting

Date: 2026-08-19 · Branch: `main` @ `2d4909e` · No commit, no push, no stage. `KORE_TOUCHED: NO`.

## Prior gaps (from R2 audit)

The R2 security-readiness audit (`looply-v1-r2-release-security-readiness-audit.md`) identified
release blocker **B3 — Observability/alerting** and concrete gap **R2-08** (no
`unhandledRejection`/`uncaughtException` handlers; no alerting; production failures undetectable).
The M1 readiness audit confirmed observability/alerting can follow after migration but the
application-level baseline is required to close B3.

Current state before this work (verified by inspection):
- Structured logger with redaction — present (`logger.ts`).
- Request ID middleware — present (`requestId.ts`): server-generated UUID, accepts safe
  incoming `x-request-id` (regex-guarded), sets `x-request-id` response header, stored in
  `res.locals.requestId`.
- Request logging — present (`requestLogger.ts`): requestId, method, path (query stripped,
  approval token path redacted), status, durationMs.
- Error handler — present (`errors.ts`): 5xx logged with requestId+path+stack, never leaks
  stack/internals to clients.
- Health `/health` + readiness `/health/ready` — present (`health.ts`).
- Graceful shutdown — present (`server.ts`).

**Actual gaps filled (minimal, no redesign):**
1. No global `unhandledRejection`/`uncaughtException` handlers (R2-08) — **added**.
2. No tenant/company correlation in logs — **added** (from authenticated session context).
3. No pluggable error-monitoring/alerting seam — **added** (minimal, no dependency).
4. Error handler lacked tenant context + route/method/status for correlation — **enriched**.

## Architecture used

- Reused the existing structured `logger` (no new logging framework).
- Added `backend/src/lib/errorReporter.ts` — a tiny pluggable seam: `reportError(entry)` is
  called at failure points; a real transport (Sentry/Datadog/webhook) can be registered at boot
  via `setErrorReporter(fn)` **without changing business code**. Default reporter is a no-op
  (falls back to the logger, which already emitted the structured line). **No new dependency.**

## Request correlation — PASS

- Already supported and preserved: server-generated UUID when no safe incoming id, safe
  `x-request-id` accepted (regex `^[A-Za-z0-9_-]{8,64}$`), echoed in the `x-request-id` response
  header, and included in every request + error log.
- `REQUEST_ID_RESPONSE_HEADER: PASS`.

## Tenant correlation — PASS

- `requireAuth.ts` now sets `res.locals.companyId = result.auth.companyId` from the **authenticated
  session context** (`AuthContext`), never from body/query/header company ids. Only the company id
  (an identifier, not a name/email) is exposed.
- `requestLogger.ts` reads `res.locals.companyId` on `finish` and includes it in the request log
  line. Absent for unauthenticated/public requests.

## Global exception handling — PASS

- `server.ts` now registers `unhandledRejection` and `uncaughtException` handlers. Each logs with
  useful context (error name, message, stack — no secrets), routes through the error-reporting
  seam (`component: "process"`), then **exits(1)** so PM2 restarts a clean process — it does NOT
  silently keep running after an unsafe exception.
- Existing graceful shutdown on SIGINT/SIGTERM is **untouched** (`GRACEFUL_SHUTDOWN_PRESERVED: YES`).

## API error visibility — PASS

- `errorHandler` (5xx) now logs: requestId, companyId (if authenticated), method, path,
  errorName, status, code, stack; and routes through `reportError`. This answers what failed /
  when / request id / tenant / route-method / error type-message.
- `CLIENT_ERROR_LEAKAGE: NO` — stack traces and internals still never returned to clients; 4xx
  AppErrors are not reported through the seam (only unexpected 5xx).

## Worker / background failures

- **No background workers/jobs exist** in the codebase (the only `setTimeout` is the graceful
  shutdown force-timer). Nothing to instrument. Any thrown provider/async error propagates to the
  enriched `errorHandler` and is now logged+reported. `WORKER_FAILURE_VISIBILITY: N/A (none exist)`.

## Provider failure visibility — PASS

- WhatsApp webhook already logs `whatsapp_inbound_failed` with provider context + masked sender
  (last 4 digits only) — preserved.
- Assistant/Gupshup provider errors propagate to the enriched `errorHandler` (now with
  requestId/companyId/method/path/errorName/status). No credentials or message bodies logged.
  `PROVIDER_FAILURE_VISIBILITY: PASS`.

## Sensitive-data redaction — PASS (preserved, not weakened)

- `logger.redact` redacts `authorization, cookie, set-cookie, password, token, secret, apikey,
  api_key` recursively. Verified by test: nested secrets redacted, non-sensitive ids pass through.
- No new PII fields introduced. `PII_LOGGING_EXPANDED: NO`.

## Health / readiness — PASS (no change needed)

- `/health` — liveness, no DB touch, 200 `{status:ok}`.
- `/health/ready` — DB round-trip, 200 ready / 503 unavailable.
- No secret/config dump; no change required.

## Error monitoring / alerting capability

- `ERROR_MONITORING_CAPABILITY: IMPLEMENTED` (pluggable `reportError` seam, no vendor hard-wired).
- `ALERTING_CAPABILITY: IMPLEMENTED` (application-level hook exists; a future Contabo deployment
  registers a transport via `setErrorReporter`).
- `ALERT_DELIVERY_PROVEN: NO` — no external target/credentials available; no fake delivery claimed.

## Tests

Added `backend/tests/observability.test.ts` (7 tests, all pass):
- request id set + echoed in header + logged;
- safe incoming id accepted / unsafe rejected with fresh id;
- error reporter invoked on unexpected 5xx with request+route+tenant context;
- 4xx AppErrors NOT reported;
- requestLogger emits companyId from `res.locals` (authenticated context, not client input);
- redaction effective (nested secrets redacted).

Validation (sequential, resource-safe — 1.8Gi available):
- `vitest run tests/observability.test.ts` → 7/7 PASS
- relevant existing (health, hardening, env) → 18/18 PASS
- `npm run typecheck` → PASS (exit 0)
- `npm run build` → PASS (exit 0)
- full backend suite → 471 passed, **1 pre-existing failure** in `tests/jobsWorkflow.test.ts:28`
  (workflow stage-name comparison). Reproduced **in isolation** with zero interference from R2.2
  files; file last touched in commit `6fe8022` (unrelated). **Not introduced by this work.**
- `git diff --check` → PASS (exit 0)

## B3 decision

B3 (observability/alerting) requires production failures to be at least detectably surfaced AND a
usable alerting/error-monitoring path to exist. Detectability is now implemented (global handlers,
correlated logs, error-reporting seam). A usable pluggable alert path exists. However, **external
alert delivery is not proven** (no provider configured/credentialed in this environment).

Per task rule: if external delivery is the only missing item, classify **B3 PARTIAL** (not a
false CLEARED). **`RELEASE_BLOCKER_B3: PARTIAL`** — capability implemented; delivery proof pending
a real external target (can be a future Contabo/monitoring provider).

## Remaining limitations

- No external error-monitoring provider connected yet (seam ready; needs `setErrorReporter`
  transport at a future Contabo deployment).
- `ALERT_DELIVERY_PROVEN: NO` — no outbound alert channel proven.
- Pre-existing `jobsWorkflow.test.ts` failure unrelated to R2.2 (workflow-stage data/seed).
- No metrics (uptime/request counts) or alert thresholds — out of R2.2 scope.

## Files changed

```
Modified: backend/src/lib/errors.ts, backend/src/middleware/requestLogger.ts,
          backend/src/middleware/requireAuth.ts, backend/src/server.ts
New:      backend/src/lib/errorReporter.ts, backend/tests/observability.test.ts
```

`BACKEND_CHANGE: YES` · `FRONTEND_CHANGE: NO` · `SCHEMA_CHANGE: NO` · `MIGRATION: NO` ·
`NEW_DEPENDENCY: NO`.

## Git state

```
HEAD:          2d4909e807c1443800b691fb85c0d043eea532df (unchanged)
Changed:       4 backend source files + 2 new files (no stage/commit/push)
Untracked:     this report + M1/M2 reports
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: `app.ts`, `server.ts`, `logger.ts`, `errors.ts`, `requestId.ts`, `requestLogger.ts`,
  `requireAuth.ts`, `health.ts`, `authService.ts`, provider services (`whatsappProvider`,
  `gupshupProvider`, `mailService`, `assistantLanguageModel`), `assistant.ts`, `whatsappWebhook.ts`,
  existing tests (`health.test.ts`, `hardening.test.ts`).
- Ran: focused + relevant + full backend tests, typecheck, build, `git diff --check`.
- No secrets printed; no tenant PII printed; no source beyond the observability change touched.
