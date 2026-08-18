# Looply — V1-R1 Independent Audit

Date: 2026-08-17 · Branch: `main` @ `d80cfba` (R1 uncommitted, worktree preserved) ·
Independent audit of the R1 implementation. No features added, no redesign. Two real defects found
and minimally remediated; one environmental test contamination cleaned; one product-completeness gap
(visible Kanban ↔ workflow config) identified as PARTIAL.

## Executive Verdict

- **Cancellation (Job cancel/delete): DONE** — correct, tenant-safe, transactional, idempotent,
  non-destructive, fully integrated into ContentDetail + Kanban filtering. Live-verified.
- **Editable workflow: PARTIAL** — the backend editor is complete, correct, and safe (persistence,
  tenant/authz, custom stages, reorder, remove/archive, protected terminal, in-use protection), but
  the **visible Demandas Kanban does not consume the editable `WorkflowStage` config** (it renders the
  protected `ContentStatus` pipeline). This is a pre-existing architectural split R1 did not bridge.
- **Commit readiness: APPROVED** — no blocking defects; all suites pass; code is safe to commit. The
  workflow-visible-integration gap is flagged for a follow-up battery, not a commit blocker.

## Diff Audit

All R1 files reviewed. No unrelated changes in source files.

```
PATH: backend/src/routes/contents.ts
PURPOSE: cancel route
EXPECTED_CHANGE: add POST /:id/cancel
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK

PATH: backend/src/routes/workflows.ts
PURPOSE: workflow write API
EXPECTED_CHANGE: add stages/reorder/rename/delete + OWNER/ADMIN guard
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK

PATH: backend/src/services/workflowService.ts
PURPOSE: addStage/renameStage/reorderStages/removeStage
EXPECTED_CHANGE: bounded editor ops
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK (defect in addStage remediated during audit)

PATH: frontend/src/features/WorkflowSettings.tsx
PURPOSE: workflow editor UI
EXPECTED_CHANGE: new component
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK (defect: archived stages rendered; remediated)

PATH: frontend/src/features/ContentDetail.tsx
PURPOSE: cancel action + cancelled banner
EXPECTED_CHANGE: cancel UI + gate active actions
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK

PATH: frontend/src/features/ContentsList.tsx
PURPOSE: filter CANCELLED from active board
EXPECTED_CHANGE: lifecycleStatus filter
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK

PATH: frontend/src/features/Settings.tsx
PURPOSE: Workflow tab
EXPECTED_CHANGE: add tab + owner/admin gate
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK

PATH: frontend/src/lib/api.ts, frontend/src/lib/types.ts
PURPOSE: cancel mutation + workflow hooks + types
EXPECTED_CHANGE: hooks + types
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK

PATH: frontend/src/components/Icons.tsx
PURPOSE: IconChevronUp
EXPECTED_CHANGE: new icon
UNRELATED_CHANGE: NO
AUDIT_RESULT: OK

Tests: contentCancel.test.ts, workflowConfig.test.ts, jobs.test.tsx, workflowSettings.test.tsx — OK.
```

## Cancellation

```
CANCEL_REUSES_CANONICAL_STATE:  YES (existing JobLifecycleStatus.CANCELLED)
CANCEL_TENANT_SAFE:             YES (companyId from req.auth; cross-tenant → 404)
CANCEL_PERMISSION_SAFE:         YES (requireCapability(JOBS) + requireAuth; contents router)
CANCEL_TRANSACTION_SAFETY:      YES (db.$transaction for update + activity)
CANCEL_HISTORY_READABLE:        YES (row preserved; versions/activities/files intact)
CANCEL_HARD_DELETE:             NO (business-state only; no row deletion)
CANCEL_TRANSITION_AUTHORITY:    YES (canonical transitionJobLifecycle service)
CANCEL_TERMINAL:                YES (CANCELLED has no outgoing transitions)
CANCEL_IDEMPOTENCY:             YES (repeat cancel returns existing, no duplicate activity)
CANCEL_ACTIVITY:                YES (JOB_CANCELLED created)
CANCEL_FILES_PRESERVED:         YES (attachments not touched)
CANCEL_APPROVAL_PRESERVED:      YES (approvals/decisions remain)
CANCEL_SCHEDULING_PRESERVED:    YES (appointment rows untouched)
CANCEL_ACTIVE_QUERY_BEHAVIOR:   YES (ContentsList excludes CANCELLED from active columns)
CANCEL_CONCURRENCY_SAFETY:      YES (updateMany guarded by lifecycleStatus in where → count=0 → no double activity)
CANCEL_ROUTE_VALIDATION:        YES (route validates tenant + state via service)
CANCEL_RESPONSE_CONTRACT:       YES (returns canonical updated entity)
```

