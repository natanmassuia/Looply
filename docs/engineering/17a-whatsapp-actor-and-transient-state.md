# Looply V1 — WhatsApp Actor Identity & Transient State

## Purpose

A3.0 provides exactly the two prerequisites A3.1 was blocked on: an explicit persisted WhatsApp sender identity mapping to an authorized internal actor, and shared expiring transient state for Assistant confirmations and webhook idempotency. No webhook processing, outbound messaging, or Assistant execution exists yet.

## Trust Model

A phone number is an untrusted identifier until it resolves through persisted mapping to an active User with an active CompanyMember in a specific Company. The `WhatsAppIdentity` row alone grants nothing; every resolution re-proves user, membership, and company state at runtime. Capabilities are never stored on the identity. Client contact phones are never actor identities.

## WhatsApp Identity Mapping

`WhatsAppIdentity` (Prisma, physical table `WhatsAppIdentity`) stores `id`, `userId`, `companyId`, `provider` (default `"whatsapp"`), canonical `phoneNumber`, `enabled`, optional `label`, and timestamps. It is unique on `(provider, phoneNumber)` so one sender identity resolves deterministically to exactly one company context in V1. Multi-company switching per phone is explicitly deferred.

## Membership Authority

`resolveWhatsAppActor(db, provider, senderPhone)` returns a trusted context only when all of the following hold: the identity exists and is enabled; the User exists and is active; the Company is active with a workspace template; and an active `CompanyMember(userId, companyId)` exists. Otherwise it returns `null`. Removal or deactivation of the membership makes the identity unusable immediately even if the row remains. User deletion cascades the identity away; Company deletion cascades it too.

## Phone Normalization

`backend/src/lib/phone.ts` normalizes to a canonical E.164-like value: strip spaces/parentheses/dots/hyphens; `+`-prefixed 10–15 digits pass through; `55` + 10/11 digits becomes `+55…`; bare 10/11 digits gain `+55`. Everything else is invalid. Lookups are exact-equality against the stored canonical value; there is no substring matching anywhere.

## Provisioning

Controlled, admin-only: `provisionWhatsAppIdentity(db, { companyId, role }, { userId, phoneNumber, label? })`, exposed at authenticated `POST /api/whatsapp-identities` (app-level `/api` chain provides auth/password/workspace guards). Only OWNER/ADMIN may provision; `companyId` comes exclusively from auth context; the target user must hold an active membership in that same company; the phone is normalized before storage; duplicates conflict. The request schema is strict and accepts no role/capability/company fields. No public phone claiming and no OTP exist in V1.

## Tenant Isolation

The mapping selects one explicit company. A sender can never obtain a company the mapped user has no active membership in, because resolution validates `(userId, identity.companyId)` membership directly. Cross-company escalation and Client-as-actor shortcuts are structurally absent and covered by tests.

## Capability Resolution

Capabilities come from `capabilitiesForTemplate(company.workspaceTemplate)` — the same canonical authority the session-based API uses. The identity stores no roles and no capabilities.

## Transient Store

`backend/src/lib/transientStore.ts` defines the minimal contract: `get`, `set(key, value, ttlSeconds)`, `setIfAbsent` (atomic NX claim), `getAndDelete` (atomic single-use read), `delete`. Implementations that cannot guarantee `getAndDelete` atomicity must throw rather than fall back to get-then-delete.

## Redis Contract

`RedisTransientStore` (ioredis) implements the contract with `GET`, `SET … EX`, `SET … EX NX`, `GETDEL` (Redis ≥ 6.2), and `DEL`. `REDIS_URL` is optional configuration; `transientStoreFromEnv` returns `null` when unset, which callers must treat as "state layer unavailable". There is no process-global Map fallback, no pub/sub, no streams, no locks. The URL is never logged.

## Confirmation State

`backend/src/services/assistantConfirmationStore.ts` stores one pending confirmation per `(companyId, userId)` under `looply:assistant:confirmation:<companyId>:<userId>`. The record holds only `companyId`, `userId`, the exact structured command, `createdAt`, `expiresAt`, and an optional correlation id. No secrets, raw prompts, or conversation history.

## Atomic Consumption

`consumePendingConfirmation` uses the store's atomic `getAndDelete`, so exactly one consumer can obtain a pending command. A second consume returns `null`. Expiry is enforced both by TTL and by an `expiresAt` check on read.

## Idempotency

`backend/src/services/whatsappIdempotencyStore.ts` provides `claimInboundMessage(store, provider, providerMessageId)` — an atomic `SET NX EX` claim under `looply:whatsapp:idempotency:<provider>:<providerMessageId>`. `true` means first processing claim; `false` means duplicate delivery. Key components are validated against a safe alphabet so raw webhook input never reaches the key; only a timestamp marker is stored.

## TTLs

Confirmation: 600 seconds (10 minutes). Idempotency: 48 hours. Both are constants, documented here and asserted in tests. TTLs prevent unbounded growth.

## Failure Semantics

Fail closed. If the transient store is unavailable, confirmation and idempotency operations propagate errors; there is no in-memory fallback. A3.1 must therefore refuse to process Assistant WhatsApp commands (returning a safe unavailable response) rather than risk replayed confirmations or duplicated mutations.

## Security

Phone impersonation requires the persisted mapping; Client phones are never consulted (tested). Ambiguous/foreign memberships do not resolve. Capabilities are canonical and not duplicable. Provisioning is admin-only, tenant-scoped, strict-schema, and accepts no authority fields. Confirmation consume is atomic single-use; idempotency claims are atomic. `REDIS_URL` and provider credentials are never logged.

## Testing

`tests/phone.test.ts` (canonicalization, variants, malformed, exact-match), `tests/whatsappActor.test.ts` (resolution, membership integrity, isolation, provisioning, HTTP authority), `tests/transientState.test.ts` (store TTL/NX semantics, confirmation save/scope/single-use/expiry/failure, idempotency claims/TTL/failure). All use hand-written fakes; no live Redis and no live DB are required.

## A3.1 Integration Boundary

A3.1 will: normalize the inbound sender phone; call `resolveWhatsAppActor`; on `null`, reply safely without execution; `claimInboundMessage` before processing (duplicate → ignore); interpret text via the existing language adapter; store `savePendingConfirmation` for `ASSISTANT_CONFIRMATION_REQUIRED`; on explicit SIM/CONFIRMO/CONFIRMAR, `consumePendingConfirmation` and execute through the A2 command executor with the resolved trusted context; on NÃO/NAO/CANCELAR, `clearPendingConfirmation`; format deterministic bounded replies. Transient store unavailability must fail the whole flow closed.
