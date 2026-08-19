# Looply — V1-R2.3B Application Security Independent Audit

Date: 2026-08-19 · Branch: `main` @ `fc655a3` · Audit only — no source modified, no commit, no push, no stage. `KORE_TOUCHED: NO`.

Purpose: independently audit the uncommitted R2.3B application security hardening against the 9
invariants, confirm it is safe to consolidate, and verify the implementation claims.

## Baseline

- HEAD `fc655a3dabe8cf129ee0bd155681e7bc27670a5a` (unchanged, == origin/main).
- Changed: 5 backend source files (rateLimit, auth, media, contentService, identityMediaService) +
  3 test files. `git diff --check`: PASS (exit 0).

## Invariant 1 — Password reset limiter: PASS

- **Correct route:** `PASSWORD_RESET_LIMIT` is attached as middleware to `/api/auth/password-reset`
  in `auth.ts`, listed first in the route handler array → executes before any expensive
  /token-sensitive work (before parse + `resetPasswordWithToken`).
- **Valid flow works:** `hardening.test.ts` verifies the limiter calls `next()` for a fresh attempt.
- **Repeated attempts throttled:** 21 POSTs with the same IP+token, then the 22nd returns 429
  (test proves it genuinely reaches the limit).
- **No account/token existence leak:** `resetPasswordWithToken` returns the same generic error for
  valid/invalid tokens; the limiter returns a generic 429.
- **Bypass analysis:** keyed on `${req.ip}:${token}` (same convention as the existing approval and
  invitation limiters). Rotating the token in the body creates a fresh bucket, so cross-token
  password-spraying is not IP-throttled — but the token is a 256-bit random single-use value, making
  cross-token spraying cryptographically infeasible. The realistic brute-force vector (many password
  attempts against a single known token) IS throttled. Consistent with existing project convention;
  not a bypass of the security purpose.

`PASSWORD_RESET_LIMITER: PASS` · `PASSWORD_RESET_BYPASS: NONE`.

## Invariant 2 — Limiter architecture: ACCEPTABLE_CURRENT_ARCHITECTURE

- Confirmed current deployment is a **single backend instance**: `ecosystem.config.cjs` declares
  `instances: 1, exec_mode: fork`, and PM2 reports 1 online `looply-backend` instance.
- In-memory fixed-window limiters are therefore acceptable for the current architecture.
- `SCALE_TRIGGER`: move to a shared (Redis-backed) limiter when Looply runs **more than one backend
  instance** concurrently. Not required now (would be premature).

## Invariant 3 — responsibleId tenant isolation: PASS

- `createContent` now validates `responsibleId` via `companyMember.findFirst({ userId,
  companyId, isActive: true })` **before** persisting the job (before the `$transaction` that creates
  the content).
- `companyId` is the function parameter passed from `req.auth!.companyId` (contents.ts:49) — the
  canonical authenticated tenant. The client cannot override it (it is never derived from body/query/header).
- Membership check occurs at the authoritative data boundary before persistence.
- Foreign responsibleId → `notFound("Responsável não encontrado")` (safe, no enumeration of whether
  the user exists).
- Legitimate same-tenant assignment still works (test: active member of tenant accepted).

`RESPONSIBLE_ID_SCOPE: PASS` · `CLIENT_TENANT_OVERRIDE: NO` · `CROSS_TENANT_ASSIGNMENT: BLOCKED`.

## Invariant 4 — Adjacent assignment paths: SAFE

- `responsibleId` is only persisted via `createContent` (verified by grep — no update-content
  responsibleId path exists).
- `Appointment.createdByUserId` is set from authenticated `actorUserId` (not client input); its
  `clientId` is validated against `companyId`.
- `memberService` membership creation binds the user to `invitation.companyId` (the company that
  created the single-use token) — a distinct, already-secure token-bound flow, not a client-supplied
  cross-tenant assignment.
- No same-root-cause vulnerability requiring the shared `createContent` fix elsewhere.

`ADJACENT_ASSIGNMENT_PATHS: SAFE`.

## Invariant 5 — users/ media tenant scoping: PASS

- `resolveMediaDownloadUrl` now parses the avatar owner `userId` from the `users/<userId>/...` key
  and verifies `companyMember.findFirst({ userId: ownerUserId, companyId: auth.companyId,
  isActive: true })`. Tenant identity is enforced in the authorization path (not just key namespace).
- Cross-tenant read: Tenant A requesting a `users/<userId>/` key whose owner is a member of Tenant B
  only → `forbidden` (test proves it).
- Legitimate own-tenant media: same-tenant member avatar resolves (test proves it).
- No predictable-key bypass: the membership check uses the authenticated tenant regardless of key
  predictability; `..` path traversal is still rejected.
- Public approval/media flows unaffected: the media route is mounted **after** the `requireAuth` wall
  (app.ts:60 vs mediaRouter at :76); public `/api/public/*` routes are separate and don't serve
  `users/` media.

