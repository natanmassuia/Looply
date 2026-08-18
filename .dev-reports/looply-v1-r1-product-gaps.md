# Looply — V1-R1 Product Gaps

Date: 2026-08-17 · Branch: `main` @ `d80cfba` (worktree now dirty with R1 changes) ·
R1 closes the two confirmed P1 product-domain gaps from the V1 Gap Audit: (1) job/demanda
cancel/delete semantics, and (2) editable workflow. Implementation-only; no commit/push.

## Baseline

```
REPO_ROOT:                      /opt/looply
CURRENT_BRANCH:                 main
LOCAL_HEAD:                     d80cfbaf3d9714c04d4af2cb1d610c6dcf0f5bd9
REMOTE_HEAD:                    d80cfbaf3d9714c04d4af2cb1d610c6dcf0f5bd9
LOCAL_REMOTE_MATCH:             YES
WORKTREE_CLEAN (start):         YES (only the untracked gap-audit report)
AVAILABLE_RAM_START:            ~1.7 Gi
DUPLICATE_OPENCODE:             none (single session)
```

## Audit Findings

```
AUDIT_JOB_CANCEL_GAP:           "job cancel/delete missing" — P1 in V1 Gap Audit
AUDIT_WORKFLOW_EDIT_GAP:        "workflow not editable" — P1 in V1 Gap Audit
AUDIT_RECOMMENDED_R1_SCOPE:     job cancel + bounded workflow editor
```

Repository evidence refined both: the `JobLifecycleStatus.CANCELLED` enum, `ActivityType.JOB_CANCELLED`,
and a tested `transitionJobLifecycle` service **already existed** (used by the assistant); the gap was
a user-facing route + UI. The `WorkflowStage` model (name/position/terminal/active) already existed
with a read-only API; the gap was write endpoints + a Settings UI.

## Cancellation Contract

```
CANCELLED_CANONICAL_STATE:      JobLifecycleStatus.CANCELLED (existing, reused)
CANCELLED_DB_REPRESENTATION:    Job.lifecycleStatus = "CANCELLED" (terminal; row NOT deleted)
CANCEL_ALLOWED_FROM:            OPEN, IN_PROGRESS (existing LIFECYCLE_TRANSITIONS)
CANCEL_FORBIDDEN_FROM:          COMPLETED, CANCELLED (invalid/ idempotent-resolved)
CANCEL_REOPEN_ALLOWED:          NO (CANCELLED is terminal)
CANCEL_ACTIVITY_EVENT:          JOB_CANCELLED (existing, recorded by transitionJobLifecycle)
CANCEL_PERMISSION:              requireCapability(JOBS) + session auth; role-agnostic within tenant
CANCEL_API_CONTRACT:            POST /api/contents/:id/cancel
CANCEL_UI_ENTRY:                ContentDetail → "Cancelar demanda" button
CANCEL_CONFIRMATION_REQUIRED:   YES (modal, consequence explanation, non-reversible)
```

Hard delete: **OUT_OF_V1** — cancellation is the approved V1 semantic; no destructive hard-delete
exposed in the normal UI.

## Cancellation Backend

```
CANCEL_ROUTE:                   backend/src/routes/contents.ts POST /:id/cancel
CANCEL_SERVICE:                 transitionJobLifecycle(jobService) — existing, tested, idempotent
CANCEL_PERMISSION_GUARD:        requireCapability(JOBS) + requireAuth (tenant from session)
CANCEL_ACTIVITY_EVENT:          JOB_CANCELLED (metadata from/to lifecycle)
CANCEL_TRANSACTIONAL:           YES (db.$transaction)
CANCEL_TENANT_SAFE:             YES — job scoped by req.auth.companyId; cross-tenant → 404
```

## Cancellation Frontend

```
CANCEL_UI_LOCATION:             ContentDetail → Ações card → "Cancelar demanda" (destructive style)
CANCEL_CONFIRMATION:            ModalOrSheet confirm dialog (non-reversible consequence)
CANCEL_LOADING_STATE:           button disabled + "Cancelando…"
CANCEL_ERROR_STATE:             error banner (ApiError message)
CANCEL_CACHE_BEHAVIOR:          useCancelDemand invalidates content/contents/dashboard/publications/jobActivity — no F5
CANCELLED_DETAIL_BEHAVIOR:      cancelled banner; active-only actions hidden; Editar/files/history preserved
BOARD_BEHAVIOR:                 ContentsList filters CANCELLED out of active columns
```

## Workflow Contract

