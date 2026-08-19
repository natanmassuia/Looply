# R2.6A — Final Application Security Re-audit

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** 734799a

## Purpose

Verification battery: re-confirm the application-security baseline after all R2 hardening batteries (P2 tenant/BOLA, 3B app security, P3 input/abuse, P5 error contract, P8 dependency/runtime). No new open-ended sweep; no source changes.

## Prior security batteries referenced

- `looply-v1-r2-p2-tenant-bola-sweep.md` + `-independent-audit.md`
- `looply-v1-r2-3b-application-security-hardening.md` + `-independent-audit.md`
- `looply-v1-r2-p3-api-abuse-input-hardening.md` + `-independent-audit.md`
- `looply-v1-r2-p5-api-contract-error-consistency.md` + `-independent-audit.md`
- `looply-v1-r2-p8-dependency-runtime-hygiene.md` + `-independent-audit.md`

## Invariants revalidated (against current code)

### 1. Tenant isolation / BOLA — PASS
- Canonical authority is `req.auth.companyId` (set by `requireAuth` from hashed session → active member → active company); no client-supplied company override in any inspected path.
- Grep across services: every tenant-owned-object access uses `findFirst/updateMany/deleteMany({ where: { id, companyId } })` or validates the foreign key against `companyId` (clientId, jobId, stageId, memberId, attachment, approval, activity, media).
- `responsibleId` tenant-scoped via `companyMember.findFirst({ userId, companyId, isActive })` (R2.3B fix intact).
- `groupContent` validates both child and parent against `companyId` (circular + cross-tenant blocked).
- No unscoped `findUnique({ id: req.params.* })` direct-ID access found.
- No regression from R2.P2 / R2.3B.

### 2. Auth / session — PASS
- Opaque server-side sessions: `newSessionToken` (random), stored as `hashToken(token)` (hashed at rest) in `session` table.
- Expiration `SESSION_TTL_MS` (7d) + revocation on password change/logout; active user + member + company validated per request.
- Cookie: `httpOnly`, `secure` in prod, `sameSite: lax`, `path: /` — CSRF posture unchanged.
- `csrfOriginGuard` still mounted in `app.ts`.
- Login rate-limited (`checkLoginRate`); password-reset (`PASSWORD_RESET_LIMIT`), invitation-accept (`INVITATION_ACCEPT_LIMIT`), public-approval read/write limits all wired.
- Password-reset tokens single-use, hashed (`hashToken`), with expiry + session revocation on reset.

### 3. Input / abuse — PASS
- Malformed JSON → 400 `bad_request` (`entity.parse.failed` mapping intact in `errors.ts`).
- Oversized body → 413 `payload_too_large` (`entity.too.large`).
- Unexpected internal error → 500 `internal_error`.
- Representative malformed IDs/enums/dates/pagination: tenant-scoped 404s; `z.enum`/`z.string().datetime()` validation; pagination capped (limit ≤ 100).
- No parser/internal detail leakage (generic messages; 5xx stack only in dev).

### 4. Error contract — PASS
- Canonical shape `{ error: { code, message, requestId?, details? } }` via `errorHandler` confirmed unchanged.
- Domain conflict (invalid content-state transition) → 409 `invalid_state` (R2.P5 `TransitionError` fix intact).
- Validation errors → 400 `validation_error` (R2.P5 appointments fix intact).
- Genuine unexpected errors → 500; no stack/Prisma/internal-schema leakage.

### 5. Dependency / supply chain — PASS
- backend full audit: 0 Critical / 0 High / 0 Medium / 0 Low.
- frontend full audit: 0 Critical / 0 High / 0 Medium / 0 Low.
- `npm ci` deterministic (lockfiles match manifests); no known vulnerable toolchain chain (R2.P8).

### 6. CI security gate — PASS
- `.github/workflows/ci.yml` enforces: SAST (semgrep), SCA (`npm audit --omit=dev --audit-level=high` for backend+frontend = 0 critical/0 high prod policy), secret scan (gitleaks).
- Triggers: `pull_request` + `push` to `main`.
- No `continue-on-error` / trivial bypass.
- Node 22 within `>=22` engines (consistent with repo).

## Findings

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0

## Application release decision

- APPLICATION_SECURITY_GATE: PASS
- APPLICATION_RELEASE_BLOCKERS: 0
- No confirmed unresolved Critical/High application finding.

## Infra-only follow-ups (explicitly separated — NOT application defects)

- Off-host backup proof (R2.1D — B2 remains PARTIAL)
- External alert delivery proof
- Explicit Node runtime pin (dev 24 vs CI 22 drift; R2.P8)
- Contabo provisioning/migration (R2.M2/M3)
- CIS / host hardening

## Validation (sequential, resource-safe ~1.7Gi available)

- BACKEND_FULL_AUDIT: 0/0/0/0
- FRONTEND_FULL_AUDIT: 0/0/0/0
- BACKEND_TESTS: 481/481 PASS
- FRONTEND_TESTS: 305/305 PASS
- BACKEND_TYPECHECK: PASS
- FRONTEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- FRONTEND_BUILD: PASS
- DIFF_CHECK: PASS

## Result

RESULT: PASS
TENANT_BOLA: PASS
AUTH_SESSION: PASS
INPUT_ABUSE: PASS
ERROR_CONTRACT: PASS
DEPENDENCY_SECURITY: PASS
CI_SECURITY_GATE: PASS

CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0
LOW_FINDINGS: 0

BACKEND_FULL_AUDIT: 0/0/0/0
FRONTEND_FULL_AUDIT: 0/0/0/0

BACKEND_TESTS: 481/481_PASS
FRONTEND_TESTS: 305/305_PASS
BACKEND_TYPECHECK: PASS
FRONTEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
FRONTEND_BUILD: PASS
DIFF_CHECK: PASS

APPLICATION_SECURITY_GATE: PASS
APPLICATION_RELEASE_BLOCKERS: 0

INFRA_ONLY_FOLLOWUPS: off-host backup proof; external alert delivery proof; explicit Node runtime pin; Contabo provisioning/migration; CIS/host hardening

SOURCE_CHANGE: NO
TEST_CHANGE: NO
DEPENDENCY_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO

R2_6A_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INFRA_SECURITY_AND_MIGRATION

REPORT: .dev-reports/looply-v1-r2-6a-application-security-reaudit.md
GIT_STATE: no source/test changes; reports (M1/M2 + this) untracked; HEAD 734799a
KORE_TOUCHED: NO

LOOPLY R2.6A FINAL APPLICATION SECURITY RE-AUDIT — PASS