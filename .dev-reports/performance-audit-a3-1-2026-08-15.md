# Performance Audit — A3.1 WhatsApp Text Adapter (2026-08-15)

Scope: WhatsApp inbound webhook pipeline and outbound reply path.

## Summary

No blocking or significant concerns. Per-message cost is dominated by two expected external calls (language model + one Graph API POST), both non-blocking async.

## Hot-path analysis (per inbound text message)

| Step | Cost | Notes |
|---|---|---|
| `express.raw` body parse | O(body) | small (KB); before JSON middleware so exactly once |
| `verifySignature` HMAC-SHA256 | O(body) | trivial, fixed-size compare |
| `claimInboundMessage` (SET NX EX) | O(1) Redis | single key, 48h TTL |
| `resolveWhatsAppActor` | 1 indexed lookup | unique `(provider, phoneNumber)` |
| confirmation phrase match | O(1) | string compare set |
| `consumePendingConfirmation` (GETDEL) | O(1) Redis | atomic, 600s TTL |
| `interpretAssistantMessage` | 1 LLM call | external, async, awaited |
| `executeAssistantCommand` | domain work | unchanged from A2 |
| `savePendingConfirmation` (SET) | O(1) Redis | 600s TTL |
| `sendText` | 1 Graph API POST | external, async; awaited in try/catch |

## Outbound bounding

- `formatAssistantResult` produces **deterministic** text (no LLM), capped at `WHATSAPP_MAX_LIST_ITEMS = 10` + `+ N outros resultados.` — payload size bounded regardless of result set size.
- No HTML, no templates, no per-item reflection.

## Concurrency & failure semantics

- Webhook route fires per-event handling and awaits completion; duplicate/concurrent deliveries are neutralized by the atomic SET NX EX claim (only one wins; losers do nothing).
- Outbound failure is caught locally — no re-run, no unhandled rejection, no backpressure leak.
- Redis ops are single-key; no pipelines/locks/fan-out. Fine for single-tenant V1 volume.

## Memory / lifecycle

- Lazy singletons (`assistantRuntime`) constructed once per process; `MetaWhatsAppProvider` holds only config strings. No per-message allocation beyond the reply string.
- Redis connections: one shared `ioredis` instance (reused, not per-request). TTLs bound key growth: idempotency 48h, confirmation 600s.

## Verdict

No remediation required. Watch items: LLM latency dominates perceived latency (out of scope for this adapter), and outbound send is serial after command execution — acceptable for V1 volumes; a queue would only be justified if inbound rate exceeds ~10 msg/s.