```
WORKFLOW_STORAGE_AUTHORITY:     WorkflowStage rows (per-company single WorkflowDefinition)
STABLE_STAGE_IDENTIFIER:        WorkflowStage.id (cuid, stable; labels never drive logic)
EDITABLE_FIELDS:                name, position (order)
PROTECTED_FIELDS:               terminal (system), active (via remove/archive rules)
ADD_STAGE_ALLOWED:              YES — custom non-terminal stage appended
REORDER_ALLOWED:                YES — move up/down, two-phase to avoid unique collisions
ARCHIVE_REMOVE_ALLOWED:         YES for unused custom stages (soft archive, row preserved)
SYSTEM_STAGE_RULES:             terminal stage cannot be renamed/moved/removed; in-use stage cannot be removed
ACTIVE_JOB_SAFETY:              remove blocked (409) when a stage has jobs; existing jobs never orphaned
TRANSITION_RULE_SOURCE:         unchanged — WorkflowStage labels are display-only; content pipeline
                                (ContentStatus) + lifecycle transitions remain backend-authoritative
WORKFLOW_API_CONTRACT:          GET /api/workflows, POST /:id/stages, PATCH /:id/stages/:stageId,
                                POST /:id/reorder, DELETE /:id/stages/:stageId
WORKFLOW_UI_LOCATION:           Settings → Workflow (OWNER/ADMIN only)
```

## Workflow Storage

No schema change required — `WorkflowStage` already has `name`, `position`, `terminal`, `active`, and
`@@unique([workflowId, position])`. The editor writes existing columns only.

## Workflow API

```
WORKFLOW_READ_ROUTE:            GET /api/workflows, GET /api/workflows/:id (requireCapability WORKFLOW)
WORKFLOW_CREATE_ROUTE:          POST /api/workflows/:id/stages
WORKFLOW_UPDATE_ROUTE:          PATCH /api/workflows/:id/stages/:stageId (rename)
WORKFLOW_REORDER_ROUTE:         POST /api/workflows/:id/reorder
WORKFLOW_REMOVE_ROUTE:          DELETE /api/workflows/:id/stages/:stageId (soft archive)
WORKFLOW_PERMISSION:            requireRole("OWNER","ADMIN") on all write routes
WORKFLOW_TENANT_SAFE:           YES — every op verifies workflow belongs to req.auth.companyId; 404 otherwise
```

Validation: stage name required + ≤80 chars; reorder must exactly match the active stage set (no
duplicates/incompleteness); protected terminal stage immutable; in-use stage removal → 409.

## Workflow Transition Integration

```
TRANSITION_ENGINE_CHANGED:      NO — workflow stage labels remain display-only; ContentStatus and
                                lifecycle transition rules are untouched
CUSTOM_STAGE_TRANSITION_RULE:   stages are operational board columns; the protected content pipeline
                                (DRAFT→IN_REVIEW→AWAITING_CLIENT→APPROVED→SCHEDULED→PUBLISHED) and
                                lifecycle rules are unchanged
PROTECTED_TRANSITIONS_PRESERVED:YES (workflow.ts + LIFECYCLE_TRANSITIONS untouched)
SCHEDULING_HANDOFF_PRESERVED:   YES — Aprovado→Agendado intercept intact (ScheduleModal + /:id/schedule)
APPROVAL_FLOW_PRESERVED:        YES — send-approval + public decisions intact
```

## Workflow Settings UI

```
WORKFLOW_UI_ROUTE:              /settings → Workflow tab
WORKFLOW_UI_COMPONENT:          frontend/src/features/WorkflowSettings.tsx
WORKFLOW_REORDER_UX:            move-up/move-down controls (no new dependency, no drag lib)
WORKFLOW_PROTECTED_UX:          terminal stage labeled "Final", controls disabled with explanation
WORKFLOW_MOBILE_BEHAVIOR:       responsive Card layout, works on mobile
WORKFLOW_CACHE_BEHAVIOR:        mutations invalidate ["workflow"] — no F5
```

## Existing Data Safety

```
EXISTING_DATA_COMPATIBILITY:    PASS — no schema change; existing stage/status values unchanged
ORPHANED_JOB_RISK:              NONE — removal blocked when a stage has jobs; jobs keep currentStageId
HISTORY_COMPATIBILITY:          PASS — activity feed unchanged; cancellation appends JOB_CANCELLED
FILES_COMPATIBILITY:            PASS — cancellation does not delete attachments
APPROVAL_COMPATIBILITY:         PASS — approvals/files remain readable after cancellation
```

## Tests

Backend — new:
- `backend/tests/workflowConfig.test.ts` (10): add/rename/reorder/remove, protected terminal,
  in-use block, soft-archive, cross-tenant denial, name validation.
