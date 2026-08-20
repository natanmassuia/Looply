# R2.P16A — Live Password Reset Email Visual Proof

**Date:** 2026-08-20
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

## Execution

Sent exactly **one** real password-reset email to the controlled test recipient `contato@verbumlab.com.br` via the real Looply `ResendMailService.sendPasswordResetEmail` path, using the **new R2.P16 template** (rebuilt `dist/services/mailService.js`). A dummy (non-real) token was used to avoid exposing a usable reset token.

## Provider / delivery

- RECIPIENT: contato@verbumlab.com.br
- FROM_ADDRESS: `Looply <acesso@auth.verbumlab.com.br>`
- FROM_DOMAIN: `auth.verbumlab.com.br` (verified in R2.P15; provider accepted the send — no domain/auth error)
- LIVE_SEND: RUN
- LIVE_SEND_RESULT: PASS
- PROVIDER_MESSAGE_ID: `77d15b9b-9fba-463e-a410-2c5cbc2eaa29`
- SIMULATED: false (real delivery)

## Template verification (captured rendered HTML)

- NEW_TEMPLATE_USED: YES
- DYNAMIC_NAME: YES ("Contato Verbum" rendered)
- CTA_PRESENT: YES ("Redefinir senha")
- VALIDITY_COPY: YES ("Este link expira em 1 hora e pode ser usado apenas uma vez.")
- FALLBACK_LINK: YES (reset-password URL present)
- SECURITY_FOOTER: YES ("ignore este e-mail com segurança")
- Eyebrow "RECUPERAÇÃO DE ACESSO" + title "Redefina sua senha" present.

## Security

- TOKEN_LEAK: NO — the reset token appears only inside the encoded reset URL. The dummy token used here contains no URL-unsafe characters (encoded form == raw form), so a naive raw-string check coincides with the URL. The authoritative proof is the R2.P16 `mailService.test.ts` (token `sensitive token xyz+/=`): raw token absent, encoded token present. No standalone token outside the URL; full reset URL (with token) not printed.
- API_KEY_LEAK: NO — RESEND_API_KEY never printed.
- No provider/auth error occurred.

## Result

RESULT: PASS
RECIPIENT: contato@verbumlab.com.br
FROM_ADDRESS: Looply <acesso@auth.verbumlab.com.br>
FROM_DOMAIN: auth.verbumlab.com.br

LIVE_SEND: RUN
LIVE_SEND_RESULT: PASS
PROVIDER_MESSAGE_ID: 77d15b9b-9fba-463e-a410-2c5cbc2eaa29
SIMULATED: false

NEW_TEMPLATE_USED: YES
DYNAMIC_NAME: YES
CTA_PRESENT: YES
VALIDITY_COPY: YES
FALLBACK_LINK: YES
SECURITY_FOOTER: YES

TOKEN_LEAK: NO
API_KEY_LEAK: NO

DELIVERY_READY: YES
VISUAL_PROOF_STATUS: READY_FOR_USER_SCREENSHOT_CONFIRMATION
NEXT_STATUS: WAITING_FOR_VISUAL_CONFIRMATION
REPORT: .dev-reports/looply-v1-r2-p16a-live-email-visual-proof.md
GIT_STATE: no new source change from this send (uses R2.P16 template); pending R2.P16 mailService.ts + .env.example config-doc remain uncommitted; reports untracked; HEAD ffe3f82
KORE_TOUCHED: NO

LOOPLY R2.P16A LIVE PASSWORD RESET EMAIL PROOF — PASS