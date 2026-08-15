# 18. Gupshup Official WhatsApp Provider

Status: Implemented (A3.G1). Adds a second provider behind the same `WhatsAppProvider` boundary introduced in [17b. WhatsApp Assistant — Text Transport Adapter](./17b-assistant-whatsapp-text-adapter.md), which is reused end-to-end. Follows [17a. WhatsApp Actor and Transient State](./17a-whatsapp-actor-and-transient-state.md).

## 1. Context

A3.1 wired Meta WhatsApp Cloud API as the sole provider. A3.G1 adds **Gupshup**, the other major official WhatsApp Business Platform intermediary. The requirement is coexistence, not duplication: Gupshup inbound is normalized into the existing `WhatsAppInboundEvent` shape and flows through the **same** `handleWhatsAppInboundText` pipeline (idempotency → actor resolution → confirmation → A2.1 language adapter → A2 command router → deterministic outbound). No second pipeline, no direct Prisma/domain access from provider code.

### Provider value note (task spec vs repo)

The task text labels Meta `provider = "meta"`. In this repo the Meta provider's canonical value is **`"whatsapp"`** (`WHATSAPP_PROVIDER_NAME`, `WHATSAPP_IDENTITY_PROVIDER`, Prisma schema `@default("whatsapp")`, idempotency namespace `looply:whatsapp:idempotency:whatsapp:`). Per the task ("the exact current HEAD is authoritative if it differs"), and to avoid breaking existing persisted identities, existing Meta tests, and the schema default (no migration allowed), the Meta value is **kept as `"whatsapp"`**. The two supported provider values are therefore:

- `"whatsapp"` → Meta WhatsApp Cloud API (unchanged)
- `"gupshup"` → Gupshup official API (new)

Provider separation is fully satisfied: idempotency keys, `WhatsAppIdentity` rows (`@@unique([provider, phoneNumber])`), and actor lookups are all provider-scoped, so a Gupshup sender can never be treated as a Meta sender or vice versa. `WhatsAppInboundEvent.provider` is typed as the union `"whatsapp" | "gupshup"`.

## 2. Architecture

```
Gupshup ──(webhook)──► routes/whatsappGupshupWebhook.ts  (POST /api/webhooks/whatsapp/gupshup)
                        │  raw body + IP allowlist check (documented Gupshup mechanism)
                        ▼
                     services/gupshupProvider.ts  (normalizeInbound V2, sendText)
                        │  WhatsAppInboundEvent { provider:"gupshup", providerMessageId, senderPhone, type, text? }
                        ▼
                     services/whatsappTextAdapter.ts  handleWhatsAppInboundText(deps, event)   ← REUSED, unchanged
                        │  1. claimInboundMessage (store, "gupshup", id)   SET NX EX 48h
                        │  2. actor resolution (resolveWhatsAppActor(db, "gupshup", phone))
                        │  3. confirmation phrases (SIM / NÃO), pending confirmation (600s)
                        │  4. interpretAssistantMessage (A2.1) → languageModel
                        │  5. executeAssistantCommand (A2) → domainServices
                        ▼
                     services/whatsappReplyFormatter.ts  (deterministic PT-BR)   ← REUSED
                        ▼
                     provider.sendText → POST https://api.gupshup.io/wa/api/v1/msg (form-urlencoded)
```

Provider selection: `lib/assistantRuntime.ts` exposes `getWhatsAppProvider(provider: "whatsapp" | "gupshup")`, defaulting to `"whatsapp"` (Meta route unchanged). Each provider is an independent lazy singleton; a provider whose env is absent reports unconfigured and its routes fail closed.

## 3. Inbound contract (V2, verified against official docs)

Official reference: `docs.gupshup.io/docs/what-is-an-inbound-message` (Inbound message structure V2).

```
{
  "app": "GupShupWhatsAppApp",
  "timestamp": 1580227766370,      // epoch MILLISECONDS
  "version": 2,
  "type": "message",               // other values: message-event | user-event | system-event | billing-event | template-event
  "payload": {
    "id": "ABEGkYaYVSEEAhAL3SLAWwHKeKrt6s3FKB0c",   // unique inbound message id → idempotency
    "source": "5511987654321",                       // sender E.164 phone
    "type": "text",                                  // text | image | file | audio | video | contact | location | button_reply | list_reply
    "payload": { "text": "Hello" },                  // text body for type=text
    "sender": { "phone": "...", "name": "...", "country_code": "+55", "dial_code": "+55" },  // transport metadata only
    "context": { "id": "...", "gsId": "0" }          // transport metadata only
  }
}
```

