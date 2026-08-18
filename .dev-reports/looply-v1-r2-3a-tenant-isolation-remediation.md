# Looply — V1-R2.3A Tenant Isolation Remediation (`/api/team` cross-tenant PII leak)

Date: 2026-08-18 · Branch: `main` @ `b8cd50b` · No commit, no push.

## Finding

- **FINDING**: R2-01
- **ORIGINAL_SEVERITY**: HIGH
- **REMEDIATION_STATUS**: REMEDIATED

## Original impact

`GET /api/team` returned every registered `User` in the platform (`id, name, email, role, avatarUrl, active, createdAt`) to any authenticated member of any company — a cross-tenant PII (email/name) disclosure, OWASP access-control/API authorization failure, release blocker, and security-gate FAIL.

## Root cause

- **ROOT_CAUSE**: `teamService.listTeam` queried the global `User` table (`db.user.findMany()`) with **no tenant filter**, and `routes/team.ts` did not pass the authenticated company.
- **VULNERABLE_PATH**: `GET /api/team` → `routes/team.ts:11` `listTeam(prisma)` → `services/teamService.ts:4` `db.user.findMany()` → global user list.
- **TENANT_SOURCE_OF_TRUTH**: `req.auth.companyId` — established by `requireAuth` → `resolveAuth` from the authenticated session's active `CompanyMember` membership (never client-supplied). Canonical membership boundary = `CompanyMember` (userId + companyId, unique on [userId, companyId]).
- **BROKEN_CONTROL**: The team path bypassed the `CompanyMember` membership boundary entirely and read the global `User` table. Role auth (requireAuth) was present but is a separate control; the missing tenant guard is what failed.

**Why existing auth did not prevent it**: `requireAuth` confirms *some* authenticated membership but does not scope the team query to that membership's company. `listTeam` read the `User` table globally with no company predicate.

## Fix strategy

- **DATABASE_QUERY_SCOPED**: YES — `listTeam(db, companyId)` now queries `companyMember.findMany({ where: { companyId }, select: { user: { ... } } })`, so the tenant scope is in the SQL itself.
- **CLIENT_SUPPLIED_TENANT_TRUSTED**: NO — `companyId` comes from `req.auth!.companyId` only.
- **RESPONSE_FILTER_ONLY**: NO — scoping is at the data-access boundary, not an in-memory filter.
- Response shape preserved (`{ team: [user...] }` with the same fields), so the frontend requires no change.
- Defense-in-depth retained (requireAuth chain unchanged).

## Files changed

```
backend/src/services/teamService.ts    listTeam now tenant-scoped via CompanyMember
backend/src/routes/team.ts             passes req.auth.companyId to listTeam
backend/tests/teamIsolation.test.ts    new R2-01 tenant-isolation proof (4 tests)
```

## Adjacent team-path audit

- `memberService.listMembers` — already tenant-scoped (`where: { companyId }`), **SAFE**.
- `memberService.updateMember` / `resetMemberPassword` — tenant-scoped (`companyId`), **SAFE**.
- Invitations — tenant-scoped, **SAFE**.
- No other `db.user.findMany()` remains in `src/` (grep verified). **SAME_ROOT_CAUSE: none remaining.**

## Regression / Tenant proof

New `backend/tests/teamIsolation.test.ts` (DB-gated, would fail against the pre-fix global query):
- **Tenant A** (Loyal Tech, `natan@looply.dev` OWNER): `GET /api/team` returns exactly Company A members; no Tenant B email/id/name.
- **Tenant B** (Teste Corp, `dono@testecorp.com` OWNER): returns exactly Company B members; no Tenant A PII.
- Non-owner **MEMBER** (`marina@looply.dev`) confined to Company A; no cross-tenant PII.
- Unauthenticated `GET /api/team` → 401.

## Validation

- Focused tenant-isolation + legacy-team tests: **10 passed** (teamIsolation 4 + legacyTeamDeprecation 6).
- Backend typecheck: PASS.
- Backend build: PASS.
- Frontend team test: **9 passed** (no frontend change; mocks still match response shape).
- `git diff --check`: PASS.

**Full backend suite**: 464/465 passed. The single failure is `jobsWorkflow.test.ts` "default workflows are deterministic" — a **pre-existing, unrelated demo-DB test-data drift** (a leftover custom workflow stage "Teste" in Loyal Tech's workflow from earlier R1.x session testing). It is orthogonal to this fix (my diff touches only team files; workflow stages are unaffected). Recorded, not fixed (anti-loop).

## Security validation

Re-inspected the affected path: tenant scope is in the `CompanyMember` query; `companyId` is session-derived (never client-supplied); response cannot include foreign tenant rows. Narrow code-review pass on the two changed source files confirms the fix is minimal and correct.

## Residual risk

- The `POST /api/team` 410 legacy closure and the global `User` table remain (other user-lookup paths like `responsibleId` reference remain LOW as noted in the R2 audit, out of this battery's scope).
- No schema/migration/dependency changes.

## Schema / migration / frontend / dependency

```
FRONTEND_CHANGE: NO
BACKEND_CHANGE: YES (2 source files + test)
SCHEMA_CHANGE: NO
MIGRATION: NO
NEW_DEPENDENCY: NO
```

## Git state

```
HEAD:               b8cd50b909cbd86d77294bdf77a98f395f9ae0c5 (unchanged)
Changed:            backend/src/routes/team.ts, backend/src/services/teamService.ts, backend/tests/teamIsolation.test.ts
Untracked reports:  .dev-reports/looply-v1-r2-release-security-readiness-audit.md (preserved), this report
Staged/Committed:   none
KORE_TOUCHED:       NO
```

## Skills/tools used

- Skills loaded: `caveman`, `security-audit`, `kore-validate`.
- Inspected via Read/Grep: routes/team.ts, services/teamService.ts, memberService.ts, authService.ts, Prisma schema (CompanyMember/User/Company), generated Prisma types, frontend Team.tsx + api.ts, existing team tests.

## Classification

```
CWE: CWE-639 (Authorization Bypass Through User-Controlled Key) / CWE-200 (Exposure of Sensitive Information)
CVSS: NEEDS_TRIAGE (High, authenticated, PII; conservative — reuse audit severity)
CURRENT_SECURITY_SEVERITY: CLOSED
RELEASE_BLOCKER_B1: CLEARED
```

---

**NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT**