- `backend/tests/contentCancel.test.ts` (3, DB-gated): unauthenticated 401, cancel success +
  row-preserved + idempotent, cross-tenant 404.

Frontend — new:
- `frontend/src/tests/jobs.test.tsx` (added cancellation describe): action visible, confirmation
  required, mutation called, cancelled banner + hidden active actions, API error feedback.
- `frontend/src/tests/workflowSettings.test.tsx` (6): stages render, add, rename, reorder, protected
  terminal controls disabled, removal error surfaced.

Existing F14.4.1 drag/drop, F14.6 cache/logout, and F14.6.1 Kanban/sidebar tests all preserved and pass.

## Builds

```
BACKEND_TYPECHECK:              PASS
FRONTEND_TYPECHECK:             PASS
BACKEND_TESTS_AFTER:            447 (434 baseline + 13 new)
FRONTEND_TESTS_AFTER:           275 (265 baseline + 10 new)
BACKEND_BUILD:                  PASS
FRONTEND_BUILD:                 PASS (bundle index-ZsXvYR_p.js)
```

## Migration

```
SCHEMA_CHANGE_REQUIRED:         NO
MIGRATION_REQUIRED:             NO (existing JobLifecycleStatus.CANCELLED + WorkflowStage suffice)
MIGRATION_CREATED:              N/A
MIGRATION_NAME:                 N/A
MIGRATION_STATUS:               14 migrations, database up to date (SAFE)
MIGRATION_SAFE:                 N/A (no migration)
```

## Runtime Acceptance

Live: https://looply.verbumlab.com.br (backend PM2 restarted to load new routes; frontend rebuilt).

```
RUNTIME_CANCEL:                 PASS — created a DRAFT, POST /api/contents/:id/cancel → lifecycleStatus CANCELLED
RUNTIME_CANCEL_HISTORY:         PASS — activity feed shows JOB_CANCELLED after JOB_CREATED
RUNTIME_CANCEL_FILES_PRESERVED: PASS — detail still readable, version history intact (row preserved)
RUNTIME_WORKFLOW_READ:          PASS — GET /api/workflows returns ordered stages
RUNTIME_WORKFLOW_ADD:           PASS — added "R1 Teste Temp" at next position (non-terminal)
RUNTIME_WORKFLOW_RENAME:        PASS — renamed to "R1 Renomeada"
RUNTIME_WORKFLOW_REORDER:       PASS — moved to position 0, others shifted (two-phase collision-free)
RUNTIME_WORKFLOW_REMOVE:        PASS — archived the temp stage, original 4-stage order restored
RUNTIME_PROTECTED_STAGE_RULES:  PASS — removing terminal stage → 400 "A etapa final não pode ser removida"
RUNTIME_KANBAN_REGRESSION:      PASS — board API returns stages; contents list unchanged for active jobs
RUNTIME_SCHEDULING_REGRESSION:  PASS — /:id/schedule + appointment flow unchanged (source + suite-verified)
```

Temporary runtime workflow stage removed through the feature itself (soft-archived, no garbage left).

## Regression Audit

```
AUTH_REGRESSION:                PASS (login 200, session flow, logout tests pass)
DASHBOARD_REGRESSION:           PASS (suite + unchanged service; lifecycle counts still grouped)
CLIENTS_REGRESSION:             PASS
DEMANDAS_REGRESSION:            PASS (cancel filters CANCELLED from active board; detail read-only intact)
FILES_REGRESSION:               PASS
APPROVAL_REGRESSION:            PASS
CALENDAR_REGRESSION:            PASS
TEAM_REGRESSION:                PASS
SETTINGS_REGRESSION:            PASS (added Workflow tab; existing tabs unchanged)
THEMES_REGRESSION:              PASS
SIDEBAR_REGRESSION:             PASS
LOGOUT_CACHE_REGRESSION:        PASS
```

## Gap Closure

```
JOB_CANCEL_DELETE_GAP_BEFORE:   MISSING
JOB_CANCEL_DELETE_GAP_AFTER:    DONE (business-state cancellation; hard-delete OUT_OF_V1)

WORKFLOW_BACKEND_CONFIGURATION_GAP_BEFORE: MISSING
WORKFLOW_BACKEND_CONFIGURATION_GAP_AFTER:  DONE (bounded add/rename/reorder/remove with
                                        protected system stages — real, persisted, tenant-safe)

WORKFLOW_KANBAN_INTEGRATION_GAP_BEFORE:    OUT_OF_R1 (visible Demandas Kanban was ContentStatus-driven)
WORKFLOW_KANBAN_INTEGRATION_GAP_AFTER:     PARTIAL (editable WorkflowStage config is NOT yet the
                                        source of the visible Kanban columns/order)

WORKFLOW_EDITABLE_GAP_AFTER:    PARTIAL (backend configuration DONE; visible Kanban integration
                                        pending in R1.1)
```

