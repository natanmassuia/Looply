# Looply — V1-R2.P4 Auth / Session Independent Audit

Date: 2026-08-19 · Branch: `main` @ `7418226` · Audit only — no source modified, no commit, no push, no stage. `KORE_TOUCHED: NO`.

Purpose: independently audit the R2.P4 auth/session hardening claims against the actual code. Ignore
unrelated untracked M1/M2 Contabo reports.

## Baseline

- HEAD `741822642aacaeb2667cecbfe3812e62dfa0049c` (unchanged, == origin/main).
- No source modifications. `git diff --check`: PASS (exit 0).

## Invariant 1 — Session token: SAFE

- **Server-generated**: `newSessionToken()` = `randomBytes(32).toString("hex")` (256-bit) in
  `lib/password.ts`. Login calls it to create a fresh token; the route never accepts a client-chosen
  token.
- **Entropy**: `STRONG` (256-bit CSPRNG).
- **Hashed at rest**: session created with `id: hashToken(token)` (sha256); the raw token is never
  persisted (only in the httpOnly cookie / transient response). Test: "session token is not stored in
  plaintext form usable as id".
- **Not logged**: no auth-event logging of tokens; logger redacts `authorization/cookie/token/password`.
- **Fresh at login**: a new token is issued every login and the cookie is overwritten.

`SESSION_TOKEN_ENTROPY: STRONG` · `SESSION_TOKEN_HASHED_AT_REST: YES` · `SESSION_FIXATION: BLOCKED`.

## Invariant 2 — Session validation: SAFE

`resolveAuth` (per request) rejects:
- invalid/unknown session (hash lookup miss), revoked (`revokedAt`), expired (`expiresAt < now`),
- inactive/deleted user (`!user.active`),
- inactive membership (`!membership.isActive`).
- Server-side companyId resolution from the validated session → user → active membership. Stale
  membership/session state cannot bypass tenant boundaries (revalidated every request; membership
  revoked mid-session → denied, tested).
- `SESSION_EXPIRY: ENFORCED`.

## Invariant 3 — Login: SAFE

- **Generic failure**: one "Credenciais inválidas" for unknown email / wrong password / inactive user;
  `DUMMY_HASH` makes scrypt run once for unknown emails (timing equalization) → enumeration mitigated.
- **Rate limit wraps login**: `checkLoginRate(key)` (10/15min per IP+email) is called at the top of
  the `/login` handler before `login()` — ENFORCED.
- **No fixation**: token is always server-generated on login; attacker-controlled session identifiers
  are not reused (the route only accepts email+password; the fresh token overwrites the cookie).

`LOGIN_ENUMERATION: MITIGATED` · `LOGIN_RATE_LIMIT: ENFORCED`.

## Invariant 4 — Logout / revocation: SAFE

- `logout` sets `revokedAt` server-side (idempotent); a revoked session can no longer authenticate
  (`resolveAuth` returns null). Old credentials do NOT remain usable.
- Password change (`change-password`) revokes ALL sessions and issues a fresh one.
- Password reset revokes ALL sessions (recoveryService).
- `SESSION_REVOCATION: ENFORCED`.

## Invariant 5 — Password reset: SAFE

- **Expiry**: `expiresAt` checked (`< now` → reject).
- **One-time**: `usedAt` set on reset; reused token rejected (same generic message).
- **Invalidation**: `usedAt` written on success; token cannot be reused.
- **No enumeration**: neutral success message; non-existent email returns identical message.
- **Session revocation**: all user sessions revoked after successful reset.
- **Raw not stored**: only `tokenHash: hashToken(rawToken)` is stored; raw reset secret is email-only,
  never persisted or logged.

`PASSWORD_RESET_EXPIRY: ENFORCED` · `PASSWORD_RESET_ONE_TIME: ENFORCED` ·
`PASSWORD_RESET_SESSION_REVOCATION: ENFORCED`.

## Invariant 6 — Cookies: SAFE

- `httpOnly: true`, `secure: isProd` (`isProd = NODE_ENV === "production"`), `sameSite: "lax"`,
  `path: "/"`.
- **No production downgrade**: `secure` is true in production (isProd); dev-mode `secure=false` is
  intended for local HTTP. `CORS_ORIGIN` wildcard is rejected; `TRUST_PROXY` explicit. No
  environment-specific weakness in production.

`COOKIE_HTTPONLY: YES` · `COOKIE_SECURE: PRODUCTION_SAFE` · `COOKIE_SAMESITE: LAX` · `COOKIE_PATH: /`.

## Invariant 7 — CSRF: ADEQUATE

- `csrfOriginGuard` is mounted in app.ts (line 49) BEFORE the auth-protected `/api` routes (line 60)
  and the `/api/auth` router (line 52) — so it applies to all state-changing (POST/PUT/PATCH/DELETE)
  authenticated requests, including auth routes. Only bearer-token public approval routes are
  intentionally excluded (they use a random token, not the session cookie).
