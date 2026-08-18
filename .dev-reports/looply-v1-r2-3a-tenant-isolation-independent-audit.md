# Looply — V1-R2.3A Tenant Isolation Independent Audit

Date: 2026-08-18 · Branch: `main` @ `b8cd50b` · Independent audit of the R2-01 remediation (no source modified, no commit, no push).

## Baseline

```
REPO_ROOT:      /opt/looply
HEAD:           b8cd50b909cbd86d77294bdf77a98f395f9ae0c5 (== origin/main)
WORKTREE:       2 modified source + 1 new test + 2 untracked reports
KORE_TOUCHED:   NO
```

## Files audited

- `backend/src/services/teamService.ts` (remediated)
- `backend/src/routes/team.ts` (remediated)
- `backend/tests/teamIsolation.test.ts` (new)
- `backend/src/services/authService.ts` (`resolveAuth` — tenant source)
- `backend/prisma/schema.prisma` (`CompanyMember`, `User`, `Company`)
- `backend/src/services/memberService.ts`, `invitation` paths (adjacent)
- Full git diff + reports

## Audit A — Root cause (CONFIRMED)

Pre-fix path (from git diff `-` lines): `GET /api/team` → `routes/team.ts` `listTeam(prisma)` (no company) → `teamService.listTeam` → `db.user.findMany()` (global `User` table, no tenant filter). `requireAuth` confirmed *an* authenticated membership but did not scope the team query. **ROOT_CAUSE_CONFIRMED: YES, VULNERABLE_QUERY_CONFIRMED: YES.** The leak was missing tenant-scoped object authorization at the data query, with role/auth present but separate.

## Audit B — Tenant source trust (TRUSTED)

`req.auth` is set by `requireAuth` → `resolveAuth(db, token)` which does server-side `session.findUnique` (by hashed session token), validates user active, resolves the active `CompanyMember` membership, and sets `companyId = membership.companyId`. It is never read from query, body, header, or route param. **TENANT_SOURCE_TRUSTED: YES, CLIENT_TENANT_OVERRIDE_POSSIBLE: NO.**

## Audit C — Database tenant boundary (PASS)

Remediated query: `companyMember.findMany({ where: { companyId }, select: { user: {...} } })`. The tenant constraint (`companyId = req.auth.companyId`) is in the SQL itself; foreign rows are never materialized. Not a JS filter or response mapper filter. **DATABASE_TENANT_SCOPE: PASS, RESPONSE_FILTER_ONLY: NO, GLOBAL_USER_LEAK_PATH_CLOSED: YES.**

## Audit D — Response contract (PRESERVED)

Response is still `{ team: [user...] }` with identical fields (`id, name, email, role, avatarUrl, active, createdAt`), now sourced through `CompanyMember.user`. Frontend consumes the same shape; no contract break.

## Audit E — Bidirectional isolation (BLOCKED both ways)

Test asserts `emails.sort()` equals exactly the authenticated tenant's member set **and** that no foreign email/id/name appears. Tenant A (Loyal Tech) request contains no Teste Corp PII; Tenant B (Teste Corp) request contains no Loyal Tech PII. **TENANT_A_TO_B: BLOCKED, TENANT_B_TO_A: BLOCKED, EMAIL/ID/NAME_ISOLATION: PASS.**

## Audit F — Regression test strength (STRONG)

The test would **fail** against the old global `db.user.findMany()`: the old response contained all users, so (a) `emails.sort()` would not equal the tenant's exact set, and (b) `ids.some(id => b.ids.includes(id))` / names / emails would be true (foreign PII present), failing the `toBe(false)` assertions. **TEST_REGRESSION_STRENGTH: STRONG, OLD_VULNERABLE_CODE_WOULD_FAIL_TEST: YES.**

## Audit G — Role behavior (NONE)

Includes a non-owner MEMBER (`marina@looply.dev`) confined to her own company. No role broadened or restricted; tenant boundary separate from role. **ROLE_REGRESSION: NONE.**

