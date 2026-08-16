# A3.G1 — Gupshup WhatsApp Provider Adapter

## Executive Decision

`GupshupWhatsAppProvider` is added **alongside** `MetaWhatsAppProvider` behind the existing `WhatsAppProvider` boundary, reusing the entire A3.1 pipeline — no second Assistant pipeline, no direct Prisma/domain access from provider code. Inbound Gupshup messages normalize into the existing `WhatsAppInboundEvent` shape and flow through the unchanged `handleWhatsAppInboundText` adapter.

**Provider values:** the task text labels Meta `provider = "meta"`. This repo's canonical Meta value is `"whatsapp"` (`WHATSAPP_PROVIDER_NAME`, `WHATSAPP_IDENTITY_PROVIDER`, Prisma `@default("whatsapp")`, idempotency namespace). Per the task ("the exact current HEAD is authoritative if it differs"), and because renaming would break existing identities, the existing Meta test suite, and the schema default (no migration allowed), **Meta keeps `"whatsapp"`** and Gupshup is **`"gupshup"`**. Provider separation is fully satisfied and verified by tests. This deviation is documented in `docs/engineering/18`.

**Webhook authority:** Gupshup Self-Serve webhooks provide **no cryptographic signature**. The official documented mechanism is **IP allowlisting** (inbound IPs from `devsupport@gupshup.io`). We enforce it fail-closed via `GUPSHUP_WEBHOOK_IP_ALLOWLIST`; no invented signature. Security verdict: **Critical 0 / High 0** → proceed, not BLOCKED (see Webhook Authority + Security sections).

## Baseline

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| HEAD at start | `dec12cf6e5acc7fcdb244f5b58dbdb61de49fd25` (F0 audit commit; authoritative post-A3.1 HEAD) |
| Frontend dirty staged | NO |
| Backend baseline | 271 tests |
| Frontend baseline | 32 tests |

## Webhook Authority

- **Finding (verified against official docs `docs.gupshup.io/docs/webhook-key-points`):** Gupshup Self-Serve callbacks have NO cryptographic signature. Documented security = IP allowlisting (`devsupport@gupshup.io` for inbound IPs).
- **Boundary implemented:** `isValidInboundSource(req.ip)` against `GUPSHUP_WEBHOOK_IP_ALLOWLIST` (exact IPv4/IPv6 + CIDR, fail-closed). Without an allowlist `inboundConfigured()` is false → route **503**; unallowlisted IP → **401**.
- `isValidSignature()`/`isValidVerification()` return `false` (documented as nonexistent on Gupshup); the route never calls them.
- Deployment requirement: `TRUST_PROXY=true` behind the single trusted reverse proxy (so `req.ip` is trustworthy), keep the allowlist current with Gupshup support.
- Compensating controls for the no-signature limitation: identity+phone authorization boundary (`resolveWhatsAppActor` requires an enrolled active `WhatsAppIdentity(provider="gupshup", phone)`), exact SIM confirmation for destructive mutations, replies only to the sender phone, no payload tenant authority.

## Provider

| Item | Value |
|---|---|
| Boundary | `services/whatsappProvider.ts` — added `GUPSHUP_PROVIDER_NAME = "gupshup"`; `WhatsAppInboundEvent.provider` widened to `"whatsapp" \| "gupshup"` |
| Implementation | `services/gupshupProvider.ts` — NEW `GupshupWhatsAppProvider` + `matchesIpAllowlist` |
| Selection | `lib/assistantRuntime.ts` — `getWhatsAppProvider(provider: "whatsapp" \| "gupshup")`, default `"whatsapp"`; independent lazy singletons |
| Config | `GUPSHUP_API_KEY`, `GUPSHUP_APP_NAME`, `GUPSHUP_SOURCE_NUMBER`, `GUPSHUP_WEBHOOK_IP_ALLOWLIST` (all optional at startup; Gupshup path fails closed) |
| No schema change | `prisma validate` PASS; no migration; `WhatsAppIdentity` composite key `(provider, phoneNumber)` reused |

## Inbound

Verified against `docs.gupshup.io/docs/what-is-an-inbound-message` (Inbound message structure V2): top-level `{ app, timestamp(ms), version:2, type, payload }`.