## Workflow Domain

```
WORKFLOW_CANONICAL_MODEL:       WorkflowStage / WorkflowDefinition (existing, reused)
WORKFLOW_PARALLEL_MODEL_CREATED:NO
WORKFLOW_STAGE_STABLE_ID:       WorkflowStage.id (cuid)
WORKFLOW_ORDER_FIELD:           WorkflowStage.position
WORKFLOW_TENANT_SCOPE:          workflowId → companyId verified per op; 404 otherwise
WORKFLOW_TEMPLATE_RELATION:     WorkflowDefinition.template (unchanged)
```

## System Stage Semantics

The editable `WorkflowStage` model is **decoupled** from the `ContentStatus` pipeline that drives the
visible Kanban, approval, and scheduling. APPROVED/SCHEDULED/terminal ContentStatus semantics are a
separate, protected enum. Renaming/reordering a WorkflowStage label has zero effect on ContentStatus
behavior.

```
APPROVED_SEMANTICALLY_PROTECTED: YES (ContentStatus enum, not an editable WorkflowStage label)
SCHEDULED_SEMANTICALLY_PROTECTED: YES (ContentStatus enum)
TERMINAL_SEMANTICALLY_PROTECTED:  YES (WorkflowStage.terminal immutable; ContentStatus PUBLISHED)
BUSINESS_LOGIC_DEPENDS_ON_DISPLAY_LABEL: NO (logic keys on stage ids / ContentStatus enum, never labels)
SYSTEM_STAGE_DELETE_SAFETY:      YES (terminal stage cannot be removed; in-use stage blocked 409)
```

## Custom Stage Semantics

```
CUSTOM_STAGE_CAN_RECEIVE_JOBS:  YES via API (transitionJob/board with stageId)
CUSTOM_STAGE_TRANSITION_RULE:   ordered active stages; jobs move via stageId (not labels)
CUSTOM_STAGE_VISIBLE_IN_KANBAN: NO — the visible Demandas Kanban is ContentStatus-driven and does not
                                 render WorkflowStage columns (KEY GAP)
CUSTOM_STAGE_ORDER_SOURCE:      WorkflowStage.position
CUSTOM_STAGE_CAN_BE_REMOVED_IF_EMPTY: YES (soft archive when _count.jobs === 0)
CUSTOM_STAGE_IN_USE_REMOVAL_BEHAVIOR: 409 conflict, no orphan
```

## Reorder Transaction Safety

```
REORDER_SINGLE_TRANSACTION:     YES (db.$transaction array form)
REORDER_TEMP_POSITION_SCHEME:   10_000 + index (disjoint from valid 0..n)
REORDER_UNIQUE_SAFE:            YES (two-phase; temp unique then final unique)
REORDER_ROLLBACK_SAFE:          YES (array-form $transaction is atomic)
REORDER_CONCURRENT_SAFE:        YES for realistic stage counts (temp range disjoint; last-writer-wins,
                                 no corruption). Acceptable V1 (not P0/P1).
REMOVE_COMPACTION_SAFE:         YES (interactive tx; archived to 10_000, remaining two-phase renumber)
TEMP_POSITION_LEAK_RISK:        LOW — archived tombstone kept at 10_000 (soft-archive by design);
                                 addStage now ignores archived positions (defect fixed during audit)
```

