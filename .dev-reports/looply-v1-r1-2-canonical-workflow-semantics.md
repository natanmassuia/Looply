# Looply — V1-R1.2 Canonical Workflow Semantics

Date: 2026-08-18 · Branch: `main` · Worktree left dirty for independent review (no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          e58c82cb370b69b49db51b009834f41065a22b55 (unchanged)
RAM:                 ~2.0 Gi available at start (no RESOURCE_PRESSURE)
DUPLICATE_OPENCODE:  none
PRE-EXISTING DIRTY:  partial R1.2 work from a prior session (preserved and completed)
```

## Confirmed root cause (R1.1 blockers → R1.2 resolution)

Two disjoint axes with no stable link:

| R1.1 blocker | Status after R1.2 |
|---|---|
| `transitionJob` mutates `currentStageId` without status coherence | Generic movement now reconciles status/lifecycle for protected stages and **rejects** entry to SCHEDULED (Appointment authority) and APPROVED (approval authority) stages |
| scheduling/approval mutate `status` without syncing `currentStageId` | Scheduling (`contentService.schedule`), publish, approval (`approvalService.decide`) and the generic `PATCH /contents/:id/status` all sync `currentStageId` via `syncJobStageToSemantic` |
| `ContentsList` detects `ContentStatus.SCHEDULED` | Unchanged (still correct); the workflow now has a real SCHEDULED semantic stage the scheduling flow lands on |
| `WorkflowStage` has no stable semantic identifier | New nullable `semanticKey` enum column (`APPROVED`/`SCHEDULED`/`COMPLETED`) |
| display labels editable → must not drive logic | All business behavior resolves by `semanticKey`, never by `name` |
| default stages lack APPROVED/SCHEDULED mappings | Default seeds now carry APPROVED/SCHEDULED/COMPLETED; legacy workflows are upgraded idempotently at runtime |
| custom stage has no ContentStatus | Custom stages keep `semanticKey = null`; a generic move updates `currentStageId` only, never invents a status |

## Chosen semantic model

- `WorkflowStage.semanticKey?: WorkflowStageSemantic` (`APPROVED | SCHEDULED | COMPLETED`), nullable.
  - `null` = custom, semantic-neutral stage (explicit, never inferred from the label).
  - `APPROVED` = the protected approval landing stage (resolved by the approval flow).
  - `SCHEDULED` = the protected scheduling landing stage (resolved by the scheduling flow).
  - `COMPLETED` = the terminal stage (persisted on the workflow's terminal stage; publish syncs here).
- `semanticKey` is **not** writable through the user workflow API (routes parse `name` only).
- Uniqueness per semantic per workflow is guaranteed in code (`ensureWorkflowSemantics` dedupes per workflow; the API cannot assign keys).
- Contract preserved: `Job.currentStageId` = operational position; `Job.status` = protected semantic. Custom stage → `currentStageId` only. Protected semantic stage → both fields coherent.

### Critical-rule enforcement (no bypass)

- SCHEDULED: generic drags are rejected (`transitionJob`, `PATCH /status`); only the Appointment-based scheduling flow can set it. Appointment stays authoritative.
- APPROVED: `transitionJob` rejects entering the APPROVED stage unless the job's `status` is already `APPROVED` (approval rules preserved). The approval decision resolves the stage by `semanticKey`.
- COMPLETED: a generic move to the terminal stage reconciles `lifecycleStatus = COMPLETED`.

## Schema / migration summary

- `backend/prisma/schema.prisma`: added `enum WorkflowStageSemantic` + `semanticKey WorkflowStageSemantic?` on `WorkflowStage`. No field/enum removed; all existing columns/IDs preserved.
- One additive migration: `backend/prisma/migrations/20260825000000_add_workflow_stage_semantic/` → `CREATE TYPE "WorkflowStageSemantic"` + `ALTER TABLE "WorkflowStage" ADD COLUMN "semanticKey"`. No destructive SQL. Already applied to the dev DB (`migrate status`: up to date).
- Data backfill is **runtime + idempotent** (`ensureWorkflowSemantics`), driven by deterministic domain information (the `terminal` flag and template defaults) — never by arbitrary labels. Terminal → `COMPLETED`; ensures one `APPROVED` and one `SCHEDULED` stage; **never reorders existing user configuration** (pre-session reorder-to-last logic removed).
- No unique index added (additive column + code-level dedup; documented limitation below).

## Changed files

```
backend/prisma/schema.prisma                              enum + semanticKey column
backend/src/domain/jobWorkflow.ts                          default stages carry semanticKey (Aprovado/Agendado added)
backend/src/services/workflowService.ts                    resolveStageBySemantic (with legacy self-heal),
                                                           syncJobStageToSemantic, ensureWorkflowSemantics,
                                                           ensureCompanyWorkflowSemantics, PROTECTED_SEMANTICS,
                                                           removeStage blocks semantic stages
backend/src/services/jobService.ts                         transitionJob: SCHEDULED/APPROVED guards, coherent write
backend/src/services/approvalService.ts                    APPROVED decision syncs stage via syncJobStageToSemantic
backend/src/services/contentService.ts                     schedule/publish sync currentStageId to semantic stage
backend/src/routes/contents.ts                             PATCH /:id/status rejects SCHEDULED; syncs APPROVED/PUBLISHED
frontend/src/lib/types.ts                                  WorkflowStage.semanticKey
frontend/src/features/WorkflowSettings.tsx                 "Sistema" badge; protected stages cannot be removed
backend/tests/workflowSemantics.test.ts                    new unit proofs
backend/tests/workflowCoherenceDb.test.ts                  new DB-gated proofs
backend/tests/jobsWorkflow.test.ts                         transition test picks a custom stage
frontend/src/tests/workflowSettings.test.tsx               "Sistema" badge / removal-protection test
```

## Tests actually executed

Focused first, then the required broader gates:

1. `vitest run tests/workflowSemantics.test.ts tests/workflowConfig.test.ts` → 18 passed.
2. `vitest run tests/workflowCoherenceDb.test.ts tests/jobsWorkflow.test.ts tests/approval.test.ts tests/contentService.test.ts` → 21 passed.
3. Full backend suite → **40 files, 460 tests passed** (448 baseline + 12 new R1.2 tests).
4. Full frontend suite → **19 files, 276 tests passed** (275 baseline + 1).

## Validation results

| Gate | Result |
|---|---|
| backend `tsc --noEmit` | PASS |
| backend build | PASS |
| frontend `tsc --noEmit` | PASS |
| frontend build | PASS (pre-existing chunk-size warning only) |
| frontend test suite | PASS |
| `prisma validate` | PASS |
| `prisma migrate status` | PASS (up to date, 15 migrations) |
| `git diff --check` | PASS |
| Migration SQL inspected | additive only (enum + nullable column) |

No `prisma migrate reset`, no `prisma db push`, no `git reset/clean/stash`. No commit, no push.

## Required focused proofs

1. custom stage defaults to no protected semantic — `ensureDefaultWorkflow`/`addStage` write `semanticKey: null`; unit-proven.
2. user workflow API cannot assign/change `semanticKey` — routes parse `name` only; DB-gated test proves an injected `semanticKey: "SCHEDULED"` is ignored.
3. protected semantic not duplicated within a workflow — `ensureWorkflowSemantics` dedupes per workflow; idempotency unit-proven.
4. renaming a protected stage keeps its semantic — `renameStage` writes `name` only.
5. reordering a protected stage keeps its semantic — `reorderStages` writes `position` only.
6. generic movement cannot bypass SCHEDULED/Appointment — `transitionJob` rejects; `PATCH /status` rejects; unit + DB-gated proven.
7. successful scheduling leaves status/currentStageId coherent — DB-gated proven (job lands on a `SCHEDULED` semantic stage).
8. scheduling failure leaves both coherent — validation fails before any write (transition guard / invalid date), nothing mutated.
9. successful approval leaves status/currentStageId coherent — DB-gated proven via the real public approval flow.
10. approval behavior does not depend on display label — resolution by `semanticKey` only.
11. cross-tenant access denied — all resolution/transition queries are `companyId`-scoped; tenant-scope unit-proven.
12. cancellation behavior unchanged — `transitionJobLifecycle` untouched; full suite green.

## Data compatibility

- Existing jobs/history/files/approvals/appointments: untouched — the migration is additive; all existing `WorkflowStage` rows keep their IDs; jobs keep `currentStageId`/`status`.
- Existing workflows: legacy workflows are upgraded lazily and idempotently the first time a protected operation (schedule/approve/publish) resolves a semantic stage. New companies get the canonical seeded stages directly.
- `lifecycleStatus`/`status` semantics preserved; no data rewritten.

## Remaining limitations

- The legacy `ContentsList` drag-drop (`PATCH /status`) can still set `APPROVED` directly from a non-`AWAITING_CLIENT` state — pre-existing behavior, deliberately left intact (the client-facing approval flow is untouched); R1.3's workflow-stage Kanban routes through `transitionJob`, which enforces the approval gate. `PATCH /status` now keeps stage/status coherent and can no longer force `SCHEDULED`.
- `semanticKey` uniqueness is code-guaranteed, not DB-enforced. A theoretical race (two simultaneous first protected ops on the same legacy workflow) could create a benign duplicate semantic stage; `resolveStageBySemantic` still picks a single active one. Add `@@unique([workflowId, semanticKey])` if/when a second migration is convenient.
- `ensureCompanyWorkflowSemantics` is triggered lazily by protected operations; the workflow settings page may display a legacy (pre-upgrade) workflow until the first protected operation runs or R1.3 reads the board.
- A `CHANGES_REQUESTED` decision after a job sits on the APPROVED stage does not move the stage back (approval history preserved); status/stage reconcile on the next protected transition.
- Scheduling/approval stage sync is a separate write after the status update (not a single transaction); a mid-flow DB failure could leave a partial write. Existing schedule/publish flows already followed this pattern.

## R1.3 readiness

**READY.** The WorkflowStage ↔ ContentStatus bridge now exists: stable `semanticKey`, protected-stage defaults + legacy upgrade, coherent status/currentStageId across scheduling/approval/publish, and blocked generic bypasses. R1.3 can implement the WorkflowStage-driven Kanban (columns = active stages, drag = `transitionJob`) safely.

Note: `WORKFLOW_EDITABLE` is intentionally NOT marked DONE by this task (R1.3 owns the actual Kanban integration).

## MCPs / skills actually loaded

- Skills loaded via `skill`: `caveman`, `kore-validate` (kore-validate tiering honored: Tier 1 focused tests → Tier 2 typecheck/build → full suite only after the affected surface proved).
- MCP used: `ai-memory` (`memory_query` — prior-session design context). Serena symbol tools were inspected directly (files read via Read); `context7`/`webfetch` not needed.
- `implement` and `code-review` skills were requested but are not present in this session's skill registry; equivalent discipline applied manually (reviewed every changed hunk + final diff review pass).

## Final Git state

```
HEAD:               e58c82cb370b69b49db51b009834f41065a22b55 (unchanged)
Dirty files:        11 modified + 3 untracked paths (report, migration dir, 2 test files)
Staged:             none
Committed/Pushed:   none — worktree left dirty for independent review
git diff --check:   PASS
KORE_TOUCHED:       NO
```
