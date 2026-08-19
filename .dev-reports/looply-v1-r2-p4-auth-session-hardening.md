# Looply — V1-R2.P4 Auth / Session Hardening

Date: 2026-08-19 · Branch: `main` @ `7418226` · Audit only — no source modified, no commit, no push, no stage. `KORE_TOUCHED: NO`.

Purpose: audit and harden authentication/session security without redesigning the auth model.
Result: **clean audit — 0 confirmed findings, no code changes required.**

## Auth architecture summary

- **Auth model**: opaque server-side session tokens. Login issues a fresh 256-bit random token
  (`randomBytes(32).toString("hex")`); only its sha256 hash is stored in the `Session` table
  (`id: hashToken(token)`). The raw token lives only in the `looply_session` httpOnly cookie.
- **Session lifecycle**: created on login (7-day TTL), validated per request via `resolveAuth`,
  revoked server-side on logout / password change / password reset.
- **Tenant binding**: each session row stores `userId` + `companyId`; `resolveAuth` revalidates the
  session → user → active CompanyMember → active company on **every** request.

`AUTH_MODEL: SERVER_SIDE_OPAQUE_TOKEN` · `SESSION_MODEL: DB_BACKED_HASHED_TOKEN` ·
`TENANT_BINDING: AUTHENTICATED_ACTIVE_MEMBERSHIP`.

## Surfaces inspected

`lib/session.ts`, `lib/password.ts`, `lib/token.ts`, `middleware/csrf.ts`, `middleware/requireAuth.ts`,
`services/authService.ts`, `services/recoveryService.ts`, `routes/auth.ts` (login, logout,
change-password, me, switch-company, password-recovery, password-reset), and existing tests
(`auth.test.ts`, `passwordRecovery.test.ts`, `hardening.test.ts`).

## Focus-area findings

### 1. Session creation — SAFE
- Entropy: 256-bit random token (`randomBytes(32)`); sha256-hashed at rest. Not stored in plaintext
  (test: "session token is not stored in plaintext form usable as id").
- Expiration: 7-day TTL enforced in `resolveAuth` (`expiresAt < now` → reject).
- Server-side ownership: session row keyed by hash, bound to `userId` + `companyId` (first active
  membership). No client-controlled tenant authority.
- Rotation: fresh server-generated token on every login; password change rotates (revokes all) and
  issues a new session. **No session fixation** — the server always generates the token; it never
  accepts a client-supplied token as a new session id.

### 2. Session validation — SAFE
- Expired sessions rejected; revoked sessions rejected; inactive/deleted users rejected; inactive
  memberships rejected (resolveAuth + tests). Session companyId falls back to first active membership
  only when the stored membership is gone (and only to an active membership).

### 3. Cookie security — SAFE
- `httpOnly: true`, `secure: isProd`, `sameSite: "lax"`, `path: "/"`. No sensitive token duplicated in
  unsafe storage (no localStorage session token). Matches the cookie SPA deployment.

### 4. Login — SAFE
- **No user enumeration**: `DUMMY_HASH` makes scrypt run once even for unknown emails (timing);
  one generic "Credenciais inválidas" for every bad case. Test covers same error for unknown email /
  wrong password / inactive user.
- **Brute-force**: login rate-limited (`checkLoginRate`, 10/15min per IP+email).
- **Password verification**: scrypt + `timingSafeEqual`.
- **No session fixation**: new server-generated token each login; cookie overwritten.

### 5. Logout / revoke — SAFE
- `logout` sets `revokedAt` on the matching server-side session (idempotent); the token becomes
  unusable (`resolveAuth` returns null after). Old credentials do NOT remain usable. Test covers
  revoke + idempotency + post-logout rejection.

### 6. Password reset — SAFE (R2.3B hardened rate limit; re-audited)
- Token expiry (1h) enforced; one-time use (`usedAt` set on reset, reused token rejected); token
  invalidation after successful reset; all user sessions revoked on reset; no account enumeration
  (neutral message). Tests cover: valid reset revokes sessions + marks token used; expired token
  rejected; already-used token rejected; short password rejected. Raw token only sent via email,
  never returned in a response or logged.

