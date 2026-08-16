# Security Audit — A3.G1 Gupshup WhatsApp Provider (2026-08-15)

Scope: `backend/src/services/gupshupProvider.ts` (NEW), `whatsappProvider.ts` (provider union type), `whatsappGupshupWebhook.ts` (NEW), `assistantRuntime.ts` (provider selection), `env.ts` + `.env.example` (GUPSHUP_*), `app.ts` (webhook mount).

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 (informational, see notes) |

Critical note: Gupshup Self-Serve inbound callbacks provide **NO cryptographic signature** (no HMAC, no shared-secret header). The official documented security mechanism is **IP allowlisting** (inbound IPs obtained from `devsupport@gupshup.io`). This is a platform limitation, not a defect introduced here. Per the task, we did NOT invent a fake signature; we implemented and enforced the documented mechanism fail-closed.

Why this is NOT rated High:
1. The IP allowlist is the provider's own documented authenticity boundary and is enforced (401 / 503 without it).
2. Even a request from an allowlisted IP can only act as a user whose exact E.164 phone is enrolled in a `WhatsAppIdentity(provider="gupshup", phone)` row for an active company — the authorization boundary is the identity + phone, not the payload.
3. Destructive mutations (`ticket.delete`, `calendar.delete`, `ticket.update`, `calendar.update`) require the exact "SIM" confirmation phrase.
4. Outbound replies go only to the inbound sender phone; no data exfiltration channel exists from a forged inbound.

## Checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Webhook authenticity (documented mechanism) | PASS | IP allowlist enforced via `isValidInboundSource(req.ip)`; unallowlisted → 401; no allowlist → 503 fail-closed |
| 2 | No fabricated signature | PASS | `isValidSignature` returns `false` (documented: Gupshup has none); route does NOT call it |
| 3 | IP allowlist correctness | PASS | `matchesIpAllowlist` exact IPv4/IPv6 + CIDR, fail-closed on empty/malformed/unknown-family; unit-tested |
| 4 | Trust proxy requirement | PASS | `req.ip` honors `TRUST_PROXY`; documented that the allowlist is only trustworthy behind the single trusted reverse proxy |
| 5 | Raw body integrity | PASS | `express.raw` before `express.json`; only `Buffer` bodies accepted |
| 6 | No secret leakage | PASS | GUPSHUP creds only in gitignored `.env`; `.env.example` placeholders; apikey never logged (logger redacts `apikey` — covered by test) |
| 7 | Fail-closed on missing config/state | PASS | no allowlist → 503; no store → 503; outbound without apiKey/appName/source → throws |
| 8 | Idempotency / replay protection | PASS | `claimInboundMessage` SET NX EX 48h, namespaced `looply:whatsapp:idempotency:gupshup:`; duplicate → no reply/domain work; route always acks 200 |
| 9 | Actor authorization | PASS | reuse of `resolveWhatsAppActor(db, "gupshup", phone)`; app name / sender.name / country_code / context never propagated or consulted |
| 10 | No tenant authority from payload | PASS | `app`, `sender.name`, `source` (business line) are dropped; resolution uses only `(provider, senderPhone)` |
| 11 | No SSRF/URI injection | PASS | outbound URL fixed to `https://api.gupshup.io/wa/api/v1/msg`; source/src.name from env; recipient is the actor's stored phone |
| 12 | No command re-execution on outbound failure | PASS | outbound errors caught + masked-logged; domain command already ran; never retried (existing adapter semantics) |
| 13 | Error responses don't leak internals | PASS | route returns fixed codes (200/400/401/503); masked logs |
| 14 | No new secrets in committed files | PASS | staged diff reviewed; only placeholders in `.env.example` |
| 15 | Provider namespace isolation | PASS | distinct provider values (`whatsapp` / `gupshup`); idempotency keys, identity rows, and actor lookups all provider-scoped |

## Notes (Low / informational)

1. **No cryptographic webhook signature (platform limitation)** — Gupshup Self-Serve does not offer one; the documented IP allowlist is the contract. Residual risk: an attacker on an allowlisted IP range who also knows an enrolled phone could inject a message (mitigated by identity boundary + SIM confirmation for destructive ops). Deployment MUST request the current inbound IPs from `devsupport@gupshup.io` and set `GUPSHUP_WEBHOOK_IP_ALLOWLIST` behind `TRUST_PROXY=true`.
2. **Outbound failures are silent to the user** — a Gupshup API failure logs (masked) but the user receives no error text because the webhook already acked 200. Same intentional behavior as A3.1; follow-up could add a dead-letter/outbound retry.

## Verdict

APPROVED for V1. The absence of a cryptographic signature is a documented Gupshup limitation addressed by the strongest practical boundary the official contract permits (enforced IP allowlist) plus the identity+phone authorization boundary and SIM confirmation for destructive mutations. No Critical/High findings.