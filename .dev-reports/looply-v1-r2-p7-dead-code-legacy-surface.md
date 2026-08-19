# R2.P7 — Dead Code / Legacy Surface

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** c8eeed0

## Scope

Audit only dead/legacy code increasing maintenance or security surface. No open-ended cleanup; no refactor of working code; strong evidence required before any removal.

## Candidates reviewed (10)

| Candidate | Classification | Evidence |
|---|---|---|
| `src/scripts/provision.ts` | LEGACY_BUT_STILL_USED | Operator provisioning CLI. Referenced by `team.ts` B4 comment ("New users enter ONLY via Verbum provisioning CLI or invitation acceptance") and `package.json`. Operational tooling — protected. |
| `src/scripts/reconcileAttachments.ts` | LEGACY_BUT_STILL_USED | Operational B12 command; wired to `package.json` `attachments:reconcile` script. Protected operational tooling. |
| `src/services/attachmentReconciliationService.ts` | ACTIVE | Imported only by the reconcile script (its operational caller); service is the implementation behind that command. |
| `src/services/whatsappProvider.ts` | ACTIVE | `getWhatsAppProvider` used by both webhook routes + `assistantRuntime`; `GUPSHUP_PROVIDER_NAME` shared with gupshupProvider. |
| `src/services/gupshupProvider.ts` | ACTIVE | Wired to `/api/webhooks/whatsapp/gupshup` route. |
| `src/services/mailService.ts` / `recoveryService.ts` | ACTIVE | `mailService` + `requestPasswordRecovery` dynamically imported in `routes/auth.ts` password-recovery path. |
| `src/services/approvalService.ts` (all exports) | ACTIVE | `createApproval`/`listApprovals`/`getInternalApproval`/`revokeApproval` wired to `approvalsInternal.ts`; `publicFileDownload`/`getPublicApproval`/`approve`/`reject`/`requestChanges` wired to public `approvals.ts`. |
| `src/routes/team.ts` POST (410) | LEGACY_BUT_STILL_USED | Intentional deprecation contract, not dead. Actively tested by `legacyTeamDeprecation.test.ts` (asserts 410 `gone`). Removing it would flip behavior to 404 and break the documented closed contract. |
| `src/routes/publications.ts` / `listPublications` | ACTIVE | Mounted in `app.ts`, reachable route. |
| All route files | ACTIVE | Every router imported + mounted in `app.ts`; none unreferenced. |

## Classifications

- ACTIVE: 6
- LEGACY_BUT_STILL_USED: 3 (provision.ts, reconcileAttachments.ts, team.ts 410 route)
- CONFIRMED_DEAD: 0
- FALSE_POSITIVES: 1 (the two scripts looked unreferenced at first, proven operational tooling)
- NEEDS_PRODUCT_DECISION: 0

## Removals applied

None. No candidate met the strong-evidence bar for CONFIRMED_DEAD:

- Scripts are operational tooling (explicitly protected).
- WhatsApp/mail/approval services are all wired to live routes.
- `team.ts` 410 is an intentional, tested deprecation contract, not dead code.
- No unreferenced route files; every router is mounted.

## Retained legacy code and why

- `team.ts` POST 410 — deliberate closed contract (security surface intentionally kept as a hard stop, replacing a removed vulnerable creation path). Retained for backward-compat signaling.
- Provisioning + reconcile CLI scripts — operator ops tooling, still the documented way to create workspaces / reconcile attachments.

## Remaining decisions

None requiring product intent — every candidate is clearly active or intentionally retained.

## Validation

No source/test changes → no behavior change; existing validated state reused (backend 481/481 PASS, typecheck/build PASS previously confirmed on unchanged tree; diff empty). No heavy revalidation warranted for a no-op.

- BACKEND_TESTS: ALL_PASS (unchanged, 481/481)
- DIFF_CHECK: PASS (no changes)

## Files changed

None.

## Result

RESULT: PASS
CANDIDATES_REVIEWED: 10
ACTIVE: 6
LEGACY_BUT_USED: 3
CONFIRMED_DEAD: 0
FALSE_POSITIVES: 1
NEEDS_PRODUCT_DECISION: 0

REMOVALS_APPLIED: 0
FILES_CHANGED: NONE
LINES_REMOVED: 0
BEHAVIOR_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
DEPENDENCY_CHANGE: NO

BACKEND_TESTS: ALL_PASS (481/481)
FRONTEND_TESTS: N/A (no frontend change)
BACKEND_TYPECHECK: PASS
FRONTEND_TYPECHECK: N/A
BACKEND_BUILD: PASS
FRONTEND_BUILD: N/A
DIFF_CHECK: PASS

REMAINING_DEAD_CODE_FINDINGS: 0
R2_P7_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT
REPORT: .dev-reports/looply-v1-r2-p7-dead-code-legacy-surface.md
GIT_STATE: no source/test changes; reports (M1/M2/P6/P7 + this) untracked; HEAD still c8eeed0
KORE_TOUCHED: NO

LOOPLY R2.P7 DEAD CODE LEGACY SURFACE — COMPLETE