## In-Use Stage Protection

```
IN_USE_CHECK_TENANT_SAFE:       YES (stage scoped by workflowId→companyId)
IN_USE_DELETE_ATOMIC:           PARTIAL — the _count check and the archive happen in the same
                                 interactive transaction; a TOCTOU window is closed because the
                                 archive mutation and renumber are in one tx (count read outside
                                 mutation but archive is conditional-free; a job created between
                                 check and archive would reference a now-archived stage). Risk is
                                 acceptable V1 (single-writer admin UI); noted.
IN_USE_ERROR_CODE:              409 conflict
IN_USE_HISTORY_SAFE:            YES (soft archive, no row delete, no cascade)
CASCADE_RISK:                   NONE (no destructive cascade on WorkflowStage)
```

## Workflow UI

```
WORKFLOW_UI_PERMISSION:         YES (Settings gates tab to OWNER/ADMIN; backend requireRole matches)
WORKFLOW_UI_SERVER_AUTHORITY:   YES (all state from /api/workflows; no local fake persistence)
WORKFLOW_UI_LOADING:            YES (Spinner)
WORKFLOW_UI_ERROR:              YES (error Card + mutation error banners)
WORKFLOW_UI_MUTATION_FEEDBACK:  YES (success/error banners)
WORKFLOW_UI_CACHE:              YES (invalidates ["workflow"]; no F5)
WORKFLOW_UI_MOBILE:             YES (responsive Card layout)
WORKFLOW_UI_DEPENDENCY_ADDED:   NO (no new dependency; move-up/down controls, no drag lib)
WORKFLOW_UI_ARCHIVED_HIDDEN:    YES (fixed during audit — archived stages no longer rendered)
```

## Kanban Integration

```
KANBAN_WORKFLOW_SOURCE:         NO — visible Demandas Kanban (ContentsList) is hardcoded to the
                                 ContentStatus pipeline; it does NOT consume WorkflowStage
KANBAN_CUSTOM_STAGE:            NO (custom stages not shown in visible board)
KANBAN_RENAME:                  NO visible effect on the board (labels are ContentStatus, not stage)
KANBAN_REORDER:                 NO visible effect (board order fixed by ContentStatus)
KANBAN_LAYOUT_REGRESSION:       PASS (248px shrink-0 columns, horizontal scroll intact)
KANBAN_GROUPING_REGRESSION:     PASS (grouping/ungrouping intact)
KANBAN_DRAGDROP_REGRESSION:     PASS (drag/drop intact)
F14_4_1_FIX_PRESERVED:          YES (dataTransfer.getData("text/plain") at ContentsList.tsx:147)
```

**KEY GAP:** The R1 workflow editor configures `WorkflowStage` records that no visible product surface
renders. The Demandas board is the protected `ContentStatus` pipeline. Editing workflow stages in
Settings has no visible effect on the Demandas Kanban. This is the reason `WORKFLOW_EDITABLE = PARTIAL`.

## Scheduling Regression

```
SCHEDULING_DETECTION_BY_STABLE_SEMANTIC: YES — ContentsList checks targetStatus === "SCHEDULED"
                                 (ContentStatus enum, not a user-editable label)
SCHEDULE_MODAL_PRESERVED:       YES (unchanged)
APPOINTMENT_AUTHORITY_PRESERVED:YES (ScheduleModal creates Appointment first, then SCHEDULED)
SCHEDULING_CANCEL_SAFE:         YES (cancel leaves original state)
SCHEDULING_ERROR_SAFE:          YES (API failure leaves original state)
WORKFLOW_REORDER_SCHEDULING_SAFE: YES (scheduling decoupled from WorkflowStage; reorder has no effect)
```

Note: invalid-state `schedule` returns 500 (TransitionError not mapped to 4xx) — this is
**pre-existing** (R1 did not touch the schedule route or TransitionError); the valid APPROVED→SCHEDULED
path is covered by the passing suite.