Normalization rules (`normalizeInbound`):

- Only top-level `type === "message"` produces events. All transport events (`message-event`, `user-event`, `system-event`, `billing-event`, `template-event`) are acknowledged at the route and never enter the Assistant.
- `payload.id` → `providerMessageId` (idempotency), `payload.source` → `senderPhone` (canonical phone normalization happens downstream in `resolveWhatsAppActor`).
- `payload.type` mapping: `text` → `text`; `image`/`audio`/`video`/`file` → canonical non-text types; `contact`/`location`/`button_reply`/`list_reply`/unknown → `other`.
- Top-level `timestamp` is epoch **milliseconds** → `Date(timestamp)`. (Meta is seconds — the two providers differ; each provider normalizes its own units.)
- `app`, `sender.name`, `sender.phone`, `sender.country_code`, `sender.dial_code`, `context` are **dropped** — they are transport metadata and are never propagated or used for tenant/actor authority.
- Empty/missing id, source, or text body → the row is skipped (malformed).

The `payload.source` business number is never a tenant selector; only `(provider, senderPhone)` resolves the actor, exactly as in A3.1.

## 4. Webhook authenticity (documented Gupshup mechanism)

Official references: `docs.gupshup.io/docs/webhook-key-points`, `docs.gupshup.io/docs/set-webhookcallback-url`.

**Gupshup Self-Serve webhooks provide NO cryptographic signature** (no HMAC, no shared-secret header). The official documented security mechanism is **IP allowlisting**: request the inbound IPs from `devsupport@gupshup.io` and restrict the callback endpoint to them. We do not invent a signature.

Implementation (`GupshupWhatsAppProvider`):

- `inboundConfigured()` is `true` only when `GUPSHUP_WEBHOOK_IP_ALLOWLIST` is non-empty. Without it the route returns **503** and nothing is processed (fail closed).
- `isValidInboundSource(ip)` checks `req.ip` against the allowlist (`matchesIpAllowlist`: exact IPv4/IPv6 + CIDR, fail-closed on empty/malformed/unknown-family). Non-allowlisted → **401**.
- `isValidSignature()` returns `false` and `isValidVerification()` returns `false` — documented as nonexistent on Gupshup; the route never calls them.
- Deployment note: the allowlist is only trustworthy behind the single trusted reverse proxy (`TRUST_PROXY=true`), since `req.ip` is derived from `X-Forwarded-For` only when trust proxy is enabled.

Security classification (see `.dev-reports/security-audit-a3-g1-2026-08-15.md`): **Critical 0 / High 0**. The documented IP allowlist is enforced, and even a request from an allowlisted IP can only act as a user whose exact E.164 phone is enrolled in an active `WhatsAppIdentity(provider="gupshup")`; destructive mutations additionally require the exact SIM confirmation phrase.

## 5. Outbound contract (verified against official docs)

Official reference: `docs.gupshup.io/reference/msg` (OpenAPI server `https://api.gupshup.io/wa/api/v1`).

- `POST https://api.gupshup.io/wa/api/v1/msg`
- Headers: `Content-Type: application/x-www-form-urlencoded`, `apikey: <GUPSHUP_API_KEY>`
- Body fields: `channel=whatsapp`, `source=<GUPSHUP_SOURCE_NUMBER>` (registered business number), `destination=<sender phone>`, `src.name=<GUPSHUP_APP_NAME>`, `message=<JSON text object {"type":"text","text":"..."}>`
- Request carries `AbortSignal.timeout(10000)`; a non-2xx response throws `"Gupshup outbound send failed"` (no details, no secrets, never logged).
- As in A3.1, an outbound failure is caught by the adapter, masked-logged, and **never re-runs the domain command**.

## 6. Configuration

New optional env vars (`.env.example`, never logged or committed). All optional at general backend startup so Meta-only environments remain valid; the Gupshup path fails closed when its required config is missing.

| Var | Purpose | Required for |
|---|---|---|
| `GUPSHUP_API_KEY` | Gupshup `apikey` header | outbound |
| `GUPSHUP_APP_NAME` | `src.name` on outbound | outbound |
| `GUPSHUP_SOURCE_NUMBER` | registered business number (`source`) | outbound |
| `GUPSHUP_WEBHOOK_IP_ALLOWLIST` | comma-separated IPs/CIDRs allowed to POST the webhook | inbound (fail-closed without it) |

