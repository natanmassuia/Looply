# Performance Audit — A3.1.1 WhatsApp Runtime E2E (2026-08-15)

Scope: the runtime E2E harness `backend/tests/whatsappRuntimeE2E.test.ts` and the live path it exercises (webhook POST → HMAC → idempotency → actor → confirmation/LLM → command router → reply).

## Summary

No findings requiring remediation. The live path cost profile matches the A3.1 analysis; the E2E harness adds nothing to production runtime.

## Findings

| # | Location | Problem | Severity | Recommended fix |
|---|---|---|---|---|
| 1 | `tests/whatsappRuntimeE2E.test.ts` | Harness creates one `RedisTransientStore` (ioredis) per suite and reuses it; keys cleaned in `afterAll`. No leak, no per-test client. | Info | None |
| 2 | `afterAll` key deletion | Deleting 6 known keys serially is O(n) over a fixed set — trivial. | Info | None |

## Live path profile (per inbound message)

| Step | Cost | Verified in E2E |
|---|---|---|
| `express.raw` body parse + HMAC-SHA256 | O(body), small | yes (200 / 401 / 503 cases) |
| idempotency SET NX EX | O(1) Redis | yes (claim persisted, replay deduped) |
| actor resolution | 2 indexed DB lookups (faked in E2E) | yes (gate on path) |
| confirmation GETDEL | O(1) Redis, atomic | yes (SIM consumed exactly once) |
| command router + domain call | unchanged from A2 | yes (listJobs, updateAppointment recorded once) |
| outbound format + send | deterministic, bounded ≤10 items | yes (reply asserted) |

## Quick wins

None. The harness and the code under test are already bounded: single-key Redis ops with TTLs (48h idempotency, 600s confirmation), deterministic formatting, no polling, no N+1, no unbounded reads.

## Deferred

- Real outbound (Graph API) latency is only exercisable with real Meta credentials; mocked at the provider boundary here (A3.1 already documented this).
- LLM call latency dominates perceived response time; not touched by this transport layer.