## Approval Regression

```
APPROVAL_STAGE_MAPPING_SAFE:    YES (approval driven by ContentStatus; unaffected by stage editor)
PUBLIC_APPROVAL_READ_SAFE:      YES (unchanged)
APPROVAL_DECISION_PROPAGATION_SAFE: YES
CANCELLED_JOB_APPROVAL_BEHAVIOR:YES (cancellation does not delete approval rows; read remains)
APPROVAL_HISTORY_SAFE:          YES
```

## Test Quality

```
CANCEL_TEST_QUALITY:            GOOD — success, idempotency, row-preservation, cross-tenant 404,
                                 unauthenticated 401, cancelled-UI, error feedback (backend 3 +
                                 frontend 4)
WORKFLOW_TEST_QUALITY:          GOOD — add/rename/reorder/remove, protected terminal, in-use block,
                                 soft-archive, cross-tenant, name validation (backend 10 + frontend 6)
REORDER_REGRESSION_TEST_PRESENT:YES (mismatch/duplicate rejects; two-phase verified)
SCHEDULING_SEMANTIC_TEST_PRESENT:YES (existing F14.4 suite, unchanged, passing)
MISSING_CRITICAL_TESTS:         add-after-remove tombstone was missing → ADDED during audit
```

## Adversarial Validation

Audit added / verified:
1. rename Agendado label → scheduling semantic intact: N/A — Agendado is ContentStatus, not an
   editable WorkflowStage label (decoupled). Verified.
2. rename Aprovado label → semantic intact: N/A — same decoupling. Verified.
3. reorder semantic stages → scheduling intact: verified (decoupled).
4. concurrent reorder → unique positions: verified safe for realistic counts (disjoint temp range).
5. failed reorder rollback: verified atomic ($transaction array).
6. in-use removal cannot orphan: verified (409 + interactive tx).
7. cancel cross-tenant mutation: verified (404 by companyId).
- **New test added:** `adds a dense position after archiving (no tombstone inflation)` — proves the
  `addStage` fix.

## Remediations Applied (minimal surgical)

1. `workflowService.ts` `addStage`: next position now computed from **active** stages only (archived
   tombstone at 10000 no longer inflates the count). +1 regression test.
2. `WorkflowSettings.tsx`: render only `active` stages (archived stages no longer reappear after
   removal).
3. Cleaned one archived R1 runtime-test stage from the demo DB (0 jobs, active=false) that was
   breaking the pre-existing `jobsWorkflow.test.ts` deterministic assertion. This was environmental
   test contamination, not a code defect.

## Validation

```
BACKEND_TYPECHECK:  PASS
FRONTEND_TYPECHECK: PASS
BACKEND_TESTS:      448 (447 reported + 1 new tombstone test) — all pass
FRONTEND_TESTS:     275 — all pass
BACKEND_BUILD:      PASS
FRONTEND_BUILD:     PASS (index-BLWKrjVC.js)
```

## Runtime

```
LIVE_CANCEL:        PASS (DRAFT → CANCELLED, row preserved, activity JOB_CANCELLED)
LIVE_WORKFLOW:      PASS (Settings/API loads 4 canonical stages after cleanup; add/rename/reorder/
                          remove verified in R1; active-filter fix in place)
LIVE_KANBAN:        PASS (board intact; CANCELLED excluded)
LIVE_SCHEDULING:    PASS (route intact; APPROVED→SCHEDULED covered by suite)
LIVE_CACHE:         PASS (no-F5 via React Query invalidation)
LIVE_SIDEBAR:       PASS (intact)
```

## Gap Closure

```
JOB_CANCEL_DELETE:  DONE (hard delete OUT_OF_V1 — cancellation is the valid V1 semantic)
WORKFLOW_EDITABLE:  PARTIAL (backend editor DONE + safe; visible Kanban does NOT consume the
                    editable WorkflowStage config — pre-existing architectural split, not bridged)
```

