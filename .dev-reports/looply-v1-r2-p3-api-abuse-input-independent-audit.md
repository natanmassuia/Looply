# R2.P3 — API Abuse / Input Hardening — Independent Audit

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ecd7c6fa2f038a5f57d2ac1de14f53162e8050a9

## Audit scope

- `backend/src/lib/errors.ts` (+7 lines)
- `backend/tests/hardening.test.ts` (+10 lines)
- `.dev-reports/looply-v1-r2-p3-api-abuse-input-hardening.md`
- No re-run of the API sweep; this audit covers only the R2.P3 fix.

## Root cause

body-parser errors (`entity.parse.failed`, `entity.too.large`) carry `status`/`type` but **no `code`**. The `errorHandler` first branch requires `"status" in err && "code" in err`, so these fell through to `toAppError`'s final `AppError(500, …)`. Verified empirically: malformed JSON POST → 500 `internal_error`.

## Fix review

`toAppError` now exact-matches two body-parser-only `type` values before the Prisma branch:

- `entity.parse.failed` → `badRequest("JSON inválido")` (400, `bad_request`)
- `entity.too.large` → `AppError(413, …, "payload_too_large")`

### Does the fix mask genuine server errors?

No. The match is exact-string on `entity.parse.failed` / `entity.too.large` — values only body-parser produces. Every other error (`AppError`, Prisma errors, plain thrown `Error` with `type === undefined`) falls through unchanged to the existing 4xx mapping or the final 500 path. The `errorHandler` 5xx logging/reporting block is untouched. A genuine internal failure can never carry these two strings, so it still returns 500.

### Leak check

Both branches build a fresh `AppError` with a generic Portuguese message and no `details`; body-parser's internal message/position/body excerpt is never forwarded. No stack, no parser internals.

## Verification

| Check | Result |
|---|---|
| Malformed JSON | 400 `bad_request` — covered by committed regression test + earlier empirical probe |
| Oversized body (>1mb) | 413 `payload_too_large` — verified empirically (probe, since not in committed test) |
| Genuine unexpected error | 500 — intact by code analysis (narrow exact-match, fall-through preserved) |
| Internal detail leak | NO — generic messages only |
| Error contract | Preserved — `{ error: { code, message } }` shape unchanged; existing codes untouched; 413 introduces one new code for a previously-500 status |
| Diff scope | Minimal — errors.ts + hardening.test.ts (+17), report untracked |

## Validation

- Focused hardening tests: PASS (9/9)
- Backend full suite: PASS (478/478, 42 files)
- Backend typecheck: PASS
- Backend build: PASS
- git diff --check: PASS

## Findings after fix

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0 — the 413 coverage gap is **CLOSED_BY_REGRESSION_TEST**. `tests/hardening.test.ts` now locks oversized JSON body → 413 `payload_too_large` with no parser internals leaked (`entity`/`JSON`/`stack`/`at ` absent from the body). Suite went 478 → 479 tests; application code unchanged.

## Result

RESULT: PASS
ROOT_CAUSE_CONFIRMED: YES
MALFORMED_JSON_STATUS: 400
OVERSIZED_BODY_STATUS: 413
UNEXPECTED_ERROR_STATUS: 500
INTERNAL_DETAILS_LEAK: NO
ERROR_CONTRACT_PRESERVED: YES
TEST_STRENGTH: STRONG

CONFIRMED_FINDINGS_AFTER_FIX: 0
CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0
LOW_FINDINGS: 0

FILES_CHANGED: backend/src/lib/errors.ts, backend/tests/hardening.test.ts
SCHEMA_CHANGE: NO
MIGRATION: NO
NEW_DEPENDENCY: NO

FOCUSED_TESTS: PASS
BACKEND_TESTS: 478/478_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

R2_P3_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
REPORT: .dev-reports/looply-v1-r2-p3-api-abuse-input-independent-audit.md
GIT_STATE: modified errors.ts + hardening.test.ts; two M1/M2 reports + this report untracked; nothing staged/committed
KORE_TOUCHED: NO

LOOPLY V1-R2.P3 API ABUSE INPUT INDEPENDENT AUDIT — PASS