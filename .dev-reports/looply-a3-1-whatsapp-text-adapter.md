# A3.1 — WhatsApp Assistant Text Adapter

## Baseline

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| HEAD at start | `41e353791ee3c356778b6444742d86d2ee295048` |
| Frontend dirty staged | NO |
| Backend baseline | 235 tests |
| Frontend baseline | 32 tests |

## Scope

Text transport for the assistant over WhatsApp: authenticated webhook → normalization → idempotency claim → actor resolution → pending-confirmation handling → A2.1 language adapter → A2 command router → deterministic bounded outbound reply. Provider chosen: Meta Cloud API (only provider wired; interface isolated).

## What Was Built

| File | Kind |
|---|---|
| `backend/src/services/whatsappProvider.ts` | NEW — `WhatsAppProvider` interface + `MetaWhatsAppProvider` (HMAC verify, GET handshake, `normalizeInbound`, `sendText`) |
| `backend/src/services/whatsappTextAdapter.ts` | NEW — `handleWhatsAppInboundText` orchestration |
| `backend/src/services/whatsappReplyFormatter.ts` | NEW — deterministic PT-BR copy, list cap 10 |
| `backend/src/lib/assistantRuntime.ts` | NEW — lazy singletons (Redis store, provider, language model) |
| `backend/src/routes/whatsappWebhook.ts` | NEW — GET handshake + raw-body POST |
| `backend/src/app.ts` | MODIFIED — webhook mounted before `express.json` |
| `backend/src/lib/env.ts` | MODIFIED — 4 optional WhatsApp env vars |
| `.env.example` | MODIFIED — same 4 vars documented |
| `backend/tests/whatsappTextAdapter.test.ts` | NEW — 30 tests |

## Reused Primitives (untouched)

`resolveWhatsAppActor` / `WHATSAPP_IDENTITY_PROVIDER` (17a), `claimInboundMessage` (17a), `savePendingConfirmation` / `consumePendingConfirmation` (17a), `interpretAssistantMessage` (A2.1), `executeAssistantCommand` (A2), `transientStoreFromEnv` (17a).

## Tests

| Suite | Count | Result |
|---|---|---|
| `tests/whatsappTextAdapter.test.ts` | 30 | PASS |
| Backend full | 265 | PASS |
| Frontend full | 32 | PASS |

Coverage highlights: idempotency dedupe (duplicate wamid → no reply, no domain work); non-text deferral; unauthorized phone; SIM/NÃO confirm + cancel + none-pending + expiry path; mutation replace; store-down transient failure; outbound-failure logs without re-running command; formatter list cap 10 + overflow line; HTTP route GET handshake, signed POST acks `EVENT_RECEIVED`, invalid signature 401, malformed JSON 400, unconfigured 503, duplicate webhook single outbound.

## Validation Gates

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 265 tests |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS (no schema change) |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |

## Runtime Smoke (Redis)

Proved against configured `REDIS_URL` (`looply-redis`, 127.0.0.1:6379) via the app's `transientStoreFromEnv` singleton: set/get round-trip PASS, `setIfAbsent` dedupe PASS, `getAndDelete` atomic PASS, delete + cleanup PASS. Synthetic keys only (`looply:smoke:a3-1`), removed afterwards.

## Deployment

`pm2 restart looply-backend` (fork, id 0) after all gates; `/health` 200; no crash loop; no secrets in output. Real Meta app credentials are NOT present in this environment — webhook returns 503 until the team adds `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and registers the webhook URL in the Meta developer console.

## Security Audit

See `.dev-reports/security-audit-a3-1-2026-08-15.md` — Critical 0 / High 0. Highlights: `timingSafeEqual` fixed-length signature compare; fail-closed on unconfigured/idempotency/store errors; raw-body parse before JSON middleware; masked error logging; secrets never logged/committed; webhook 503 when unconfigured.

## Performance Audit

See `.dev-reports/performance-audit-a3-1-2026-08-15.md` — no blocking concerns: HMAC + one Graph call per outbound, Redis ops O(1), deterministic formatter, list cap bounds payload size. Idempotency and confirmation keys all TTL'd.

## Git State

Committed in isolation: `feat(v1): add whatsapp assistant text adapter`. Staged only A3.1 files. Pre-existing dirty/untracked files untouched; FRONTEND_DIRTY_STAGED=NO.

## Known Gaps / Follow-ups

1. Real Meta app credentials + webhook URL registration (deployment step, not code).
2. TTL 600s == `expiresAt` simplification (documented in 17a) — a future task can harden expiry semantics.
3. Only text inbound; image/video/etc. receive the fixed deferral copy.
4. `services` injection in the webhook route is optional (defaults to production domain services); tests inject fakes.