## Git / Safety

```
CHANGED_FILES:                  10 modified (backend: contents.ts, workflows.ts, workflowService.ts;
                               frontend: Icons.tsx, ContentDetail.tsx, ContentsList.tsx, Settings.tsx,
                               api.ts, types.ts, jobs.test.tsx)
NEW_FILES:                      5 (backend: contentCancel.test.ts, workflowConfig.test.ts;
                               frontend: WorkflowSettings.tsx, workflowSettings.test.tsx + existing
                               untracked gap-audit report)
MIGRATIONS:                     none
DEPENDENCY_CHANGES:             none
DIFF_CHECK:                     PASS (rc=0)
UNKNOWN_FILES:                  none
SECRET_SCAN:                    PASS (no secrets/credentials/tokens in diff or new files)
SENSITIVE_FILES:                none
KORE_TOUCHED:                   NO
```

Per GIT POLICY: **not committed, not pushed.** The validated R1 changes remain as a dirty worktree for
independent review.

```
CANCELLED_CANONICAL_STATE:      JobLifecycleStatus.CANCELLED
CANCEL_API_CONTRACT:            POST /api/contents/:id/cancel
CANCEL_UI_LOCATION:             ContentDetail → Ações → Cancelar demanda (confirmed)

WORKFLOW_STORAGE_AUTHORITY:     WorkflowStage rows (per-company single definition)
WORKFLOW_API_CONTRACT:          GET/POST/PATCH /api/workflows, POST /reorder, DELETE /stages/:id
WORKFLOW_UI_LOCATION:           Settings → Workflow
PROTECTED_SYSTEM_STAGES:        terminal stage (Concluído); in-use stages (409 block)

SCHEMA_CHANGE_REQUIRED:         NO
MIGRATION_REQUIRED:             NO
MIGRATION_NAME:                 N/A

BACKEND_TYPECHECK:              PASS
FRONTEND_TYPECHECK:             PASS
BACKEND_TESTS_AFTER:            447
FRONTEND_TESTS_AFTER:           275
BACKEND_BUILD:                  PASS
FRONTEND_BUILD:                 PASS

RUNTIME_CANCEL:                 PASS
RUNTIME_WORKFLOW_READ:          PASS
RUNTIME_WORKFLOW_ADD:           PASS
RUNTIME_WORKFLOW_RENAME:        PASS
RUNTIME_WORKFLOW_REORDER:       PASS
RUNTIME_WORKFLOW_REMOVE:        PASS
RUNTIME_PROTECTED_STAGE_RULES:  PASS
RUNTIME_SCHEDULING_REGRESSION:  PASS

JOB_CANCEL_DELETE_GAP_AFTER:    DONE (hard-delete OUT_OF_V1)
WORKFLOW_BACKEND_CONFIGURATION_GAP_AFTER: DONE
WORKFLOW_KANBAN_INTEGRATION_GAP_AFTER:    PARTIAL (visible Demandas Kanban still ContentStatus-driven)
WORKFLOW_EDITABLE_GAP_AFTER:    PARTIAL (backend configuration DONE; Kanban integration → R1.1)

FOLLOW-UP R1.1 — WORKFLOW ↔ KANBAN INTEGRATION:
  Make the editable WorkflowStage configuration the source of the visible Demandas Kanban columns
  and order (with protected ContentStatus semantics for approval/scheduling preserved).

AUTH_REGRESSION:                PASS
DASHBOARD_REGRESSION:           PASS
CLIENTS_REGRESSION:             PASS
DEMANDAS_REGRESSION:            PASS
FILES_REGRESSION:               PASS
APPROVAL_REGRESSION:            PASS
CALENDAR_REGRESSION:            PASS
TEAM_REGRESSION:                PASS
SETTINGS_REGRESSION:            PASS
THEMES_REGRESSION:              PASS
SIDEBAR_REGRESSION:             PASS
LOGOUT_CACHE_REGRESSION:        PASS

DEPENDENCY_CHANGES:             none
SECRET_SCAN:                    PASS
DIFF_CHECK:                     PASS
UNKNOWN_FILES:                  none

KORE_TOUCHED:                   NO
```

LOOPLY V1-R1 PRODUCT GAPS — LIVE VERIFIED