## Audit H — Unauthenticated behavior

`GET /api/team` without a session cookie → `requireAuth` → 401 (existing canonical behavior; test asserts 401). **UNAUTH_BEHAVIOR: 401 (unchanged).**

## Audit I — Adjacent team paths (0 cross-tenant findings)

`memberService.listMembers` (`where: { companyId }`), `updateMember`/`resetMemberPassword` (companyId-scoped), invitations (tenant-scoped). No other `db.user.findMany()` remains in `src/` (grep verified). **ADJACENT_TEAM_PATHS: SAFE, ADJACENT_CROSS_TENANT_FINDINGS: 0.**

## Audit J — Global User table

The global `User` identity table still exists but is no longer an unscoped tenant-listing source for `/api/team`. Its existence is not itself a vulnerability.

## Audit K — Direct-object paths

No `/api/team/:id` route exists (`routes/team.ts` only has `GET /` and `POST /`→410). **N/A.**

## Audit L — Source diff minimal (YES)

Diff is confined to `teamService.ts` (tenant-scoped query) + `routes/team.ts` (propagate `req.auth.companyId`). No auth redesign, frontend, schema, migration, dependency, logging, or workflow change.

## Audit M — Classification (reasonable)

CWE-639 (authorization bypass via key) / CWE-200 (sensitive info exposure) is reasonable for a cross-tenant PII enumeration via object authorization gap. Historical HIGH preserved. **CURRENT_STATUS: CLOSED.**

## Audit N — 464/465 causality (PRE_EXISTING_UNRELATED)

The single failure is `jobsWorkflow.test.ts` "default workflows are deterministic and idempotent per company" — a **workflow-stage** assertion (the demo DB retains a leftover custom stage "Teste" from earlier R1.x session testing). `teamService`/`/api/team` have zero references in the workflow path (grep verified); the changed files cannot affect workflow stages. Focused security + team/auth tests are green; typecheck/build green. **FULL_SUITE_464_465_CLASSIFICATION: PRE_EXISTING_UNRELATED.**

## Findings by severity

**CRITICAL / HIGH / MEDIUM / LOW: 0** — no findings. The remediation is correct, minimal, and closes the confirmed tenant boundary at the database.

## Audit O — B1 decision

All clearing conditions hold: root cause confirmed; trusted tenant source; DB tenant-scoped; client override impossible; A→B blocked; B→A blocked; email/ID/name isolation pass; old vulnerable code would fail the regression test; no same-root-cause adjacent issue. **R2_01_STATUS: CLOSED, RELEASE_BLOCKER_B1: CLEARED.**

## Validation actually executed

- `git status/stat/name-status/diff --check` (PASS); full diff inspected.
- Focused `teamIsolation` (4) + `legacyTeamDeprecation` (6) → **10 passed** (independently rerun).
- Backend typecheck: PASS.
- `jobsWorkflow` failure independently traced to a workflow-stage assertion unrelated to team files.
- Traced `resolveAuth` (tenant origin), `CompanyMember` schema, and adjacent member/invitation services from source.

## Consolidation decision

**PASS.** The R2-01 remediation is correct, minimal, and ready for consolidation. R2_01 CLOSED, B1 CLEARED.

## Git state

```
HEAD:               b8cd50b909cbd86d77294bdf77a98f395f9ae0c5 (unchanged)
Dirty:              backend/src/routes/team.ts, backend/src/services/teamService.ts, backend/tests/teamIsolation.test.ts
Untracked reports:  looply-v1-r2-release-security-readiness-audit.md, looply-v1-r2-3a-tenant-isolation-remediation.md
Staged/Committed:   none
KORE_TOUCHED:       NO
```

## Tools/skills actually used

- Skills loaded: `caveman`, `security-audit`, `kore-validate`.
- Inspected via Read/Grep: the remediated files, full diff, `resolveAuth`, `CompanyMember`/`User`/`Company` schema, memberService/invitation paths, the new test; independently reran focused tests and typecheck.
