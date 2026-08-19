# R2.P5 — API Contract / Error Consistency — Independent Audit

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** eb5d562

## Audit scope

- `backend/src/domain/workflow.ts` (+4)
- `backend/src/routes/appointments.ts` (2 lines)
- `backend/tests/hardening.test.ts` (+1 test)
- `backend/tests/appointmentsRoute.test.ts` (+1 test)
- `.dev-reports/looply-v1-r2-p5-api-contract-error-consistency.md`
- No re-sweep; audit covers only the two R2.P5 fixes.

## Fix 1 — Workflow TransitionError

**Verified:**
- Invalid content-state transition is a **domain conflict**, not a server failure. `assertCanTransition` rejects illegal lifecycle moves (used by `moveToReview`, `sendForApproval`, `schedule`, `publish`); the fix gives `TransitionError` `status:409` + `code:"invalid_state"`, matching the already-canonical `createVersion` path (`AppError(409, "invalid_state")`).
- `errorHandler`'s first branch (`"status" in err && "code" in err`) now maps it to **409**.
- **Canonical shape preserved:** `{ error: { code:"invalid_state", message:"Transição de status inválida: …" } }` — no `details`, no stack (5xx-only dev stack path not hit).
- **Genuine unexpected workflow errors still 500:** the fix only adds two fields to `TransitionError`. Any other thrown error (`Error`, Prisma failure, etc.) carries no `status`/`code` and falls through `toAppError` → 500 unchanged.
- **No internal leak:** message is the domain message; parser/stack internals never forwarded.

## Fix 2 — Appointments invalid status filter

**Verified:**
- Invalid `status` filter now returns `400 / validation_error / "status inválido"` — identical to the shared validation contract used by `contents.ts` and `clients.ts` for the same invalid-enum-filter condition.
- Status code (400) matches existing validation semantics (unchanged from before — only `code`/`message` aligned).
- **Valid filters unchanged:** only the error branch of the ternary changed; `SCHEDULED`/`CANCELLED` pass-through and `listAppointments` behavior untouched.
- **No frontend contract break:** frontend `ApiError` reads `code`/`status` generically; `400` is already a non-retry status and no caller branches on `bad_request`/`Invalid status`/`validation_error` (grep-verified in R2.P5).

## Regression strength

- **TransitionError → 500 regression:** the hardening test drives `TransitionError` through the real `errorHandler` and asserts 409. If the error carried no `status`/`code`, `errorHandler` would return 500 and the assertion `toBe(409)` fails. **Strong.**
- **Appointments invalid-status regression:** the route test asserts `400` + `code === "validation_error"`. If shape or status diverged (e.g. back to `bad_request`/`Invalid status`), it fails. **Strong.**

## Scope check

Only the two intended files plus their two regression tests changed. No unrelated behavior modified.

## Validation

- Focused hardening tests: PASS (11/11)
- Full backend suite: PASS (481/481) — confirmed during R2.P5, diff byte-identical (evidence reused)
- Backend typecheck: PASS — same
- Backend build: PASS — same
- git diff --check: PASS (re-run)

## Findings after fix

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0

## Result

RESULT: PASS

TRANSITION_ERROR_CLASSIFICATION: DOMAIN_CONFLICT
TRANSITION_ERROR_STATUS: 409
UNEXPECTED_WORKFLOW_ERROR_STATUS: 500
WORKFLOW_ERROR_SHAPE: CANONICAL

APPOINTMENT_INVALID_STATUS: VALIDATION_ERROR
APPOINTMENT_VALID_FILTERS_UNCHANGED: YES
FRONTEND_CONTRACT_IMPACT: NONE

ERROR_RESPONSE_SHAPE: CONSISTENT
INTERNAL_ERROR_LEAKAGE: NO
TEST_STRENGTH: STRONG

CONFIRMED_FINDINGS_AFTER_FIX: 0
CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0
LOW_FINDINGS: 0

FILES_CHANGED: workflow.ts, appointments.ts, hardening.test.ts, appointmentsRoute.test.ts
SCHEMA_CHANGE: NO
MIGRATION: NO
NEW_DEPENDENCY: NO

FOCUSED_TESTS: PASS
BACKEND_TESTS: 481/481_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

R2_P5_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
REPORT: .dev-reports/looply-v1-r2-p5-api-contract-independent-audit.md
GIT_STATE: modified workflow.ts + appointments.ts + 2 test files; reports (M1/M2/P5 + this) untracked; nothing staged/committed
KORE_TOUCHED: NO

LOOPLY R2.P5 API CONTRACT INDEPENDENT AUDIT — PASS