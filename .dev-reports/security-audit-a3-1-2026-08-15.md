# Security Audit — A3.1 WhatsApp Text Adapter (2026-08-15)

Scope: `backend/src/services/whatsappProvider.ts`, `whatsappTextAdapter.ts`, `whatsappReplyFormatter.ts`, `backend/src/lib/assistantRuntime.ts`, `backend/src/routes/whatsappWebhook.ts`, `backend/src/app.ts` (webhook mount), `backend/src/lib/env.ts`.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 (informational, see notes) |

## Checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Webhook authenticity (HMAC-SHA256, app secret) | PASS | `verifySignature` computes HMAC over raw buffer; missing/malformed header or failed compare → 401 / 503 fail-closed |
| 2 | Constant-time comparison | PASS | `crypto.timingSafeEqual` on fixed 32-byte buffers; length check before compare (no length oracle — both sides always 32 bytes) |
| 3 | Raw body integrity | PASS | `express.raw` before `express.json`; only `Buffer` bodies accepted; signature computed over the exact delivered bytes |
| 4 | GET verification handshake | PASS | challenge returned only when `hub.mode === "subscribe"` AND token matches; else 403 |
| 5 | No secret leakage | PASS | WhatsApp creds only in gitignored `.env`; `.env.example` holds placeholders; nothing logged or echoed |
| 6 | Fail-closed on missing config | PASS | no app secret → 503; no store → 503; no outbound attempted |
| 7 | Idempotency / replay protection | PASS | `claimInboundMessage` SET NX EX 48h; duplicate wamid → no reply, no domain work; route always 200 → Meta retries harmless |
| 8 | Actor authorization | PASS | `resolveWhatsAppActor`; unknown or malformed phone → fixed "no access" copy, no command execution |
| 9 | No SSRF/URI injection | PASS | `sendText` URL built from env `WHATSAPP_PHONE_NUMBER_ID` + fixed Graph host/version; recipient `to` is the actor's stored phone, JSON-encoded |
| 10 | Payload normalization robustness | PASS | unknown types skipped; malformed rows skipped; only well-formed events processed |
| 11 | No command re-execution on outbound failure | PASS | outbound errors caught + masked-logged; domain command already ran; never retried |
| 12 | No CSRF concern on POST path | PASS | CSRF guard allows Origin-less POSTs; authenticity provided by HMAC signature, not cookies/sessions |
| 13 | Error responses don't leak internals | PASS | route returns fixed codes (200/400/401/403/503); masked logs |
| 14 | No new secrets in committed files | PASS | staged diff reviewed; only placeholder vars in `.env.example` |
| 15 | Redis / transient store ops bounded | PASS | single-key O(1) ops, all keys TTL'd (48h idempotency, 600s confirmation) |

## Notes (Low / informational)

1. **TTL == expiresAt simplification** — confirmation `expiresAt` equals the store TTL (600s); an expired record is treated identically to a missing one. Acceptable for V1; documented in `docs/engineering/17a`.
2. **Outbound failures are silent to the user** — a Graph API failure logs (masked) but the user receives no error text because the webhook already acked 200. Intentional to avoid Meta retry storms; follow-up could add a dead-letter/exponential-retry on outbound.
3. **Meta retry window** — idempotency TTL (48h) far exceeds Meta's retry cadence; no window where a real retry is mis-deduplicated as a separate message.

## Verdict

APPROVED for V1. Webhook authenticity, fail-closed semantics, replay protection, and actor authorization are all enforced at the transport boundary before any domain work.