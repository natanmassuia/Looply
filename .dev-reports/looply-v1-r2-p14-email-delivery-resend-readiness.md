# R2.P14 — Email Delivery / Resend Readiness

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

Read-only inspection. No emails sent; no secrets exposed; no source change.

## 1. Provider

- **EMAIL_PROVIDER: RESEND** — `ResendMailService` (`backend/src/services/mailService.ts`) calls Resend directly via `fetch("https://api.resend.com/emails")` (no SDK dependency).
- **RESEND_IMPLEMENTATION: PRESENT**
- Provider abstraction: `MailService` interface (single implementation `ResendMailService`).
- Fallback behavior: if `!apiKey || apiKey === "disabled" || NODE_ENV === "test"` → **simulates** (logs `to/from/appUrl`, returns `{ id: "simulated-mail-id", simulated: true }`, never sends). With `NODE_ENV=production` and a missing key, the `!this.apiKey` branch still triggers simulation.

## 2. Environment (existence only — no secret values)

| Variable | Status |
|---|---|
| RESEND_API_KEY | **ABSENT** (not in `.env`; not referenced in `.env.example`) |
| RESEND_FROM | PRESENT (default `Looply <acesso@auth.verbumlab.com.br>`) |
| RESEND_REPLY_TO | PRESENT (default `suporte@verbumlab.com.br`) |
| FRONTEND_URL / APP_URL / PUBLIC_APP_URL | PRESENT (public app URL for reset links) |

## 3. Sender / domain

- FROM_ADDRESS: PRESENT (`acesso@auth.verbumlab.com.br` default; `RESEND_FROM` overridable)
- FROM_DOMAIN: `auth.verbumlab.com.br` (default)
- **DOMAIN_VERIFICATION: NOT_VERIFIED** — cannot be proven from local code/config; would require Resend account/domain verification outside this repo.

## 4. Product flows

- **PASSWORD_RESET_EMAIL: PASS (implemented + safe)** — `recoveryService.requestPasswordRecovery` → `mail.sendPasswordResetEmail` with correct reset URL/token. Token is single-use, 1h expiry, stored hashed (sha256). **No raw token logged** (mail logs only `to/from/appUrl`). Failure is swallowed (`catch {}`) and the endpoint returns a neutral success message (anti-enumeration); it does not falsely claim delivery to the client when the provider fails — by design.
- **INVITATION_EMAIL: NOT_IMPLEMENTED** — `memberService.createInvitation` returns the invitation token to the inviter directly; there is no email send for invitations.
- OTHER_EMAIL_FLOWS: none (no onboarding/system emails).

## 5. Live delivery test

- **LIVE_SEND: NOT_RUN** — `RESEND_API_KEY` is absent (cannot authenticate to Resend), and there is no explicitly available safe test recipient in current config. No email was sent to any user.

## 6. Security

- **API_KEY_LEAK: NO** — no key committed; key not logged.
- **TOKEN_SECRET_LEAK: NO** — reset tokens hashed at rest, not logged; only `to/from/appUrl` logged.
- Secrets excluded from this report.
- Provider errors do not leak internals to the client (failures swallowed; neutral response).

## 7. Validation

- EMAIL_TESTS: `passwordRecovery.test.ts` — **6/6 PASS** (email-relevant logic verified).
- Note: the full backend suite shows 49 DB-gated integration failures (appointmentsRoute, calendar, jobsWorkflow, approval, etc.) because those tests login as the **deleted demo users** (`natan@looply.dev`) removed in R2.P12. This is a known consequence of the demo-tenant cleanup — **not** an email/source regression and outside R2.P14 scope.
- BACKEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- DIFF_CHECK: PASS
- SOURCE_CHANGE: NO · DEPENDENCY_CHANGE: NO · FILES_CHANGED: NONE

## Classification

- **PROVIDER_STATE: IMPLEMENTED_NOT_CONFIGURED** — implementation is present and correct, but `RESEND_API_KEY` is absent, so real delivery is not configured; production currently falls back to simulation.

## Result

RESULT: PASS
EMAIL_PROVIDER: RESEND
PROVIDER_STATE: IMPLEMENTED_NOT_CONFIGURED

RESEND_IMPLEMENTATION: PRESENT
RESEND_API_KEY: ABSENT
FROM_ADDRESS: PRESENT
FROM_DOMAIN: auth.verbumlab.com.br (default)
DOMAIN_VERIFICATION: NOT_VERIFIED
APP_PUBLIC_URL: PRESENT

PASSWORD_RESET_EMAIL: PASS
INVITATION_EMAIL: NOT_IMPLEMENTED
OTHER_EMAIL_FLOWS: NONE

PROVIDER_FAILURE_HANDLING: SAFE
TOKEN_SECRET_LEAK: NO
API_KEY_LEAK: NO

LIVE_SEND: NOT_RUN
LIVE_SEND_RESULT: N/A (no API key, no safe recipient)

FILES_CHANGED: NONE
SOURCE_CHANGE: NO
DEPENDENCY_CHANGE: NO

EMAIL_TESTS: passwordRecovery PASS (6/6); DB-gated integration failures = known demo-cleanup consequence (not an email regression)
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

EMAIL_DELIVERY_READY: NO
BLOCKERS: RESEND_API_KEY absent (required); domain verification not provable; no invitation email flow

R2_P14_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INFRA_MIGRATION_PREPARATION
REPORT: .dev-reports/looply-v1-r2-p14-email-delivery-resend-readiness.md
GIT_STATE: no source changes; reports untracked; HEAD ffe3f82
KORE_TOUCHED: NO