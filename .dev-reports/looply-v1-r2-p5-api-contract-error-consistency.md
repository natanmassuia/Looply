# R2.P5 — API Contract / Error Consistency

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** eb5d562

## Canonical error model

Single global shape produced by `errorHandler` (`backend/src/lib/errors.ts`):
`{ error: { code, message, requestId?, details?, stack?(dev-only 5xx) } }`.

- `AppError` carries `status` + `code`; thrown everywhere via helpers: `badRequest`(400/`bad_request`), `unauthorized`(401), `forbidden`(403), `notFound`(404), `conflict`(409), `tooManyRequests`(429).
- `toAppError` maps body-parser (`entity.parse.failed`→400, `entity.too.large`→413) and Prisma (P2025→404, P2002→409, validation→400) before the generic 500.
- Middleware: `requireAuth` → 401, `requirePasswordChanged`/`requireWorkspaceActive`/`requireCapability`/`requireRole` → 403.
- No route leaks stack traces / Prisma internal names / raw parser messages (verified in earlier R2.P3 battery).

## Representative paths inspected

1. auth (routes/auth.ts, middleware/requireAuth.ts)
2. clients (routes/clients.ts + clientService.ts)
3. content/jobs (routes/contents.ts, routes/jobs.ts, contentService.ts, jobService.ts, domain/workflow.ts)
4. appointments (routes/appointments.ts, appointmentService.ts)
5. approvals/workflow (routes/approvals.ts, approvalsInternal.ts, workflows.ts, workflowService.ts)
6. team/members (routes/team.ts, members.ts)
7. media/files (routes/media.ts, files.ts, identityMediaService.ts, attachmentService.ts)
8. public/integration (routes/approvals.ts public, whatsappWebhook.ts)

## Classifications

| Surface | Classification | Notes |
|---|---|---|
| 400 vs 404 vs 409 vs 422 | SAFE (2 fixed) | 404 = missing/tenant-hidden resource; 409 = domain-state/conflict; 400 = validation/input. Two real inconsistencies found and fixed (below). No 422 in use (400 only) — consistent, not a defect. |
| Authorization 401 vs 403 | SAFE | 401 = not authenticated; 403 = authenticated but not permitted (role/capability/workspace-active/password-pending). Consistent. |
| Not-found behavior | SAFE | Tenant-scoped `findFirst({ id, companyId })` → 404 uniformly; no existence leak. Public approval token 404. |
| Validation errors | SAFE (1 fixed) | Zod parse → 400 `validation_error` via `parse()`; GET filter whitelists → 400. One misalignment fixed (appointments filter). |
| Conflict/domain-state errors | SAFE (1 fixed) | **CONFIRMED_DEFECT fixed**: `TransitionError` (invalid content-status transition) extended plain `Error` → reached errorHandler as 500. Now carries `status:409, code:"invalid_state"` → 409 conflict. |
| Generic 500 error shape | SAFE | Uniform `{ error: { code:"internal_error", message:"Erro interno do servidor" } }`; no internals. |
| Error response payloads | CONSISTENT (after fixes) | All JSON error routes emit `{ error: { code, message } }`; webhook/auth-simple routes use plain-text/send intentionally (non-JSON consumers). |

## Confirmed contract defects & fixes

1. **Invalid content-status transitions returned 500** (CONFIRMED_CONTRACT_DEFECT).
   `domain/workflow.ts` `TransitionError` extended plain `Error` with no `status`/`code`, so `assertCanTransition` failures (used by `moveToReview`, `sendForApproval`, `schedule`, `publish`) fell through `errorHandler` to a 500. Equivalent to the already-correct `createVersion` path (explicit `AppError(409, "invalid_state")`), so this was contradictory semantics for the same domain condition.
   **Fix:** added `status: 409` + `code: "invalid_state"` to `TransitionError`. Minimal; errorHandler's existing first branch now maps it to 409.

2. **Appointments invalid-status filter returned a divergent error contract** (CONFIRMED_CONTRACT_DEFECT).
   `routes/appointments.ts` returned `400 / "bad_request" / "Invalid status"` while `contents.ts` and `clients.ts` return `400 / "validation_error" / "status inválido"` for the identical invalid-enum-filter condition.
   **Fix:** aligned to `validation_error` / `status inválido`.

