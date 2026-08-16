# 17b. WhatsApp Assistant — Text Transport Adapter

Status: Implemented (A3.1). Follows [17a. WhatsApp Actor and Transient State](./17a-whatsapp-actor-and-transient-state.md), which it builds on end-to-end.

## 1. Context

[16. Assistant Natural Language Adapter](./16-assistant-natural-language-adapter.md) exposes `interpretAssistantMessage(model, message, context)` and A2's command router exposes `executeAssistantCommand(db, context, input, services)`. Those operate on a structured `AssistantMessage` with `provider` metadata. Nothing yet ingested provider messages over HTTP.

A3.1 closes the loop for the **WhatsApp text transport**: an inbound webhook that authenticates Meta Cloud API deliveries, normalizes them to the existing `AssistantMessage` shape, claims idempotency, resolves the actor, reuses the confirmation + language-adapter primitives from 17a/16, executes through the A2 router, and emits a deterministic bounded outbound reply.

### Why this adapter, not a generic one

- Only text inbound is in scope (V1). Non-text events get a fixed deferral reply.
- Meta Cloud API is the only provider wired (A3.0 decision); the provider boundary is a small interface so a second provider can be added without touching the adapter.
- Outbound must never re-run the domain command, and must be bounded (10 list items max).

## 2. Architecture

```
Meta Cloud API ──(webhook)──► routes/whatsappWebhook.ts
                                 │ GET  handshake (hub.mode/verify_token/challenge)
                                 │ POST raw body + X-Hub-Signature-256 (HMAC-SHA256, app secret)
                                 ▼
                          services/whatsappProvider.ts   (verifySignature, normalizeInbound, sendText)
                                 │  WhatsAppInboundEvent  { provider, providerMessageId, senderPhone, type, text? }
                                 ▼
                          services/whatsappTextAdapter.ts  handleWhatsAppInboundText(deps, event)
                                 │  1. claimInboundMessage (SET NX EX, 48h)          ← dedupe/fail-closed
                                 │  2. non-text deferral / actor resolution (resolveWhatsAppActor)
                                 │  3. confirmation phrases (SIM/CONFIRMO/CONFIRMAR, NÃO/NAO/CANCELAR)
                                 │  4. interpretAssistantMessage (A2.1)  ──► languageModel
                                 │  5. executeAssistantCommand (A2)     ──► domainServices
                                 │  6. savePendingConfirmation / consumePendingConfirmation (600s)
                                 ▼
                          services/whatsappReplyFormatter.ts  (deterministic PT-BR, list cap 10)
                                 ▼
                          provider.sendText → Graph API /messages
```

Wiring: `lib/assistantRuntime.ts` exposes lazy singletons (`getRuntimeTransientStore`, `getWhatsAppProvider`, `getAssistantLanguageModel`) so tests inject fakes while production resolves config once.

## 3. Webhook route (`routes/whatsappWebhook.ts`)

- Mounted at `/api/webhooks/whatsapp`, **before `express.json`** in `app.ts`, using `express.raw({ type: () => true })` so the exact request bytes are available for HMAC verification.
- **GET**: returns `hub.challenge` only when `hub.mode === "subscribe"` and `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`; otherwise 403.
- **POST**: 
  - No app secret configured → 503 (fail-closed, no processing).
  - `X-Hub-Signature-256` missing/malformed or `verifySignature` false → 401.
  - Body not a `Buffer` or fails JSON parse → 400.
  - Every accepted event resolves to HTTP **200 `EVENT_RECEIVED`** regardless of per-event outcome; per-event errors are logged with masked content, never surfaced to Meta (avoids Meta retry storms). Idempotency dedupe means Meta retries are harmless.
- `verifySignature` uses `crypto.timingSafeEqual` on fixed 32-byte buffers (no length leak).

## 4. Provider (`services/whatsappProvider.ts`)

```ts
interface WhatsAppProvider {
  readonly name: "whatsapp";
  verifySignature(raw: Buffer, signatureHeader: string | undefined): boolean;
  normalizeInbound(body: unknown): WhatsAppInboundEvent[];
  sendText(to: string, text: string): Promise<void>;
}
```

`MetaWhatsAppProvider`:
- **verifySignature**: HMAC-SHA256 of raw bytes with `WHATSAPP_APP_SECRET`, hex, compared timing-safe. Unconfigured secret ⇒ false (fail-closed).
- **normalizeInbound**: Meta payload shape `entry[].changes[].value.messages[]`. Extracts `from` (sender phone), `id` (provider message id), `timestamp`, and `text.body`; `type !== "text"` yields `{ type, nonTextType }` events (image/video/audio/document/location/contacts/sticker/button/unknown are known non-text types; truly unknown types are skipped). Malformed rows are skipped; only well-formed events are emitted.
- **sendText**: POST `https://graph.facebook.com/v19.0/{phoneNumberId}/messages` with Bearer `WHATSAPP_ACCESS_TOKEN`, JSON `{ messaging_product:"whatsapp", to, text:{ body } }`. Errors are caught and logged by the adapter (masked), never propagated to the webhook response.

## 5. Adapter orchestration (`services/whatsappTextAdapter.ts`)

`handleWhatsAppInboundText(deps, event)`:

