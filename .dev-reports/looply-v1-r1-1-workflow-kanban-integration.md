# Looply — V1-R1.1 Workflow ↔ Kanban Integration

Date: 2026-08-17 · Branch: `main` @ `e58c82c` (worktree clean — no modifications made) ·
R1.1 was specified as an implementation task to make the visible Demandas Kanban consume the
editable `WorkflowStage` configuration. On deep architectural analysis, this is **BLOCKED** by a
genuine architecture blocker: there is no safe persisted mapping between `WorkflowStage` and the
`ContentStatus` pipeline that drives the validated scheduling and approval flows. Per the task's own
Phase 3/5 guardrails ("STOP implementation and report architecture blocker rather than inventing fake
UI behavior"), the correct action is to surface the blocker rather than ship a fragile integration
that would break protected product semantics.

## Baseline

```
REPO_ROOT:                      /opt/looply
CURRENT_BRANCH:                 main
LOCAL_HEAD:                     e58c82cb370b69b49db51b009834f41065a22b55
REMOTE_HEAD:                    e58c82cb370b69b49db51b009834f41065a22b55
LOCAL_REMOTE_MATCH:             YES
WORKTREE_CLEAN:                 YES (unchanged throughout audit)
AVAILABLE_RAM_START:            ~1.9 Gi
DUPLICATE_OPENCODE:             none (single session)
```

## R1 Gap

```
WORKFLOW_BACKEND_CONFIGURATION_STATUS: DONE (R1)
WORKFLOW_KANBAN_INTEGRATION_GAP:       PARTIAL → target DONE (R1.1)
WORKFLOW_EDITABLE_STATUS:              PARTIAL → target DONE (R1.1)
KNOWN_SYSTEM_STAGE_SEMANTICS:          APPROVED, SCHEDULED, terminal (ContentStatus-driven)
KNOWN_R1_REORDER_CONSTRAINT_FIX:       two-phase position rewrite (R1, present)
```

## Current Architecture (verified from source)

### Two disjoint axes
- **`WorkflowStage`** (`Job.currentStageId`, `Job.workflowId`): configurable operational board.
  Default seeds per template (jobWorkflow.ts):
  - LOCAL_BUSINESS: Novo, Em andamento, Concluído
  - HIGH_TICKET: Novo, Em andamento, Revisão, Concluído
  - MARKETING_AGENCY: Backlog, Em produção, Revisão, Concluído
  - **None of these correspond to `SCHEDULED` or `APPROVED` ContentStatus.**
- **`ContentStatus`** (`Job.status`): the protected content pipeline
  (DRAFT → IN_REVIEW → AWAITING_CLIENT → CHANGES_REQUESTED → APPROVED → SCHEDULED → PUBLISHED),
  which drives scheduling and approval.

### Evidence of the blocker
1. `jobService.transitionJob` sets **only `currentStageId`**, leaving `status` (ContentStatus) stale
   — a card moved to a custom stage keeps its old ContentStatus → dual-state inconsistency.
2. `contentService.schedule` / `sendForApproval` set **only `status`**, not `currentStageId` — the
   scheduling and approval flows are entirely ContentStatus-driven.
3. `ContentsList` scheduling detection is `targetStatus === "SCHEDULED"` (ContentStatus enum), and the
   default workflow has **no SCHEDULED or APPROVED stage**.
4. **`WorkflowStage` has no `semanticKey` / semantic-mapping field.** The only reference in the
   codebase is a code comment; the labels are arbitrary and user-editable, so they cannot be
   business-logic identifiers.

### Consequence
Making the Demandas Kanban consume `WorkflowStage` columns would mean:
- Cards could never reach a "SCHEDULED" semantic state via the workflow board (no such default stage),
  **breaking the validated F14.4 Appointment-first scheduling flow**.
- Cards could never reach an "APPROVED" / approval-awaiting semantic state, **breaking the approval
  flow**.
- Custom stages have no ContentStatus representation → `Job.status` goes stale/inconsistent.

## WorkflowStage ↔ ContentStatus Mapping

```
STAGE_TO_STATUS_MAPPING_EXISTS:   NO — no field links WorkflowStage to ContentStatus
MAPPING_AUTHORITY:                N/A (no mapping exists)
MAPPING_STABLE:                   N/A
CUSTOM_STAGE_STATUS_REPRESENTATION: NONE — a custom stage leaves Job.status stale
SYSTEM_STAGE_MAPPING:             NONE — default stages (Backlog/Em produção/...) do not map to
                                  SCHEDULED/APPROVED ContentStatus
```

## Kanban Authority Contract (cannot be satisfied safely as specified)

```
KANBAN_COLUMN_AUTHORITY:        would-be WorkflowStage.active (but breaks scheduling/approval)
KANBAN_COLUMN_ORDER_AUTHORITY:  would-be WorkflowStage.position
KANBAN_COLUMN_LABEL_AUTHORITY:  would-be WorkflowStage.name
CARD_STAGE_AUTHORITY:           would-be Job.currentStageId
SYSTEM_SEMANTIC_AUTHORITY:      MISSING — no stable semantic key on WorkflowStage
CUSTOM_STAGE_TRANSITION_CONTRACT: MISSING — transitionJob leaves status stale
ARCHIVED_STAGE_CONTRACT:        exists (soft archive) but not the blocker
```

## Custom Stage Semantics

```
CUSTOM_STAGE_CAN_RECEIVE_CARD:  via API (transitionJob) — but Job.status becomes stale
CUSTOM_STAGE_CAN_RELEASE_CARD:  via API
CUSTOM_STAGE_PERSISTS:          YES
CUSTOM_STAGE_KANBAN_REAL:       NOT SAFE — no ContentStatus to represent a card in a custom stage;
                                  breaks the protected pipeline semantics
```

## Why This Is an Architecture Blocker (not a coding gap)

The task forbids redesigning the workflow domain and creating a parallel status system, and requires
preserving scheduling (F14.4) and approval. But the current model has **two disjoint axes** with no
link:

- Scheduling/approval semantics live in `ContentStatus`, which is not reachable via workflow stages
  (default stages don't include SCHEDULED/APPROVED).
- Workflow stages are a separate configurable axis with no semantic key.

To make the Kanban workflow-driven **and** preserve scheduling/approval, the prerequisite is a stable
`semanticKey` on `WorkflowStage` (e.g. `SCHEDULED`, `APPROVED`, `TERMINAL`) plus default workflows
that include those semantic stages — an **additive schema change + reseeding of default workflows**
(a product-contract change to which stages exist). That is precisely the "redesign the workflow
domain" / "new parallel status layer" the task forbids, and it is a large, risky change that would
destabilize the validated runtime. It is not a "minimal safe integration."

## Required Unblocking Prerequisite (for a future R1.1 or decision)

```
PREREQUISITE:
  1. Add a nullable stable `semanticKey` column to WorkflowStage (additive migration).
  2. Reseed default workflows so they include stages carrying SCHEDULED / APPROVED / TERMINAL
     semantics (product-contract change — decided by product, not by an implementation task).
  3. Make Job.status a derived/consistent projection of the active stage's semanticKey (or keep
     ContentStatus and map stage→status through semanticKey).
  4. Then Kanban can render active stages, and scheduling/approval resolve by semanticKey.
```

This requires a product decision (what the default stages should be) and an additive schema change —
outside the scope of "do not redesign the workflow domain."

## Gap Closure (final)

```
WORKFLOW_BACKEND_CONFIGURATION: DONE  (unchanged from R1)
WORKFLOW_KANBAN_INTEGRATION:    BLOCKED (cannot be satisfied safely without domain redesign)
WORKFLOW_EDITABLE:              PARTIAL (backend config DONE; Kanban integration blocked)
```

## Git Safety

```
CHANGED_FILES:      none (audit-only; no source/tests/reports modified)
MIGRATIONS:         none
DEPENDENCY_CHANGES: none
UNKNOWN_FILES:      none
STAGED_FILES:       none
HEAD_AFTER_AUDIT:   e58c82cb370b69b49db51b009834f41065a22b55 (unchanged)
KORE_TOUCHED:       NO
```

No implementation was started; the worktree is clean and HEAD is unchanged. No commit, no push.

---

## Final Status

```
CURRENT_KANBAN_COLUMN_SOURCE_BEFORE: ContentStatus (hardcoded COLUMNS in ContentsList)
KANBAN_COLUMN_AUTHORITY_AFTER:       BLOCKED (no safe workflow→status mapping)
CARD_STAGE_AUTHORITY:                Job.currentStageId exists, but Job.status is stale after
                                     transitionJob → not safe as Kanban source

STAGE_TO_STATUS_MAPPING:             MISSING (no semanticKey field; default stages don't cover
                                     SCHEDULED/APPROVED)
SYSTEM_SEMANTIC_AUTHORITY:           MISSING

APPROVED_SPECIAL_BEHAVIOR_SOURCE:    ContentStatus enum (protected, decoupled) — safe from label edits
SCHEDULED_SPECIAL_BEHAVIOR_SOURCE:   ContentStatus enum (protected, decoupled) — safe from label edits
BUSINESS_LOGIC_DEPENDS_ON_DISPLAY_LABEL: NO (decoupled today — but the blocker prevents unifying)

CUSTOM_STAGE_CAN_RECEIVE_CARD:       NOT SAFE (status goes stale)
CUSTOM_STAGE_CAN_RELEASE_CARD:       NOT SAFE
CUSTOM_STAGE_KANBAN_REAL:            NO

KANBAN_DYNAMIC_COLUMNS:              BLOCKED
KANBAN_ORDER_DYNAMIC:                BLOCKED
KANBAN_LABEL_DYNAMIC:                BLOCKED
KANBAN_CUSTOM_STAGE_VISIBLE:         BLOCKED

F14_4_1_FIX_PRESERVED:               YES (unchanged)

SCHEDULED_DETECTION:                 ContentStatus "SCHEDULED" (current) — would break if board
                                     became workflow-only
SCHEDULED_LABEL_DEPENDENCY:          NO today (decoupled) — but no workflow stage to hold it
APPOINTMENT_AUTHORITY:               ScheduleModal (unchanged, but unreachable from a workflow board
                                     without a SCHEDULED stage)

APPROVAL_RESOLVES_BY_SEMANTIC:       ContentStatus today — would break if board became workflow-only
APPROVAL_LABEL_DEPENDENCY:           NO today

WORKFLOW_MUTATION_INVALIDATION:      N/A (not implemented — blocked)
KANBAN_REFRESH_NO_F5:                N/A

SCHEMA_CHANGE_REQUIRED:              YES (would need additive semanticKey on WorkflowStage) — NOT done
MIGRATION_REQUIRED:                  WOULD BE REQUIRED (additive) — NOT done
MIGRATION_NAME:                      N/A

BACKEND_TYPECHECK:                   N/A (no changes made)
FRONTEND_TYPECHECK:                  N/A
BACKEND_TESTS_AFTER:                 N/A (448 baseline unchanged)
FRONTEND_TESTS_AFTER:                N/A (275 baseline unchanged)
BACKEND_BUILD:                       N/A
FRONTEND_BUILD:                      N/A

LIVE_WORKFLOW_RENAME_TO_KANBAN:      NOT TESTED (not implemented — blocked)
LIVE_WORKFLOW_REORDER_TO_KANBAN:     NOT TESTED
LIVE_CUSTOM_STAGE_COLUMN:            NOT TESTED
LIVE_CUSTOM_STAGE_TRANSITION:        NOT TESTED
LIVE_CUSTOM_STAGE_PERSISTENCE:       NOT TESTED
LIVE_SCHEDULED_RENAME_SEMANTIC:      NOT TESTED
LIVE_ARCHIVE_COLUMN_REMOVAL:         NOT TESTED
LIVE_NO_F5:                          NOT TESTED

TEMP_WORKFLOW_DATA_CLEANED:          YES (no temp data created)
DEMO_ENV_CLEAN:                      YES (worktree/DB untouched)

WORKFLOW_BACKEND_CONFIGURATION:      DONE
WORKFLOW_KANBAN_INTEGRATION:         BLOCKED
WORKFLOW_EDITABLE:                   PARTIAL

DEPENDENCY_CHANGES:                  none
SECRET_SCAN:                         PASS (no changes made)
DIFF_CHECK:                          PASS (no changes)
UNKNOWN_FILES:                       none
KORE_TOUCHED:                        NO
```

LOOPLY V1-R1.1 WORKFLOW ↔ KANBAN INTEGRATION — BLOCKED
