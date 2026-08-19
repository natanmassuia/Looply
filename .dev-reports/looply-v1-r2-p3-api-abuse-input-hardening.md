# R2.P3 — API Abuse / Input Hardening

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ecd7c6fa2f038a5f57d2ac1de14f53162e8050a9

## Scope inspected

- Validation helpers: `src/lib/validation.ts`, `src/lib/parse.ts`, `src/lib/errors.ts`
- Routes: contents, clients, appointments, calendar, jobs, workflows, team, members, media, files, settings, assistant, dashboard, approvals (public), approvalsInternal, invitations, onboarding, auth, whatsappIdentities, whatsappWebhook, whatsappGupshupWebhook
- Services: contentService, clientService, jobService, calendarService, activityService, attachmentService, identityMediaService, workflowService, assistantCommandService, assistantLanguageAdapter

## Surface classifications

| Surface | Classification | Notes |
|---|---|---|
| Pagination limits | SAFE | jobs/appointments `limit` clamped to 100 (`Math.min(100, …)`); activity `limit`/`offset` coerced + capped at 100 in `listJobActivities`; calendar bounded by `MAX_EVENTS=500`. Contents/clients/publications/team/members are full-list with no user-supplied limit — no parameter to abuse. |
| Malformed IDs | SAFE | All ids are `String @id` (cuid), tenant-scoped `findFirst({ id, companyId })` → plain 404 on any non-matching value. No UUID-typed columns; no 500, no existence leak. |
| Enum/date parsing | SAFE | Status/sort/direction/lifecycle whitelists on GET filters; payload enums via `z.enum`; dates via `z.string().datetime()` plus explicit `new Date` + `isNaN` guards in services; calendar range validated (from < to, max 90 days). |
| Array/bulk limits | SAFE | channels `.max(10)` + `normalizeChannels` cap; attachmentIds `.max(20)`; workflow reorder array must equal the active stage count (`reorderStages` rejects any other length, including duplicates). No unbounded bulk write path. |
| Upload/body size | SAFE | Global `express.json` limit 1mb; webhooks `expressRaw` 1mb; attachment `MAX_FILE_SIZE_BYTES` 50MB and image `MAX_IMAGE_SIZE_BYTES` 5MB enforced at intent AND completion (head-object size check). |
| Unsafe sort/filter input | SAFE | `sort` whitelisted (`updatedAt|createdAt|title`), `direction` binary ternary, `search` is parameterized Prisma `contains`; calendar filters validated. |
| Malformed input → 500 | **CONFIRMED_DEFECT** | body-parser `entity.parse.failed` (malformed JSON) and `entity.too.large` fell through `errorHandler` to a generic 500 because those errors carry `status`/`type` but no `code`. Verified empirically (POST malformed JSON → 500 `internal_error`). |

## Fixes applied

`backend/src/lib/errors.ts` — `toAppError` now maps body-parser failures before the Prisma branch:

- `entity.parse.failed` → 400 `bad_request` "JSON inválido"
- `entity.too.large` → 413 `payload_too_large`

Smallest existing mechanism (the global error mapper); one guard, covers every route and both webhooks. No API redesign, no new dependency, no arbitrary limit.

## Regression test

`backend/tests/hardening.test.ts` — added "malformed JSON body returns 400 instead of an internal 500": POSTs `{bad json` to `/api/auth/login` with the configured origin, asserts 400 + `bad_request`.

## Validation

| Check | Result |
|---|---|
| Focused tests (hardening) | PASS (9/9) |
| Full backend tests | PASS (478/478, 42 files) |
| Backend typecheck | PASS |
| Backend build | PASS |
| git diff --check | PASS |

## Evidence notes

- No schema/migration/backend-model changes; no new dependency.
- Head matches the expected commit `ecd7c6f`.
- Untracked `.dev-reports/looply-v1-r2-m1-*.md` and `-m2-*.md` are unrelated M1/M2 Contabo reports — not staged.
- No frontend touched.

## Remaining observations (non-defects, out of R2.P3 scope)

- Contents / clients / publications / team / members list endpoints are unpaginated full reads; safe today (auth-gated, no limit parameter) but will need pagination when data volume grows. Deliberately not changed: would be an API redesign and no abuse vector exists.
- `workflows reorderSchema` has no `.max()`; service-level guard already rejects any array that does not match the active stage count exactly, so the surface is bounded without a schema cap.