- Only `type === "message"` is normalized; `message-event | user-event | system-event | billing-event | template-event` are acked and ignored.
- `payload.id` → providerMessageId (idempotency); `payload.source` → senderPhone; `payload.type` → text / image / audio / video / document / other; `payload.payload.text` for text.
- `app`, `sender.name`, `sender.phone`, `country_code`, `dial_code`, `context` are dropped — never propagated, never tenant/actor authority.
- Timestamp is epoch **milliseconds** (unlike Meta seconds).
- Empty/missing id/source/text → row skipped.

## Outbound

Verified against `docs.gupshup.io/reference/msg` (OpenAPI server `https://api.gupshup.io/wa/api/v1`).

- `POST https://api.gupshup.io/wa/api/v1/msg`; headers `Content-Type: application/x-www-form-urlencoded`, `apikey`; body `channel=whatsapp`, `source`, `destination`, `src.name`, `message=<JSON {"type":"text","text":...}>`.
- `AbortSignal.timeout(10000)`; non-2xx → `"Gupshup outbound send failed"` (no secrets logged).
- Outbound failure is masked-logged and never re-runs the domain command (reuses A3.1 adapter semantics).

## Tests

`backend/tests/gupshupProvider.test.ts` — **65 new tests** (mandated sections covered: normalization 12, provider separation 6, idempotency 5, actor/tenant 7, outbound 11, confirmation 6, Meta regression 5, webhook security 6, IP allowlist unit 6, secrets 1). All mocked HTTP; no live Gupshup calls, no credentials required. Full suite: **336 backend tests PASS** (271 → 336).

## Validation

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 336 tests |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS (no schema change) |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |

No frontend source changes; `FRONTEND_DIRTY_STAGED=NO`.

## Security Audit

See `.dev-reports/security-audit-a3-g1-2026-08-15.md` — **Critical 0 / High 0**. Highlights: documented Gupshup IP allowlist enforced fail-closed (401/503); no fabricated signature; identity+phone authorization boundary; SIM confirmation for destructive mutations; apikey never logged (logger redacts it); provider namespaces isolated; no tenant authority from payload; bounded fixed outbound URL (no SSRF).

## Performance Audit

See `.dev-reports/performance-audit-a3-g1-2026-08-15.md` — no blocking concerns: IP allowlist match is O(allowlist × bytes) byte-mask compare; one form-urlencoded POST per outbound with 10s timeout; pipeline cost unchanged from A3.1 (Redis ops O(1), LLM dominates latency); keys TTL'd.

## Git State

Committed in isolation: `feat(v1): add gupshup whatsapp provider`. Staged only A3.G1 files: `backend/src/services/gupshupProvider.ts`, `backend/src/services/whatsappProvider.ts`, `backend/src/routes/whatsappGupshupWebhook.ts`, `backend/src/lib/assistantRuntime.ts`, `backend/src/lib/env.ts`, `backend/src/app.ts`, `backend/tests/gupshupProvider.test.ts`, `docs/engineering/18-gupshup-whatsapp-provider.md`, `.dev-reports/looply-a3-g1-gupshup-provider.md`, `.dev-reports/security-audit-a3-g1-2026-08-15.md`, `.dev-reports/performance-audit-a3-g1-2026-08-15.md`, `.env.example`. Pre-existing dirty/untracked files untouched; no push, no deploy.

## Known Gaps / Follow-ups

1. Live Gupshup credentials + inbound IP allowlist + webhook URL registration (A3.G1.1 deployment step, not code).
2. Only text inbound; non-text Gupshup messages receive the A3.1 fixed deferral copy (media download deferred).
3. `version: 2` shape assumed; a legacy V1 payload would be ignored as an unknown type (no fallback parser).
4. Gupshup IPs change; allowlist must be kept current.
5. Outbound base `wa/api/v1` (authoritative per current reference docs); some older docs mention `sm/api/v1`.

## Next Step

A3.G1.1 — runtime E2E against real Redis + real `api.gupshup.io` once Gupshup credentials and the inbound IP allowlist are provisioned (mirror `tests/whatsappRuntimeE2E.test.ts`, guarded by `REDIS_URL` + Gupshup env presence).