`MEDIA_TENANT_SCOPE: PASS` · `CROSS_TENANT_MEDIA_ACCESS: BLOCKED` · `LEGITIMATE_MEDIA_REGRESSION: NONE`.

## Invariant 6 — Existing objects / compatibility: PASS

- `users/` keys are generated ONLY by the avatar upload path (`users/${userId}/avatar/${uuid}.${ext}`)
  and read only via that same prefix. The change is a **read-time authorization** change only — key
  generation and storage are unchanged.
- Existing objects remain addressable by their owner's own tenant (the owner is an active member of
  their own company); multi-company members remain viewable by each of their companies.
- No key migration or backward-compat handling required (a member who leaves a company can no longer
  be viewed by that company — the intended tenant-scoping behavior).

`EXISTING_MEDIA_COMPATIBILITY: PASS`.

## Invariant 7 — Test strength: STRONG

All new tests fail against the old vulnerable behavior:
- **Reset abuse test** asserts 429 after 21 attempts — old code (no limiter) would never return 429 → fails on old code. `OLD_WOULD_FAIL: YES`.
- **Foreign responsibleId test** asserts `rejects /Responsável não encontrado/` — old code
  (`user.findUnique`, user exists globally) would succeed → fails on old code. `OLD_WOULD_FAIL: YES`.
- **Foreign media test** asserts `rejects /não autorizado/` — old code (no membership check on
  `users/`) would resolve → fails on old code. `OLD_WOULD_FAIL: YES`.

`REGRESSION_TEST_STRENGTH: STRONG` · `OLD_VULNERABLE_CODE_WOULD_FAIL: YES`.

## Invariant 8 — Scope purity: clean

- No frontend, schema, migration, new dependency, broad auth redesign, or unrelated refactor.
- Changes are surgical and confined to the three findings. No dependency added.

## Invariant 9 — Suite failure: PRE_EXISTING_UNRELATED

- Full backend: 476 passed, 1 failed at `tests/jobsWorkflow.test.ts:28` (workflow stage-name
  demo-data drift). Confirmed unrelated: R2.3B touches no workflow domain files; the failure was
  reproduced in isolation in prior sessions and remains untouched. Not fixed per scope.

## Validation run

- `git status --short` — R2.3B files + reports only.
- `git diff --check` — PASS (exit 0).
- Focused security tests (`hardening`, `contentService`, `identityMedia`, `passwordRecovery`):
  **44/44 PASS**.
- `npm run typecheck` — PASS (exit 0).
- Confirmed single backend instance (ecosystem + PM2) for limiter classification.
- Read the full diff of all changed source + test files; traced password-reset, responsibleId, and
  media key-generation/read paths; verified media route auth wall.
- No dependencies added; full suite not re-run (prior evidence consistent and uncontradicted).

## Findings

- **CRITICAL: 0**
- **HIGH: 0**
- **MEDIUM: 0**
- No real defects found. One informational note (not a defect): the password-reset limiter keys on
  IP+token (consistent with existing approval/invitation limiters); cross-token spraying is not
  IP-throttled but is infeasible given 256-bit random single-use tokens.

## Result

```
CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0

PASSWORD_RESET_LIMITER: PASS
PASSWORD_RESET_BYPASS: NONE

LIMITER_ARCHITECTURE: ACCEPTABLE_CURRENT_ARCHITECTURE

RESPONSIBLE_ID_SCOPE: PASS
CLIENT_TENANT_OVERRIDE: NO
CROSS_TENANT_ASSIGNMENT: BLOCKED
ADJACENT_ASSIGNMENT_PATHS: SAFE

MEDIA_TENANT_SCOPE: PASS
CROSS_TENANT_MEDIA_ACCESS: BLOCKED
LEGITIMATE_MEDIA_REGRESSION: NONE
EXISTING_MEDIA_COMPATIBILITY: PASS

REGRESSION_TEST_STRENGTH: STRONG
OLD_VULNERABLE_CODE_WOULD_FAIL: YES

FULL_SUITE_FAILURE_CLASSIFICATION: PRE_EXISTING_UNRELATED

BACKEND_CHANGE: YES
FRONTEND_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
NEW_DEPENDENCY: NO

R2_3B_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
KORE_TOUCHED: NO
```

## Git state

```
HEAD:          fc655a3dabe8cf129ee0bd155681e7bc27670a5a (unchanged)
Changed:       R2.3B source (5 modified) + tests (3 modified); nothing staged/committed
Untracked:     this report + R2.3B report + prior M1/M2 reports
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: R2.3B report, R2 audit, `rateLimit.ts`, `auth.ts`, `media.ts`, `contentService.ts`,
  `identityMediaService.ts`, `app.ts`, `ecosystem.config.cjs`, and the full test diffs.
- Ran: `git status`, `git diff --check`, focused security tests, backend typecheck; confirmed PM2
  instance count.
- No secrets printed; no tenant PII printed; no source modified.

---

LOOPLY V1-R2.3B APPLICATION SECURITY INDEPENDENT AUDIT — PASS