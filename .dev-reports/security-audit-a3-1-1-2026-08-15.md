# Security Audit — A3.1.1 WhatsApp Runtime E2E (2026-08-15)

Scope: live transport validation of the A3.1 WhatsApp text adapter. Reviewed code under test: `backend/src/routes/whatsappWebhook.ts`, `backend/src/services/whatsappProvider.ts`, `whatsappTextAdapter.ts`, `whatsappReplyFormatter.ts`, `lib/assistantRuntime.ts`, `lib/env.ts`, plus the new runtime E2E harness `backend/tests/whatsappRuntimeE2E.test.ts`.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 1 (test-only, informational) |

## Checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Live webhook authenticity | PASS | HMAC-SHA256 over raw body verified live via real `MetaWhatsAppProvider` + real HTTP route; invalid signature → 401 proven in runtime E2E |
| 2 | Constant-time compare | PASS | `timingSafeEqual` on fixed 32-byte buffers (unchanged from A3.1) |
| 3 | Fail-closed live behavior | PASS | running staging backend: GET handshake 403 / POST 503 (no Meta app secret configured) — confirmed live via curl |
| 4 | Idempotency / replay protection | PASS | SET NX EX claim; duplicate wamid replay → no second outbound, no domain work (runtime E2E asserts counts unchanged) |
| 5 | Confirmation single-use | PASS | GETDEL consume proven live; second SIM → "Nenhuma ação pendente", zero extra mutations |
| 6 | Actor authorization | PASS | `resolveWhatsAppActor` still requires identity + active membership + active company; E2E fake mirrors the canonical path |
| 7 | No secrets in harness | PASS | E2E uses synthetic `runtime-app-secret` / `runtime-verify-token`; real creds absent; nothing committed or logged |
| 8 | Outbound isolation | PASS | outbound send mocked at the provider boundary; failure path still logs masked and never re-runs domain work |
| 9 | Redis isolation | PASS | E2E writes only `looply:*` synthetic keys and deletes them in `afterAll` (verified zero leftovers after run) |
| 10 | No domain mutation in E2E | PASS | db + domain services are faked; no Appointment/Job/User rows touched; no DB command executed |
| 11 | Harness skips without Redis | PASS | `describe.skipIf(!run)` keeps CI green when `REDIS_URL` is absent |

## Notes (Low / informational)

1. **Fake secrets in a committed test** — `runtime-app-secret`/`runtime-verify-token` are test-only constants, clearly synthetic, bound to nothing. No real credential ever appears. Accepted.

## Verdict

APPROVED. The live runtime E2E reproduces the A3.1 security properties (authenticity, fail-closed, replay protection, single-use confirmation, actor gating) against real HTTP + real Redis without introducing any new exposure.