# A3.0 — WhatsApp Actor & Transient State Foundation

## Executive Decision

**A3.0 IMPLEMENTED — PASS**. Both A3.1 blockers are resolved: an explicit persisted WhatsApp identity mapping with runtime membership validation, and a Redis-backed shared transient store with atomic, TTL-bounded confirmation and idempotency primitives. No webhook or Assistant execution was added.

## Baseline

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| Initial SHA | `3f0d171d729b9b1ca32c85eba729d69220e5f57e` |
| A2.1 ancestry | Present |
| Backend baseline | 206 tests |
| Frontend baseline | 32 tests |

## Existing Infrastructure Discovery

| Question | Answer |
|---|---|
| `REDIS_ALREADY_AVAILABLE` | NO |
| `SHARED_CACHE_ALREADY_AVAILABLE` | NO (only process-local rate-limit/login-limiter Maps) |
| `PHONE_NORMALIZER_AVAILABLE` | NO (plain strings only) |
| WhatsApp provider established | NO |

## Identity Model

`WhatsAppIdentity` in `backend/prisma/schema.prisma`: `userId`, `companyId`, `provider` (default `whatsapp`), canonical `phoneNumber`, `enabled`, `label?`, timestamps; cascade delete from User and Company; runtime membership checks remain authoritative.

## Migration

Additive, hand-authored artifact `backend/prisma/migrations/20260820100000_whatsapp_actor_identity/migration.sql` (CREATE TABLE + unique `(provider, phoneNumber)` + two indexes + two FKs). Not applied to any database in A3.0; tests use fakes. Apply later via the canonical project migration command.

## Actor Resolution

`resolveWhatsAppActor(db, provider, senderPhone)` in `backend/src/services/whatsappActorService.ts` returns `{ userId, companyId, capabilities }` or `null` after proving identity, enabled, active user, active company with template, and active membership. No profile data is returned.

## Provisioning

`provisionWhatsAppIdentity` (OWNER/ADMIN only) + authenticated strict `POST /api/whatsapp-identities` (factory router for testability, default-bound to Prisma in `app.ts`). Same-company active membership required; phone normalized; duplicates conflict; no role/capability/company input accepted.

## Membership Validation

`companyMember.findUnique(userId_companyId)` with `isActive` check on every resolution; deactivation immediately invalidates the identity. Stored `companyId` must match a real active membership.

## Capability Authority

`capabilitiesForTemplate(company.workspaceTemplate)` — identical to the session API. No capability data on the identity.

## Phone Normalization

`backend/src/lib/phone.ts` → canonical E.164-like; punctuation-insensitive; `+55` completion; exact-match only, no substring semantics.

## Shared Transient Store

`TransientStore` interface + `RedisTransientStore` (ioredis; GET / SET EX / SET EX NX / GETDEL / DEL) + `transientStoreFromEnv` returning `null` when unconfigured. No process-memory fallback exists anywhere.

## Redis

New dependency `ioredis` only. `REDIS_URL` optional env (documented in `.env.example`, never logged). No pub/sub, streams, BullMQ, or locks.

## Confirmation State

`assistantConfirmationStore`: `savePendingConfirmation`, `getPendingConfirmation`, `consumePendingConfirmation`, `clearPendingConfirmation`; namespaced key `looply:assistant:confirmation:<companyId>:<userId>`; record = company/user/command/timestamps/correlation id only.

## Idempotency State

`whatsappIdempotencyStore.claimInboundMessage(store, provider, providerMessageId)`; key `looply:whatsapp:idempotency:<provider>:<messageId>` with alphabet-validated components; value = timestamp marker only.

## Atomicity

Confirmation consume uses atomic `GETDEL`; idempotency claim uses atomic `SET NX EX`. Non-atomic fallbacks are forbidden by contract and fail closed.

## TTLs

Confirmation 600s; idempotency 48h. Constants asserted in tests.

## Failure Mode

Store unavailable → errors propagate → A3.1 must refuse processing (fail closed). No silent memory fallback; tested.

## Security Audit

| Finding | Result |
|---|---|
| Critical / High | 0 / 0 |
| Phone impersonation | Requires persisted mapping; unknown sender → null |
| Client-as-user confusion | Structurally impossible; client delegate never queried (tested) |
| Ambiguous membership / cross-tenant | Blocked by (userId, companyId) membership proof |
| Capability duplication / arbitrary role | No authority fields accepted; capabilities canonical |
| Transient replay / non-atomic consume | GETDEL single-use (tested) |
| Idempotency races | Atomic NX claim (tested) |
| Redis secret logging | URL never logged; logger redacts sensitive keys |
| Fail-open behavior | None; failures propagate (tested) |

## Performance Audit

| Area | Result |
|---|---|
| Identity lookup | Unique index on (provider, phoneNumber); O(log n) |
| Membership resolution | Single findUnique; no N+1 |
| Transient ops | O(1) Redis commands |
| Growth | TTLs bound confirmation/idempotency key count |
| Payloads | Marker/JSON records only; no raw payloads stored |

## Tests

| Suite | Result |
|---|---|
| `tests/phone.test.ts` | PASS, 4 tests |
| `tests/whatsappActor.test.ts` | PASS, 10 tests |
| `tests/transientState.test.ts` | PASS, 15 tests |

## Backend Validation

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 235 tests |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:generate` | PASS |
| `npm --prefix backend run prisma:validate` | PASS |

## Frontend Regression

| Command | Result |
|---|---|
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |

## Database Safety

No migration applied, no reset/dev/deploy/db push/execute/psql run. Only `prisma validate` + `prisma generate`.

## Secret Handling

No `.env` values, `DATABASE_URL`, Redis URL, or credentials printed or committed.

## Changed Files

| File | Risk |
|---|---|
| `backend/prisma/schema.prisma` | Medium; new identity model + relations |
| `backend/prisma/migrations/20260820100000_whatsapp_actor_identity/migration.sql` | Medium; additive artifact (unapplied) |
| `backend/src/lib/phone.ts` | Low; shared normalizer |
| `backend/src/lib/transientStore.ts` | Medium; Redis state layer |
| `backend/src/lib/env.ts` | Low; optional REDIS_URL |
| `backend/src/services/whatsappActorService.ts` | Medium; actor authority |
| `backend/src/services/assistantConfirmationStore.ts` | Medium; confirmation state |
| `backend/src/services/whatsappIdempotencyStore.ts` | Medium; idempotency claims |
| `backend/src/routes/whatsappIdentities.ts` | Low; admin provisioning route |
| `backend/src/app.ts` | Low; route mount |
| `backend/package.json` / `backend/package-lock.json` | Low; ioredis dependency |
| `.env.example` | Low; REDIS_URL placeholder |
| `backend/tests/phone.test.ts` | Low |
| `backend/tests/whatsappActor.test.ts` | Low |
| `backend/tests/transientState.test.ts` | Low |
| `docs/engineering/17a-whatsapp-actor-and-transient-state.md` | Low; canonical documentation |
| `.dev-reports/looply-a3-0-whatsapp-prerequisites.md` | Low; final report |
| `.dev-reports/security-audit-a3-0-2026-08-14.md` | Low; security audit |
| `.dev-reports/performance-audit-a3-0-2026-08-14.md` | Low; performance audit |
| `.dev-reports/caveman-2026-08-14.md` | Low; simplification review |

## Commit

Pending final validation and explicit staging. No push or deploy.

## A3.1 Readiness

YES — both architectural prerequisites now exist. A3.1 can build the webhook transport on `resolveWhatsAppActor`, `claimInboundMessage`, and the confirmation store, calling the A2/A2.1 pipeline unchanged.
