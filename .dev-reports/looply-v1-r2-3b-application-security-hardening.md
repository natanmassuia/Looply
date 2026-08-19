# Looply — V1-R2.3B Application Security Hardening

Date: 2026-08-19 · Branch: `main` @ `fc655a3` · No commit, no push, no stage. `KORE_TOUCHED: NO`.

Addresses the remaining application-level security findings from the R2 audit
(`.dev-reports/looply-v1-r2-release-security-readiness-audit.md`), with minimal, surgical changes.

## Findings audited and remediated

### 1. R2-02 — Password reset token rate limiting (MEDIUM → CLOSED)

**Root cause:** `/api/auth/password-reset` (token consumption) was not rate-limited. An attacker
could hammer a reset token or spray tokens without throttling. The `/password-recovery` (request)
endpoint was already rate-limited via `checkLoginRate` in `recoveryService.ts:23`.

**Code change required:** YES.

**Remediation:** Added `PASSWORD_RESET_LIMIT` to the existing `rateLimit.ts` (reusing the project's
in-process `requestRateLimit` infrastructure — no new framework), keyed on `IP + token`, max 20 /
15min. Applied as middleware to the `/password-reset` route in `auth.ts`. This blunts brute-force /
token-spraying per source+token. The endpoint still returns the same generic error for valid/invalid
tokens (no account/token existence leak), and valid resets within the window proceed normally.

**Regression proof:** `hardening.test.ts` — (a) 21 POSTs to `/password-reset` with the same token then
the next returns 429; (b) the limiter middleware calls `next()` for a fresh attempt (valid flow allowed).

`PASSWORD_RESET_RATE_LIMIT: PASS` · `PASSWORD_RESET_FINDING_STATUS: CLOSED`.

### 2. R2-03 — In-memory single-node limiters (MEDIUM hardening → classified)

**Assessment:** The in-memory fixed-window limiters (`rateLimit.ts` Map, `loginLimiter.ts` Map) are
single-process, cleared on restart, and not shared across instances. The current deployment is a
**single PM2 fork instance** (1 process, `ecosystem.config.cjs` `instances: 1`). For this
architecture the limiters are adequate.

**Code change required:** NO (documented scaling limitation only).

**Classification:** `LIMITER_ARCHITECTURE: ACCEPTABLE_CURRENT_ARCHITECTURE`.
`DISTRIBUTED_LIMITER_REQUIRED_NOW: NO`. Limitation documented: if Looply ever runs multiple backend
instances, the in-memory limiters must move to a shared store (Redis). No Redis/distributed
limiting introduced (would be premature for single-node).

### 3. R2-05 — Cross-tenant responsibleId (LOW → CLOSED)

**Root cause:** `createContent` in `contentService.ts` validated `responsibleId` with
`db.user.findUnique({ where: { id } })` — no tenant scope. Tenant A could assign a user from Tenant B
as the responsible user of Tenant A's content (a cross-tenant foreign reference).

**Code change required:** YES.

**Remediation:** `createContent` now validates that `responsibleId` is an **active member of the
authenticated tenant** via `db.companyMember.findFirst({ where: { userId, companyId, isActive: true } })`.
`companyId` is the canonical authenticated tenant (`req.auth!.companyId`), never client-supplied.
Rejected with the project's normal `notFound("Responsável não encontrado")` (does not reveal whether
the user exists).

**Regression proof:** `contentService.test.ts` — (a) Tenant A assigning a user who is a member of
Tenant B ONLY → rejected `/Responsável não encontrado/`; (b) Tenant A assigning an active member of
Tenant A → succeeds. Existing create/sendForApproval tests updated with membership fixtures.

`RESPONSIBLE_ID_TENANT_SCOPE: PASS` · `RESPONSIBLE_ID_FINDING_STATUS: CLOSED` ·
`CROSS_TENANT_ASSIGNMENT_PROOF: PASS`.

### 4. R2-04 — media users/ prefix (LOW → CLOSED_OR_SAFE_BY_AUTHORIZATION)

**Root cause:** `resolveMediaDownloadUrl` in `identityMediaService.ts` allowed ANY authenticated user
from ANY company to download any `users/<userId>/avatar/...` object (the `users/` branch performed no
tenant check). The audit classified this LOW because avatars are non-secret identity images, but it
was a real cross-tenant access-control deviation on the media-serving path.

**Code change required:** YES (minimal access-control fix — NOT a storage-key migration).

