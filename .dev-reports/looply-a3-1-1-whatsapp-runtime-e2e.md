# A3.1.1 — WhatsApp Text Adapter Live Runtime E2E

## Baseline

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| HEAD at start | `c44be17` (A3.1) |
| Frontend dirty staged | NO |
| Backend baseline | 265 tests |
| Frontend baseline | 32 tests |
| Meta app credentials | NONE configured (`.env` has no `WHATSAPP_*` values) |
| LLM credentials | NONE configured (no `ASSISTANT_LLM_*` values) |

## What This Validates

Real Meta Cloud API delivery is impossible on this box (no app secret/token, no public webhook URL registered). The A3.1.1 runtime E2E proves every transport step the environment CAN prove live: the real HTTP webhook route, real `MetaWhatsAppProvider` HMAC-SHA256 crypto, and real Redis idempotency + confirmation stores. Only the LLM, db, and domain services are faked (so no data is created and no outbound reaches Meta). A3.1's 30-test unit suite plus this 6-test runtime suite together prove the full contract; the live staging backend's fail-closed behavior (403/503) was confirmed via curl.

## Runtime E2E Results (`backend/tests/whatsappRuntimeE2E.test.ts`, 6 tests)

| # | Test | Result |
|---|---|---|
| 1 | GET handshake echoes challenge with correct token, 403 otherwise | PASS |
| 2 | HMAC-verified inbound → idempotency claim persisted in real Redis, one confirmation prompt, zero domain mutation | PASS |
| 3 | Domain READ (ticket.read) executes through the router and formats a bounded reply | PASS |
| 4 | Invalid signature → 401, nothing claimed | PASS |
| 5 | Duplicate wamid replay → no second outbound, no domain work | PASS |
| 6 | Confirmation E2E: pending present before SIM; SIM → exactly one mutation; second SIM → no-op "nothing pending" | PASS |

Guard: `describe.skipIf(!process.env.REDIS_URL)` — suite stays green when Redis is absent; runs against the real `looply-redis` (127.0.0.1:6379) when configured. All synthetic keys deleted in `afterAll`; verified zero Redis leftovers.

## Validation Gates

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, **271 tests** (265 + 6 runtime E2E) |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS (no schema change) |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |

## Security / Performance / Caveman

See `.dev-reports/security-audit-a3-1-1-2026-08-15.md` (0 critical / 0 high), `.dev-reports/performance-audit-a3-1-1-2026-08-15.md` (no findings), and the A3.1.1 appendix in `.dev-reports/caveman-2026-08-14.md`.

## Environment State

- Redis runtime: `looply-redis` online at 127.0.0.1:6379 (loopback only); runtime E2E proved SET NX EX / GETDEL / GET against it.
- Backend: PM2 `looply-backend` (fork, id 0) online; `/health` 200; no restart needed (A3.1.1 adds a test + reports only, no source change).
- Live webhook fail-closed: GET 403 / POST 503 until `WHATSAPP_*` env vars are configured.

## Git State

Committed in isolation. Staged only A3.1.1 artifacts: the runtime E2E test, the two audit reports, and the caveman appendix. Pre-existing dirty/untracked files untouched; FRONTEND_DIRTY_STAGED=NO.

## Remaining for A3.2 (live Meta)

1. Set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` in `.env`; restart backend via PM2.
2. Register the webhook URL in the Meta developer console.
3. Provision a `WhatsAppIdentity` for a real phone via `/api/whatsapp-identities`.
4. Configure `ASSISTANT_LLM_*` for real language interpretation.
5. Run one live confirmation round-trip on a real device.