## 7. Webhook route (`routes/whatsappGupshupWebhook.ts`)

- Mounted at **`POST /api/webhooks/whatsapp/gupshup`**, before `express.json` in `app.ts` and **before** the Meta router (longer prefix first, so each route owns its path; the Meta route keeps `POST /api/webhooks/whatsapp` untouched).
- Order of checks: `inboundConfigured()` and store present → **503** fail-closed; `isValidInboundSource(req.ip)` → **401**; JSON parse → **400**; otherwise normalize → per-event adapter → always **200 with an empty body**.
- Docs require a fast 2xx empty acknowledgement (Gupshup retries non-2xx within ~10s; optimal ack <100ms). Per-event outcomes are logged masked; duplicates are still safe because the idempotency claim runs before any side effect.

## 8. Tests

`tests/gupshupProvider.test.ts` (65 tests) — fakes mirror A3.1 (`FakeStore`, `FakeLanguageModel`, `FakeGupshupProvider`, fake db/services recording calls; mocked `fetchImpl` for outbound — no live Gupshup calls, no credentials required):

- **Normalization (12):** V2 text message shape; ms timestamp; transport events ignored; non-text type mapping; `other` mapping; transport metadata dropped; missing id/source; empty text skipped; junk payloads; unknown top-level types; non-object payload; raw phone preserved for canonicalization.
- **Provider separation (6):** distinct provider values; per-provider normalized events; namespaced idempotency keys (no cross-provider collision); provider-isolated actor resolution; `getWhatsAppProvider` selection; independent inbound/outbound config.
- **Idempotency (5):** first-claim wins; adapter dedupe (one outbound); cross-provider independent claims; unsafe id rejection (400); 48h TTL.
- **Actor/tenant (7):** gupshup sender resolves; app name never authority; source number not a tenant selector; client table never consulted; unauthorized unknown sender; canonical phone normalization; name/country_code spoofing ignored.
- **Outbound (11):** endpoint URL; form content-type; apikey header; channel/source/destination/src.name/message body fields; non-2xx throws; AbortSignal timeout; outbound failure does not re-run domain command.
- **Confirmation (6):** stores exact command; SIM consumes once; duplicate creates no second pending; exact phrases (no LLM); negative clears; correlationId = gupshup providerMessageId.
- **Meta regression (5):** HMAC verify unchanged; Meta normalize; Meta route acks EVENT_RECEIVED; `WHATSAPP_IDENTITY_PROVIDER`; Meta idempotency namespace.
- **Webhook route (6):** 503 no allowlist; 401 outside allowlist; 200 allowlisted (empty ack); 400 malformed JSON; 503 no store; Meta root path not shadowed.
- **IP allowlist unit (6):** exact IPv4, CIDR, IPv6, fail-closed cases, malformed entries, family mismatch.
- **Secrets (1):** logger redacts `apikey`.

## 9. Validation

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 336 tests (baseline 271 → +65) |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS (no schema change, no migration) |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |

No frontend source changes; `FRONTEND_DIRTY_STAGED=NO`.

## 10. Live E2E (deferred to A3.G1.1)

No live Gupshup calls and no Gupshup credentials exist in this environment, so this task used mocked HTTP only. A3.G1.1 should prove the runtime path against real infrastructure (real Redis + real `api.gupshup.io`) once the team provisions `GUPSHUP_API_KEY`, `GUPSHUP_APP_NAME`, `GUPSHUP_SOURCE_NUMBER`, requests inbound IPs from `devsupport@gupshup.io`, sets `GUPSHUP_WEBHOOK_IP_ALLOWLIST` (behind `TRUST_PROXY=true`), and registers the webhook URL `https://<host>/api/webhooks/whatsapp/gupshup` in the Gupshup app Overview → Webhooks tab.

## 11. Known limitations

1. No cryptographic webhook signature — platform limitation of Gupshup Self-Serve; IP allowlist + identity boundary + SIM confirmation are the compensating controls (documented, not rated High).
2. Gupshup IPs change; the allowlist must be kept current with Gupshup support.
3. Only text inbound; non-text Gupshup messages receive the A3.1 fixed deferral copy. Media download is deferred.
4. `version: 2` shape is assumed; a V1 payload from an old app would be treated as an unknown top-level type and ignored (no fallback parser).
5. Outbound uses the current official `wa/api/v1` base (per the `reference/msg` OpenAPI server); some older docs mention `sm/api/v1` — `wa/api/v1` is authoritative as of this task.