## Frontend impact

Frontend `lib/api.ts` reads `error.code`/`error.status` generically via `ApiError`; `409` is already in `NO_RETRY_STATUSES`, and no caller branches on the two changed codes/messages. Grep found no frontend reference to `bad_request`/`Invalid status`/`validation_error`. No frontend consumer changed → no frontend edits or frontend test run required.

## Regression tests

- `tests/hardening.test.ts` (DB-free): added "invalid content-state transitions surface as 409 conflict, not 500" — drives `TransitionError` through `errorHandler`, asserts 409.
- `tests/appointmentsRoute.test.ts` (DB-gated, consistent with file): added "GET list rejects an invalid status filter with validation_error" — asserts 400 + `validation_error`.

## Validation

| Check | Result |
|---|---|
| Focused hardening tests | PASS (11/11) |
| Full backend suite | PASS (481/481) |
| Backend typecheck | PASS |
| Backend build | PASS |
| Frontend tests | N/A (no frontend contract consumer changed) |
| git diff --check | PASS |

## Remaining differences (intentional, not defects)

- Webhook routes (`whatsappWebhook`, `whatsappGupshupWebhook`) respond plain-text/status (`401`/`403`/`400`/`503`) rather than JSON `{ error }` — deliberate: provider integrations expect HTTP status + minimal bodies, not the JSON API error shape.
- `team.ts` returns `410 gone` for the removed legacy user-creation route — intentional deprecation contract.
- `storage.ts` throws `AppError(503, "storage_unavailable")` — intentional service-unavailable signal, distinct from `internal_error`.
- `assistant.ts` uses a bespoke `{ ok:false, error:{code,message} }` envelope (assistant command protocol), not the global `{ error }` shape — intentional, separate domain contract.
- `health.ts` returns `{ status }` — intentional, not the API error envelope.

## Files changed

- `backend/src/domain/workflow.ts` (+4: TransitionError status/code)
- `backend/src/routes/appointments.ts` (2 lines: filter error contract)
- `backend/tests/hardening.test.ts` (+1 regression test)
- `backend/tests/appointmentsRoute.test.ts` (+1 regression test)

## Git state

Modified (unstaged): the 4 files above. Untracked: `.dev-reports/looply-v1-r2-m1-*.md`, `-m2-*.md` (unrelated), this report. Nothing staged/committed. HEAD still `eb5d562`.

## Result

RESULT: PASS
CANONICAL_ERROR_MODEL: `{ error: { code, message, requestId?, details? } }` via errorHandler
PATHS_INSPECTED: 8
CONFIRMED_FINDINGS: 2
FALSE_POSITIVES: 0

AUTH_STATUS_CONSISTENCY: PASS
NOT_FOUND_CONSISTENCY: PASS
VALIDATION_STATUS_CONSISTENCY: PASS
CONFLICT_STATUS_CONSISTENCY: PASS
ERROR_RESPONSE_SHAPE: CONSISTENT
INTERNAL_ERROR_LEAKAGE: NO

FIXES_APPLIED: 2
FILES_CHANGED: workflow.ts, appointments.ts, hardening.test.ts, appointmentsRoute.test.ts
FRONTEND_IMPACT: NONE
SCHEMA_CHANGE: NO
MIGRATION: NO
NEW_DEPENDENCY: NO

FOCUSED_TESTS: PASS
BACKEND_TESTS: ALL_PASS (481/481)
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
FRONTEND_TESTS: N/A
DIFF_CHECK: PASS

REMAINING_CONTRACT_FINDINGS: 0
R2_P5_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT
REPORT: .dev-reports/looply-v1-r2-p5-api-contract-error-consistency.md
GIT_STATE: modified workflow.ts + appointments.ts + 2 test files; reports untracked; not staged/committed
KORE_TOUCHED: NO

LOOPLY R2.P5 API CONTRACT ERROR CONSISTENCY — COMPLETE