**Remediation:** `resolveMediaDownloadUrl` now accepts a `db` and, for `users/` keys, verifies the
avatar owner (`userId` parsed from the key) is an **active member of the requesting tenant**
(`db.companyMember.findFirst({ where: { userId: ownerUserId, companyId: auth.companyId, isActive: true } })`).
If not, returns `forbidden("Acesso não autorizado ao arquivo de mídia")`. `company/` keys remain
tenant-scoped; everything else forbidden. The `media.ts` route now passes `prisma`.

**Regression proof:** `identityMedia.test.ts` — (a) same-tenant member avatar view allowed; (b)
cross-tenant member avatar view (Tenant A reading Tenant B's member media) → 403 forbidden; (c)
existing company-logo cross-tenant + path-traversal tests still pass.

`MEDIA_PREFIX_CLASSIFICATION: users/ now tenant-scoped` · `MEDIA_AUTHORIZATION: PASS` ·
`MEDIA_FINDING_STATUS: CLOSED_OR_SAFE_BY_AUTHORIZATION` · `CROSS_TENANT_MEDIA_PROOF: PASS`.

### 5. Adjacent same-root-cause paths

- **`responsibleId`**: only assignment path is `createContent` (verified via grep — no
  update-content responsibleId path exists). No other client-supplied user-assignment path.
- **`Appointment.createdByUserId`**: set from authenticated `actorUserId`, not client input; its
  `clientId` IS validated against `companyId` (`assertClientBelongsToCompany`). Safe.
- **Invitation/membership (`memberService`)**: `companyMember.create` binds the user to
  `invitation.companyId` (the company that created the single-use invite token) — a distinct,
  already-secure token-bound flow, NOT directly analogous to the `responsibleId` finding. No
  same-root-cause vulnerability. Audited as safe; no code change (would be out-of-scope redesign).

`ADJACENT_PATHS_AUDITED: YES` · `ADJACENT_FINDINGS: 0`.

## Security invariants preserved

- Tenant isolation: responsibleId + media now enforce authenticated-tenant membership.
- Role authorization / API response compatibility: unchanged; same error semantics.
- No new PII leakage; no secret leakage. No schema/migration/frontend/dependency changes.

## Findings summary

```
CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0
LOW_FINDINGS: 0 (all audited findings remediated or classified)
```

## Files changed

```
Modified (source): backend/src/lib/rateLimit.ts, backend/src/routes/auth.ts,
                   backend/src/routes/media.ts, backend/src/services/contentService.ts,
                   backend/src/services/identityMediaService.ts
Modified (test):    backend/tests/contentService.test.ts, backend/tests/hardening.test.ts,
                   backend/tests/identityMedia.test.ts
```

`BACKEND_CHANGE: YES` · `FRONTEND_CHANGE: NO` · `SCHEMA_CHANGE: NO` · `MIGRATION: NO` ·
`NEW_DEPENDENCY: NO`.

## Validation (sequential, resource-safe — 1.8Gi available)

- Focused security tests (`hardening`, `contentService`, `identityMedia`): **38/38 PASS**.
- Relevant auth/domain tests (`passwordRecovery`, `auth`, `contentCancel`, `jobsAtomic`): **32/32 PASS**.
- `npm run typecheck`: PASS (exit 0).
- `npm run build`: PASS (exit 0).
- Full backend suite: **476 passed** (5 new tests added), **1 pre-existing failure** in
  `tests/jobsWorkflow.test.ts:28` (workflow stage-name demo-data drift, unrelated to R2.3B — not fixed,
  per scope).
- `git diff --check`: PASS (exit 0).

## Residual risk

- In-memory limiters remain single-node (acceptable for the current single-instance deployment;
  must move to shared store if Looply ever scales to multiple instances).
- Avatars under `users/` are now tenant-scoped but remain downloadable by any active member of the
  owning tenant (intended — team avatars are visible to the team).

## Git state

```
HEAD:          fc655a3dabe8cf129ee0bd155681e7bc27670a5a (unchanged)
Changed:       8 backend files (5 source + 3 test); nothing staged/committed
Untracked:     this report + prior M1/M2 reports
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: `rateLimit.ts`, `loginLimiter.ts`, `auth.ts`, `recoveryService.ts`, `contentService.ts`,
  `identityMediaService.ts`, `media.ts`, `memberService.ts`, `appointmentService.ts`,
  `schema.prisma`, tests (`hardening`, `contentService`, `identityMedia`, `passwordRecovery`).
- Ran: focused + relevant + full backend tests, typecheck, build, `git diff --check`.
- No secrets printed; no tenant PII printed.

---

**RESULT: COMPLETE** · `R2_3B_STATUS: COMPLETE` · `NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT` ·
`KORE_TOUCHED: NO`

LOOPLY V1-R2.3B APPLICATION SECURITY HARDENING — COMPLETE