1. **Idempotency claim** — `claimInboundMessage(store, "whatsapp", event.providerMessageId)` (SET NX EX, 48h TTL). If unavailable/false ⇒ no reply, log (duplicate or store down; fail-closed).
2. **Non-text** — event.type !== "text" ⇒ reply `"Por enquanto, envie sua solicitação em texto."`.
3. **Actor** — `resolveWhatsAppActor(db, "whatsapp", event.senderPhone)`. No identity ⇒ `"Este número não possui acesso ao Looply."`; malformed phone ⇒ same (adapter-level; store/domain still receive the raw phone for 17a compatibility).
4. **Confirmation phrase** — trimmed, lowercased:
   - `sim|confirmo|confirmar`: `consumePendingConfirmation(store, companyId, userId)` (GETDEL). Present ⇒ execute stored command; absent ⇒ `"Não há nenhuma ação pendente para confirmar."`; store error ⇒ transient-failure copy.
   - `não|nao|cancelar`: consume-and-discard ⇒ `"Ação cancelada. Nenhuma alteração foi feita."`.
   - else: treat as a brand-new message.
5. **Interpret** — `interpretAssistantMessage(languageModel, { role:"user", provider:"whatsapp", providerMessageId, senderPhone, text }, { currentTimestamp, timezone })`.
6. **Execute or defer confirmation** — command with `confirmationRequired` ⇒ `savePendingConfirmation(store, companyId, userId, { command, correlationId, expiresAt })` (600s) + confirmation prompt. Otherwise `executeAssistantCommand(db, context, input, services)`.
7. **Outbound** — `sendText(senderPhone, formatAssistantResult(result))` inside try/catch that only logs (masked) and never re-runs the command. A `confirmationRequired` failure stores nothing and replies with a transient-failure copy.

`AssistantAdapterDeps`: `{ db, store, languageModel, provider, services? }`.

## 6. Confirmation semantics

- Reuses `savePendingConfirmation` / `consumePendingConfirmation` from 17a (single pending record per company+user; newer mutation replaces; GETDEL is atomic).
- Confirmation phrases are **exact string matches** — never LLM-interpreted.
- TTL 600s == `expiresAt` (17a documented simplification); an expired record is treated identically to a missing one.
- Confirmation replies to `confirmar` phrase → same `confirmationPrompt(operation)` used at save time, so a second `confirmar` with nothing pending gets the explicit "nothing pending" copy.

## 7. Reply formatting (`services/whatsappReplyFormatter.ts`)

Deterministic, PT-BR, no LLM text. Key rules:
- Success/failure/info + list + confirmation request strings, all literal.
- Result lists capped at `WHATSAPP_MAX_LIST_ITEMS = 10`, remainder summarized as `+ N outros resultados.`
- The prompt and copies are exported as functions so the A2.1 web adapter and the WhatsApp adapter share phrasing (single source).

## 8. Configuration

New optional env vars (`.env.example`, never logged or committed):

| Var | Purpose |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | webhook GET handshake challenge |
| `WHATSAPP_APP_SECRET` | HMAC-SHA256 signature verification |
| `WHATSAPP_ACCESS_TOKEN` | Graph API bearer (sendText) |
| `WHATSAPP_PHONE_NUMBER_ID` | Graph API send target |

All absent ⇒ webhook returns 503 and no inbound/outbound happens. The adapter only ever logs masked values (lengths, not secrets).

## 9. Tests

`tests/whatsappTextAdapter.test.ts` (30 tests) — fake `TransientStore` (in-memory), fake `AssistantLanguageModel` (per-call output queue), `MetaWhatsAppProvider`, fake db, fake domain services recording calls.

- Provider: signature mismatch/missing → 401 semantics; valid buffer → normalized events; non-text types; malformed payload rows skipped; sendText URL/token/masked-error handling.
- Adapter: idempotency (duplicate wamid → no reply, no domain work); non-text deferral; unauthorized phone; confirmation accept/reject/expired/none-pending; mutation replace; transient failure on store-down; outbound-failure logs without re-running command.
- Formatter: list cap at 10 + overflow line; success/failure copies.
- HTTP route: GET handshake ok/mismatch; signed POST runs pipeline & acks `EVENT_RECEIVED`; invalid signature → 401; malformed JSON → 400; unconfigured (no store) → 503; duplicate webhook → single outbound.

Full suite: backend 265 tests pass; frontend 32 pass; typecheck/build green both apps; schema `prisma validate` OK (no schema change).

## 10. Runtime readiness

- Runtime Redis smoke passed against configured `REDIS_URL` (looply-redis on 127.0.0.1:6379): synthetic key set/get, `setIfAbsent` dedupe, `getAndDelete`, delete, cleanup.
- Staging `looply-backend` (PM2, fork) restarted after gates; `/health` verified.
- Real Meta app credentials are NOT configured in this environment — webhook will 503 until the team adds the four vars and registers the webhook URL in the Meta developer console.

## 11. Security notes

- `timingSafeEqual` fixed-length compare; no length-oracle.
- Fail-closed on any config/idempotency/store ambiguity.
- Raw-body parse before any JSON middleware; outbound errors masked.
- No secrets logged or committed; `REDIS_URL`/WhatsApp creds stay in gitignored `.env`.
- See `.dev-reports/security-audit-a3-1-2026-08-15.md`.