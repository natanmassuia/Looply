# Looply — V1-R1.3 Workflow ↔ Kanban Integration

Date: 2026-08-18 · Branch: `main` · Worktree left dirty (no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          6fe80224781e960fdea78e6019d3f258ef667423 (matches expected base)
RAM:                 ~1.8 Gi available (no RESOURCE_PRESSURE)
WORKTREE:            clean at start
KORE_TOUCHED:        NO
```

## Root integration points

- `frontend/src/features/ContentsList.tsx` — the Demandas board. Was hardcoded `ContentStatus` columns + `PATCH /status` drag; now WorkflowStage columns + `transitionJob` drag.
- `backend/src/routes/contents.ts` — legacy `PATCH /:id/status` APPROVED bypass closed.
- `frontend/src/components/ScheduleModal.tsx` — deterministic date construction (SCHEDULED handoff was broken: `en-CA` Intl output is `YYYY-MM-DD`, the regex expected `MM/DD/YYYY`, so submit always errored on modern ICU).
- `frontend/src/lib/types.ts` — `ContentListItem.currentStageId`.
- Tests: `backend/tests/workflowCoherenceDb.test.ts`, `frontend/src/tests/workflowKanban.test.tsx` (new), `frontend/src/tests/jobs.test.tsx` (mocks updated).

## Files changed

```
backend/src/routes/contents.ts            PATCH APPROVED gate (only AWAITING_CLIENT → APPROVED)
backend/tests/workflowCoherenceDb.test.ts new APPROVED-gate test; schedule test now approves via canonical flow
frontend/src/features/ContentsList.tsx    workflow-stage columns; currentStageId placement; transitionJob drag;
                                         touch drag + horizontal auto-scroll; destination feedback
frontend/src/components/ScheduleModal.tsx deterministic wall-clock ISO construction
frontend/src/lib/types.ts                 ContentListItem.currentStageId
frontend/src/tests/jobs.test.tsx          workflow-backed mock data + useWorkflow mocks
frontend/src/tests/workflowKanban.test.tsx  R1.3 focused board tests (10)
```

## Backend behavior

- `PATCH /api/contents/:id/status` can no longer force `APPROVED` unless the job is `AWAITING_CLIENT` (the only legal source per `domain/workflow.ts`). `SCHEDULED` remains blocked (R1.2). The endpoint is now dormant from the UI (the board uses `transitionJob` + the schedule endpoint).
- No other backend behavior changed: `transitionJob` (custom/custom + APPROVED-gate + COMPLETED lifecycle), scheduling/publish/approval stage sync, tenant scoping, and the migration-free schema all remain as validated in R1.2.
- Backend focused tests: 40 passed (workflowSemantics, workflowCoherenceDb, workflowConfig, jobsWorkflow, approval, contentService). Full backend suite: **461 passed**.

## Frontend behavior

- Columns = active `WorkflowStage`s sorted by `position` (id/name/order from the workflow; `semanticKey` only drives protected behavior).
- Card placement = `currentStageId`. No label/status guessing fallback.
- Desktop drag → `POST /api/jobs/:id/transition { stageId }` (canonical). The card is never optimistically moved; a backend rejection shows a transient alert and the card stays in its source column.
- APPROVED stage: a generic drag of a non-approved card is rejected by `transitionJob` (409) and surfaced; approved cards may enter (and the approval flow places them there).
- SCHEDULED stage: drop on the `SCHEDULED` semantic stage opens the ScheduleModal for APPROVED cards (intent to schedule; nothing committed until Appointment success); non-eligible cards get a safe message. Cancel/validation/API failure leaves the card in the source column.
- COMPLETED/terminal stage: unchanged R1.2 contract (lifecycle reconcile on drag; publish syncs here).
- Touch/mobile: hold a card (8px threshold), move → destination column highlights under the finger and the horizontal container auto-scrolls while the finger sits in a 64px edge zone (rAF loop, 12px/step, stops on zone exit/drop/cancel). Page scroll is blocked only while a card is actively dragged (non-passive `touchmove` listener). A drag suppresses the trailing tap-to-navigate click.
- Destination feedback: drop-target column gets the active border/bg while a drag (mouse or touch) hovers, cleared on drop/cancel.
- Grouping, client filter, and search preserved (CardStack markup and filter UI unchanged).

## APPROVED protection

- Canonical approval flow untouched and still authoritative (`approvalService.decide` resolves the APPROVED stage by `semanticKey`).
- Generic stage entry to an APPROVED stage requires `status === APPROVED` (`transitionJob`).
- Legacy `PATCH /:id/status` APPROVED bypass is closed (R1.2 MEDIUM finding resolved).

## SCHEDULED / Appointment behavior

- Appointment remains authoritative: SCHEDULED is only committed by the canonical `/schedule` endpoint after `createAppointment` succeeds (ScheduleModal order preserved).
- `transitionJob` and `PATCH /status` both reject SCHEDULED.
- Fixed the latent ScheduleModal date bug so the modal can actually submit (deterministic wall-clock ISO from native inputs; no Intl/ICU dependence).

## Mobile/touch auto-scroll

Implemented with native touch events (no new dependency): edge-zone horizontal auto-scroll (pure `autoScrollDelta` helper, unit-tested), page-scroll suppression during drag, touch-to-tap click suppression.

## Destination feedback

`dropTarget` state drives a temporary active column style for both mouse and touch; cleared on drop/cancel (tested).

## Grouping / filter regression status

- Grouped demand containment contract tests (source-snapshot) pass unchanged.
- Client filter + search tests pass unchanged.
- Drag moves only the dragged card (no implicit bulk movement); desktop group-on-card interaction preserved.

## Tests

- Backend focused R1.3/domain: 40 passed (incl. new PATCH-APPROVED-gate DB test; schedule test now uses the canonical approval flow).
- Backend full suite: **461 passed** (40 files).
- Frontend focused R1.3 board: **10 passed** (`workflowKanban.test.tsx`).
- Frontend full suite: **286 passed** (20 files; +10 new).
- Frontend tests cover: columns from WorkflowStage, order by position, placement by currentStageId, drag via `/transition` (not `/status`), APPROVED no-optimistic-approve, SCHEDULED opens modal, cancel/failure restore source, auto-scroll delta, destination feedback.

## Typecheck / build

- Backend `tsc --noEmit`: PASS · build: PASS.
- Frontend `tsc --noEmit`: PASS · build: PASS (pre-existing chunk-size warning only).
- `git diff --check`: PASS.

## Remaining limitations

- Legacy `PATCH /:id/status` still exists and can still set non-protected statuses (e.g. `PUBLISHED` from any state) — pre-existing legacy surface, no longer called by the UI; out of R1.3 scope.
- Touch drag highlights the destination column but does not render a card-follows-finger ghost (minimal implementation per task).
- Touch grouping was not added (never existed; desktop grouping preserved).
- A board with zero demands still shows the product EmptyState rather than empty workflow columns (pre-existing behavior, unchanged).
- Non-transactional dual writes and code-level `semanticKey` uniqueness remain as documented R1.2 LOW findings (not expanded by R1.3).

## Schema / migration status

```
SCHEMA_CHANGE: NO
MIGRATION: NO
```

The R1.2 model (nullable `semanticKey` + `currentStageId`) was sufficient; no schema/migration was needed.

## Git state

```
HEAD:               6fe80224781e960fdea78e6019d3f258ef667423 (unchanged)
Dirty files:        6 modified + 1 untracked (all R1.3-scoped)
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman` (minimal-change discipline). `kore-validate` tiering honored (focused tests → typecheck/build → full suites once).
- MCPs: no external MCP required (source inspection via Read/Grep; R1.2/R1.3 context from prior sessions + reports).
- No new dependencies added.