### 7. Authorization boundary after auth — SAFE
- Identity + tenant membership resolved server-side in `resolveAuth` on every request. No route trusts
  `companyId` from body/query/header (test: "companyId in a request body NEVER appears in auth
  context"), role from client, or userId from client as identity.

### 8. CSRF / browser session risk — SAFE (adequate)
- `sameSite: "lax"` prevents the session cookie from being sent on cross-site POSTs (only top-level
  GET navigations). Plus `csrfOriginGuard` blocks unsafe methods whose Origin/Referer is not the
  configured web origin. Public approval token routes are bearer-authenticated (no session cookie) and
  intentionally outside the origin guard. No real CSRF gap for the cookie SPA.

### 9. Sensitive responses / logging — SAFE
- No route returns `passwordHash`/`tokenHash`/raw session tokens (only user profiles, `{ok}`,
  `activeCompanyId`, reset `{ok,message}`). Reset token is email-only.
- No auth event logging of tokens/passwords; the structured logger redacts
  `authorization/cookie/password/token/secret/apikey`; request logger strips query strings and
  approval tokens from paths.

## Suspicious patterns / classification

| Path | Classification |
|------|----------------|
| Login token generation / storage | SAFE (256-bit, hashed, no fixation) |
| resolveAuth validation | SAFE (expired/revoked/inactive all rejected) |
| Logout revocation | SAFE (server-side revoke, idempotent) |
| Password reset token reuse / expiry / revocation | SAFE (one-time, expiry, session revoke) |
| switchCompany | SAFE (granted solely by active membership) |
| Cookie flags | SAFE (httpOnly/secure/lax/path) |
| CSRF origin guard + sameSite | SAFE (adequate for cookie SPA) |
| Client-supplied companyId override | FALSE_POSITIVE (blocked — server resolves tenant) |

`SUSPICIOUS_PATHS: 8` · `CONFIRMED_FINDINGS: 0` · `FALSE_POSITIVES: 1`.

## Security classification

No confirmed CWE-287 / CWE-384 / CWE-613 / CWE-640 / CWE-307 / CWE-352 defect.

## Fixes applied

**None** — no confirmed weaknesses. The auth/session model already meets the hardening baseline.

## Regression proofs

Existing tests already cover the required proofs (no new tests needed — no defect to prove):
- expired/revoked/inactive session/user/membership blocked (`auth.test.ts`)
- inactive membership denies access mid-session
- cross-company session misuse blocked (`switchCompany` A→B, B→A, inactive)
- login returns token + membership, never passwordHash; generic error (no enumeration)
- logout invalidates session (revoke + idempotent + post-logout reject)
- reset token cannot be reused (used token rejected); expired token rejected; reset revokes sessions
- client-supplied companyId cannot override authenticated tenant
- requireRole gates; CSRF origin guard rejects foreign origin

## Validation

- `git diff --check`: PASS (exit 0) — no changes.
- No application source changed → backend suite (477/477), typecheck, and build remain green from
  R2.4A/R2.P2 (evidence reused; nothing to regress). Frontend unchanged.

## Files changed

**None** (audit only). `SCHEMA_CHANGE: NO` · `MIGRATION: NO` · `NEW_DEPENDENCY: NO`.

## Remaining risks

- **0** confirmed auth findings. Residual: multi-device sessions remain valid until their 7-day TTL
  or explicit revocation (intentional multi-session design, not a defect). CSRF relies on
  sameSite=lax + origin guard; adequate for the current single-origin cookie SPA.

## Git state

```
HEAD:          741822642aacaeb2667cecbfe3812e62dfa0049c (unchanged, == origin/main)
Changed:       none
Untracked:     this report + prior M1/M2 Contabo reports (untouched)
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: `session.ts`, `password.ts`, `token.ts`, `csrf.ts`, `requireAuth.ts`, `authService.ts`,
  `recoveryService.ts`, `routes/auth.ts`, tests (`auth.test.ts`, `passwordRecovery.test.ts`,
  `hardening.test.ts`).
- Ran: greps for sensitive-field leakage and auth logging; traced session lifecycle; reviewed existing
  auth/security regression tests; `git status` / `git diff --check`.
- No secrets printed; no tenant PII printed; no source modified.

---

**RESULT: COMPLETE** · `R2_P4_STATUS: COMPLETE` · `NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT` ·
`KORE_TOUCHED: NO`

LOOPLY V1-R2.P4 AUTH SESSION HARDENING — COMPLETE