# R2.P7 — Dead Code / Legacy Surface — Independent Audit

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** c8eeed0

## Audit scope

- `.dev-reports/looply-v1-r2-p7-dead-code-legacy-surface.md`
- Reference evidence re-verified for the three flagged candidates + dynamic-usage paths.
- No new repository sweep; no source/test changes (no defect was confirmed).

## Candidate verification

### 1. provision.ts → RETAIN
- Calls `provisionWorkspace` from `onboardingService.ts` — the operator CLI for creating new workspaces.
- `team.ts` B4 comment: "New users enter ONLY via Verbum provisioning CLI or invitation acceptance."
- `schema.prisma` line 242: provisioning is "the only controlled path for new users besides Verbum provisioning."
- `onboardingService.provisionWorkspace` is unit-tested (`onboardingMembers.test.ts`, "provisioning" describe).
- Operational purpose confirmed; not an abandoned production-capable script. **RETAIN.**

### 2. reconcileAttachments.ts → RETAIN
- Wired to `package.json` `attachments:reconcile` script (line 15).
- Operational B12 maintenance/recovery command: marks stale PENDING attachments FAILED and reconciles AVAILABLE metadata against object storage (`attachmentReconciliationService`).
- Legitimate maintenance/recovery use; backing service is unit-tested (`reconciliation.test.ts`). **RETAIN.**

### 3. team.ts deprecated 410 route → INTENTIONAL_DEPRECATION_CONTRACT
- Route comment explicitly documents the 410 as the replacement for the removed vulnerable user-creation path.
- `legacyTeamDeprecation.test.ts` (5 tests) asserts `POST /api/team` → 410 `gone`, no user created, for OWNER/ADMIN/MEMBER and unauthenticated 401; `GET /api/team` preserved.
- Removing it would flip the API contract 410→404 and break the tests. **INTENTIONAL_DEPRECATION_CONTRACT.**

### 4. Remaining candidates
- ACTIVE classifications (whatsappProvider, gupshupProvider, mailService/recovery, approvalService exports, publications/listPublications, all mounted routers) confirmed via reference evidence — all have live route/runtime callers.

### 5. Dynamic usage risk
All three retained candidates are reached through **indirect** paths that a naive static grep could miss:
- provision.ts → CLI invocation (`npx tsx src/scripts/provision.ts`), not an import.
- reconcileAttachments.ts → `package.json` script (`attachments:reconcile`), not an import.
- team.ts 410 → route registration in `app.ts` + runtime tests.
None falsely considered unused. **DYNAMIC_USAGE_RISK: CLEARED.**

## Scope confirmation

- SOURCE_CHANGE: NO
- TEST_CHANGE: NO
- BEHAVIOR_CHANGE: NO
- DEPENDENCY_CHANGE: NO
- SCHEMA_CHANGE: NO
- MIGRATION: NO

## Validation (evidence reused — no changes since last validated run)

- BACKEND_TESTS: 481/481_PASS
- BACKEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- DIFF_CHECK: PASS

## Result

RESULT: PASS
CANDIDATES_REVIEWED: 10
ACTIVE_CONFIRMED: YES
LEGACY_BUT_USED_CONFIRMED: YES
FALSE_POSITIVES_CONFIRMED: YES

PROVISION_SCRIPT: RETAIN
RECONCILE_ATTACHMENTS_SCRIPT: RETAIN
TEAM_410_ROUTE: INTENTIONAL_DEPRECATION_CONTRACT

DYNAMIC_USAGE_RISK: CLEARED
CONFIRMED_DEAD: 0
NEEDS_PRODUCT_DECISION: 0

SOURCE_CHANGE: NO
TEST_CHANGE: NO
BEHAVIOR_CHANGE: NO
DEPENDENCY_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO

BACKEND_TESTS: 481/481_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

REMAINING_DEAD_CODE_FINDINGS: 0
R2_P7_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
REPORT: .dev-reports/looply-v1-r2-p7-dead-code-independent-audit.md
GIT_STATE: no source/test changes; reports (M1/M2/P6/P7 + this) untracked; HEAD still c8eeed0
KORE_TOUCHED: NO

LOOPLY R2.P7 DEAD CODE INDEPENDENT AUDIT — PASS