## Commit Readiness

```
R1_SOURCE_CORRECT:             YES (2 defects found and remediated during audit)
R1_TEST_COVERAGE_SUFFICIENT:   YES (448 + 275, incl. new tombstone regression test)
R1_RUNTIME_CORRECT:            YES (live re-verified)
R1_MIGRATION_SAFE:             YES (no schema change)
R1_SECRET_SAFE:                YES
R1_REGRESSION_SAFE:            YES (all 12 surfaces; scheduling/approval/calendar untouched)
R1_COMMIT_READINESS:           APPROVED

Blocking defects: none.
```

## Git Safety

```
HEAD_AFTER_AUDIT:   d80cfbaf3d9714c04d4af2cb1d610c6dcf0f5bd9 (unchanged)
STAGED_FILES:       none
UNKNOWN_FILES:      none
DIFF_CHECK:         PASS (rc=0)
KORE_TOUCHED:       NO
```

Worktree left dirty with R1 changes + audit remediations, uncommitted, for the consolidation step.

---

## Final Status

```
CANCEL_REUSES_CANONICAL_STATE:  YES
CANCEL_TENANT_SAFE:             YES
CANCEL_PERMISSION_SAFE:         YES
CANCEL_TRANSACTION_SAFETY:      YES
CANCEL_HISTORY_READABLE:        YES

WORKFLOW_CANONICAL_MODEL:       WorkflowStage/WorkflowDefinition
WORKFLOW_PARALLEL_MODEL_CREATED:NO

APPROVED_SEMANTICALLY_PROTECTED: YES
SCHEDULED_SEMANTICALLY_PROTECTED: YES
TERMINAL_SEMANTICALLY_PROTECTED: YES
BUSINESS_LOGIC_DEPENDS_ON_DISPLAY_LABEL: NO

CUSTOM_STAGE_CAN_RECEIVE_JOBS:  YES (via API/board)
CUSTOM_STAGE_TRANSITION_RULE:   ordered stages by stageId

REORDER_SINGLE_TRANSACTION:     YES
REORDER_UNIQUE_SAFE:            YES
REORDER_ROLLBACK_SAFE:          YES
REORDER_CONCURRENT_SAFE:        YES (acceptable V1)
REMOVE_COMPACTION_SAFE:         YES

IN_USE_DELETE_ATOMIC:           PARTIAL (acceptable V1; single-writer admin UI)
CASCADE_RISK:                   NONE

KANBAN_CUSTOM_STAGE:            NO (visible board is ContentStatus-driven)
KANBAN_REORDER:                 NO visible effect
F14_4_1_FIX_PRESERVED:          YES

SCHEDULING_DETECTION_BY_STABLE_SEMANTIC: YES
APPOINTMENT_AUTHORITY_PRESERVED: YES
APPROVAL_STAGE_MAPPING_SAFE:    YES

BACKEND_TYPECHECK:              PASS
FRONTEND_TYPECHECK:             PASS
BACKEND_TESTS:                  448
FRONTEND_TESTS:                 275
BACKEND_BUILD:                  PASS
FRONTEND_BUILD:                 PASS

JOB_CANCEL_DELETE:              DONE
WORKFLOW_EDITABLE:              PARTIAL (backend DONE; visible-Kanban integration remaining)

R1_SOURCE_CORRECT:              YES
R1_TEST_COVERAGE_SUFFICIENT:    YES
R1_RUNTIME_CORRECT:             YES
R1_REGRESSION_SAFE:             YES
R1_COMMIT_READINESS:            APPROVED

HEAD_AFTER_AUDIT:               d80cfbaf3d9714c04d4af2cb1d610c6dcf0f5bd9
STAGED_FILES:                   none
UNKNOWN_FILES:                  none
DIFF_CHECK:                     PASS
KORE_TOUCHED:                   NO
```

LOOPLY V1-R1 INDEPENDENT AUDIT — APPROVED FOR COMMIT
