# Performance Audit — A3.G1 Gupshup WhatsApp Provider (2026-08-15)

Scope: `backend/src/services/gupshupProvider.ts` (normalize/sendText/IP matching), `whatsappGupshupWebhook.ts`, `assistantRuntime.ts` (provider selection), reusing the A3.1 adapter pipeline unchanged.

## Summary

No blocking or significant concerns. Gupshup adds no hot-path cost beyond the A3.1 pipeline; the IP allowlist check is a small bounded loop.

## Hot-path analysis (per inbound Gupshup text message)

| Step | Cost | Notes |
|---|---|---|
| `express.raw` body parse | O(body) | small (KB); before JSON middleware |
| `isValidInboundSource` | O(allowlist × bytes) | bounded by configured entries (few); byte-mask compare, no allocations beyond one Buffer |
| `claimInboundMessage` (SET NX EX) | O(1) Redis | namespaced key, 48h TTL |
| `resolveWhatsAppActor` | 1 indexed lookup | unique `(provider, phoneNumber)` |
| adapter pipeline | unchanged | confirmation phrase O(1), one LLM call, domain work, GETDEL/SET O(1) |
| `sendText` | 1 HTTP POST | `https://api.gupshup.io/wa/api/v1/msg`, form-urlencoded, `AbortSignal.timeout(10000)` |

## Outbound bounding

- `sendText` body is a single text message object; reply text remains bounded by the A3.1 formatter (deterministic, list cap 10).
- `URLSearchParams` serialization is O(body) trivial.
- Timeout (10s) prevents a hung Gupshup request from pinning a worker; outbound failure is caught by the adapter and does not retry or re-run domain work.

## Concurrency & failure semantics

- Same as A3.1: atomic SET NX EX claim neutralizes duplicate/concurrent deliveries; losers do nothing.
- Each provider (`whatsapp`/`gupshup`) is an independent lazy singleton; selecting one never initializes or perturbs the other.
- IP allowlist matching is pure and allocation-bounded (one 4/16-byte Buffer for the request IP, reused across entries).

## Memory / lifecycle

- `GupshupWhatsAppProvider` holds only config strings + allowlist array. No per-message state.
- Redis keys all TTL'd (idempotency 48h, confirmation 600s); per-provider namespacing does not change key count per message.

## Verdict

No remediation required. Watch items: LLM latency dominates (unchanged), and outbound Gupshup POST is serial after command execution — acceptable for V1; a queue would only be justified if inbound rate exceeds ~10 msg/s.