- Combined with `sameSite: "lax"` (session cookie not sent on cross-site POSTs), there is double
  protection. No state-changing cookie-auth route bypasses CSRF protection.
- `CSRF_STATUS: ADEQUATE`.

## Invariant 8 — Tenant authority: BLOCKED

- `req.auth.companyId` is resolved server-side in `resolveAuth` from the validated membership; never
  from body/query/header. `switchCompany` grants access solely by active membership.
- Test: "companyId in a request body NEVER appears in auth context" (attacker body `companyId: "cB"`
  still yields tenant A).
- `CLIENT_TENANT_OVERRIDE: BLOCKED`.

## Invariant 9 — Sensitive data: NO leak

- Login/me/reset responses return user profile, `{ok}`, `activeCompanyId`, `{ok,message}` — **no**
  passwordHash, raw session token (only in the httpOnly cookie), reset secret, or token hash.
- No auth-event logging of tokens/passwords; structured logger redacts
  `authorization/cookie/password/token/secret/apikey`; request logger strips query strings and
  approval tokens from paths. No stack traces in auth responses.
- `SENSITIVE_DATA_LEAK: NO`.

## Invariant 10 — Existing test coverage: MEANINGFUL

`auth.test.ts` and `passwordRecovery.test.ts` cover: invalid/unknown/revoked/expired session, inactive
user, no-membership, membership revoked mid-session, cross-company switch blocked (A→B, B→A,
inactive), client companyId never overrides tenant, login never returns passwordHash, generic error
(no enumeration), login rate limiter, logout revokes + idempotent + post-logout rejection, reset
one-time/expired/short-password + session revocation, cookie flags (secure in prod). No new tests
needed (no defect).

## Validation

- `git diff --check`: PASS (exit 0).
- HEAD unchanged; no source modifications.
- No code changed → reuse existing evidence: backend **477/477 PASS**, backend typecheck PASS, backend
  build PASS (from R2.4A/R2.P2, unchanged code).

## Findings

- **CRITICAL: 0** · **HIGH: 0** · **MEDIUM: 0** · **LOW: 0** · **CONFIRMED_FINDINGS: 0**.
- No CWE-287/384/613/640/307/352 defect. No REMEDIATION required.

## Result

```
RESULT: PASS
AUTH_MODEL: SERVER_SIDE_OPAQUE_TOKEN
SESSION_TOKEN_ENTROPY: STRONG
SESSION_TOKEN_HASHED_AT_REST: YES
SESSION_EXPIRY: ENFORCED
SESSION_FIXATION: BLOCKED
SESSION_REVOCATION: ENFORCED
LOGIN_ENUMERATION: MITIGATED
LOGIN_RATE_LIMIT: ENFORCED
INACTIVE_USER_HANDLING: SAFE
INACTIVE_MEMBERSHIP_HANDLING: SAFE
PASSWORD_RESET_EXPIRY: ENFORCED
PASSWORD_RESET_ONE_TIME: ENFORCED
PASSWORD_RESET_SESSION_REVOCATION: ENFORCED
COOKIE_HTTPONLY: YES
COOKIE_SECURE: PRODUCTION_SAFE
COOKIE_SAMESITE: LAX
COOKIE_PATH: /
CSRF_STATUS: ADEQUATE
CLIENT_TENANT_OVERRIDE: BLOCKED
SENSITIVE_DATA_LEAK: NO
CONFIRMED_FINDINGS: 0
CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0
LOW_FINDINGS: 0
EXISTING_AUTH_TEST_COVERAGE: MEANINGFUL
APPLICATION_SECURITY_STATUS: PASS
R2_P4_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
BACKEND_TESTS: 477/477_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS
REPORT: .dev-reports/looply-v1-r2-p4-auth-session-independent-audit.md
GIT_STATE: HEAD 7418226 unchanged; no source changes; nothing staged/committed
KORE_TOUCHED: NO
```

## Git state

```
HEAD:          741822642aacaeb2667cecbfe3812e62dfa0049c (unchanged, == origin/main)
Changed:       none
Untracked:     this report + R2.P4 report + prior M1/M2 reports (ignored/untouched)
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: R2.P4 report, `session.ts`, `password.ts`, `token.ts`, `csrf.ts`, `requireAuth.ts`,
  `authService.ts`, `recoveryService.ts`, `routes/auth.ts`, `lib/env.ts`, `lib/loginLimiter.ts`,
  `app.ts` (middleware mounting), tests (`auth.test.ts`, `passwordRecovery.test.ts`).
- Ran: greps for sensitive-field leakage, auth logging, isProd/CORS/TRUST_PROXY config, CSRF mounting,
  login-limiter config; `git status` / `git diff --check`.
- No secrets printed; no tenant PII printed; no source modified.

---

LOOPLY V1-R2.P4 AUTH SESSION INDEPENDENT AUDIT — PASS