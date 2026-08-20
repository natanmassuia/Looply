# R2.P15 — Resend Production Configuration

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

## Outcome: COMPLETE (live delivery proven)

After the operator supplied a valid `RESEND_API_KEY` in `.env` and a safe test recipient, a real controlled email was delivered via Resend and accepted by the provider.

## Provider / env contract

- EMAIL_PROVIDER: RESEND (`ResendMailService` via direct `fetch` to `api.resend.com`)
- RESEND_API_KEY: PRESENT (set in `.env`, never printed/committed)
- FROM_ADDRESS: PRESENT (`Looply <acesso@auth.verbumlab.com.br>`)
- FROM_DOMAIN: `auth.verbumlab.com.br`
- DOMAIN_VERIFICATION: **VERIFIED** — Resend accepted a send from this sender/domain and returned a provider message ID (a `domain_not_verified` rejection did NOT occur). Verification evidenced by live provider acceptance.
- APP_PUBLIC_URL: PRESENT (`https://looply.verbumlab.com.br`)

## `.env.example` documentation

**ENV_EXAMPLE_UPDATED: YES** — documented `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO`, `APP_PUBLIC_URL` (names + placeholders, no secret values), reusing the exact variable names implemented in `mailService.ts`.

## Live send / password-reset delivery proof

- Recipient (safe test): `contato@verbumlab.com.br` (explicitly provided by operator)
- Sent exactly **one** controlled email through the real `ResendMailService.sendPasswordResetEmail` path (the actual password-reset email flow).
- **LIVE_SEND: RUN · LIVE_SEND_RESULT: PASS**
- **PROVIDER_MESSAGE_ID: `26e373a1-adf0-4510-8fa5-1cd0991f053f`**
- `simulated: false` (real delivery, not simulation)
- **PASSWORD_RESET_LIVE_DELIVERY: PASS** — the real reset-email path invoked Resend successfully and returned a message ID.
- The reset URL/token in the test was a dummy (not a real, usable token); no reset URL/token was exposed in output.

## Invitation email

- **INVITATION_EMAIL: OUT_OF_SCOPE_V1** — not implemented (token returned to inviter); no V1 product doc requires email invitations before release. Not implemented here.

## Security

- TOKEN_SECRET_LEAK: NO (reset tokens hashed at rest; test used a dummy token; none printed)
- API_KEY_LEAK: NO (key never printed/committed; `.env` is gitignored)
- PROVIDER_FAILURE_HANDLING: SAFE (failures swallowed; neutral anti-enumeration response)

## Validation

- EMAIL_TESTS: `passwordRecovery.test.ts` — 6/6 PASS
- BACKEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- DIFF_CHECK: PASS
- FILES_CHANGED: `.env.example` (+17 lines, config documentation only; `.env` has the live key but is gitignored, not tracked)
- SOURCE_CHANGE: NO (config docs only) · DEPENDENCY_CHANGE: NO

## Result

RESULT: PASS
EMAIL_PROVIDER: RESEND
RESEND_API_KEY: PRESENT
FROM_ADDRESS: PRESENT
FROM_DOMAIN: auth.verbumlab.com.br
DOMAIN_VERIFICATION: VERIFIED
APP_PUBLIC_URL: PRESENT

ENV_EXAMPLE_UPDATED: YES

LIVE_SEND: RUN
LIVE_SEND_RESULT: PASS
PROVIDER_MESSAGE_ID: 26e373a1-adf0-4510-8fa5-1cd0991f053f

PASSWORD_RESET_LIVE_DELIVERY: PASS
INVITATION_EMAIL: OUT_OF_SCOPE_V1

TOKEN_SECRET_LEAK: NO
API_KEY_LEAK: NO
PROVIDER_FAILURE_HANDLING: SAFE

EMAIL_TESTS: PASS (passwordRecovery 6/6)
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

EMAIL_DELIVERY_READY: YES
BLOCKERS: 0

R2_P15_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INFRA_MIGRATION_PREPARATION
REPORT: .dev-reports/looply-v1-r2-p15-resend-production-configuration.md
GIT_STATE: `.env.example` modified (config doc, not staged); `.env` has live key (gitignored, not tracked); reports untracked; HEAD ffe3f82
KORE_TOUCHED: NO

LOOPLY R2.P15 RESEND PRODUCTION CONFIGURATION — COMPLETE