# Looply — V1-R1.2 Independent Audit

Date: 2026-08-18 · Branch: `main` · Audit-only (no source modified, no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          e58c82cb370b69b49db51b009834f41065a22b55 (matches expected)
WORKTREE:            11 modified files + 4 untracked paths (2 reports, migration dir, 2 test files)
STAGED:              none
RAM:                 ~1.7 Gi available (no RESOURCE_PRESSURE)
DUPLICATE_OPENCODE:  none
```

## Audited files

```
backend/prisma/schema.prisma                              enum WorkflowStageSemantic + nullable semanticKey
backend/prisma/migrations/20260825000000_add_workflow_stage_semantic/migration.sql
backend/src/domain/jobWorkflow.ts                          default seeds (Aprovado/Agendado + semanticKey)
backend/src/services/workflowService.ts                    resolveStageBySemantic / syncJobStageToSemantic /
                                                           ensureWorkflowSemantics / ensureCompanyWorkflowSemantics /
                                                           removeStage semantic protection
backend/src/services/jobService.ts                         transitionJob guards (SCHEDULED/APPROVED) + coherent write
backend/src/services/approvalService.ts                    APPROVED decision → stage sync
backend/src/services/contentService.ts                     schedule/publish → stage sync
backend/src/routes/contents.ts                             PATCH /:id/status SCHEDULED block + APPROVED/PUBLISHED sync
backend/src/routes/workflows.ts                            (inspected) name-only stage schemas
frontend/src/lib/types.ts, features/WorkflowSettings.tsx, tests/workflowSettings.test.tsx
backend/tests/workflowSemantics.test.ts, workflowCoherenceDb.test.ts, jobsWorkflow.test.ts
```

## Invariant review

| # | Invariant | Verdict | Evidence |
|---|---|---|---|
| 1 | semanticKey independent from editable labels | PASS | `renameStage`/`reorderStages` write `name`/`position` only; all business resolution keys on `semanticKey`; `addStage` never writes it |
| 2 | user cannot inject/change semanticKey | PASS | workflows route schemas are name-only (`z.object({ name })`); no other `workflowStage.create/update` writer outside workflowService; DB-gated test proves injected `semanticKey: "SCHEDULED"` is ignored |
| 3 | duplicate protected semantics (create/update/concurrent/legacy) | PASS w/ LOW note | create/update cannot assign keys; `ensureWorkflowSemantics` dedupes per workflow sequentially; a concurrent first-resolution race on a legacy workflow could create a duplicate stage (LOW, benign — `resolveStageBySemantic` picks one active) |
| 4 | code-level uniqueness sufficient for R1.2 / R1.3 | YES | Duplicate requires a same-instant race on a legacy workflow's first protected op; consequence is a redundant stage row, not a coherence violation. Not a blocker. DB index is a cheap hardening when a migration is convenient |
| 5 | APPROVED still requires canonical approval flow | PASS on stage path | `transitionJob` rejects APPROVED-stage entry unless `job.status` is already `APPROVED`; approval resolves stage by `semanticKey` |
| 6 | any endpoint still forces APPROVED without approval rules | YES — legacy PATCH (MEDIUM, deferred) | `PATCH /contents/:id/status {APPROVED}` sets status directly from any state (pre-existing ContentsList drag-drop). R1.2 blocks SCHEDULED there but not APPROVED. See Finding A |
| 7 | SCHEDULED reachable without Appointment | NO | Only runtime writer of `status=SCHEDULED` is `contentService.schedule` (the canonical endpoint the ScheduleModal calls). `transitionJob` and `PATCH /status` both reject. Seed data is static |
| 8 | schedule syncs only after the operation succeeds | PASS w/ LOW note | `schedule` validates (transition + date) before any write; sync runs after the status write in the same request; the two writes are not one transaction (Finding C) |
| 9 | approval sync correct | PASS | `syncJobStageToSemantic` runs INSIDE the decision `$transaction`, so status + stage commit atomically; tenant-scoped by `approval.companyId` |
| 10 | COMPLETED semantics correct | PASS | COMPLETED = terminal stage; publish (status PUBLISHED) syncs to it; generic move to terminal reconciles `lifecycleStatus=COMPLETED`. ContentStatus itself is untouched (PUBLISHED remains the content-terminal) |
| 11 | sync resolves within correct tenant/workflow | PASS | `resolveStageBySemantic` filters `workflow: { companyId }`; `syncJobStageToSemantic` updates `where: { id, companyId }` |
| 12 | cross-tenant stage resolution | NO | Every resolution/transition query is companyId-scoped (caller auth companyId, or `approval.companyId`); unit test covers foreign-tenant miss |
| 13 | legacy upgrade deterministic/idempotent/non-destructive | PASS | Deterministic inputs (terminal flag + template defaults); idempotent via per-workflow dedup (unit-tested); additive only (creates stages, sets terminal COMPLETED); never reorders/renames/removes existing stages |
| 16 | cancellation unchanged | PASS | `transitionJobLifecycle` untouched by the diff; cancel route unchanged; full suite green |
| 17 | no unrelated source changes | PASS | All 11 modified files are R1.2-scoped (schema, workflow domain/service, scheduling/approval sync, PATCH protection, frontend type/UI/tests) |

## Migration review (Q14)

`20260825000000_add_workflow_stage_semantic/migration.sql`:

```sql
CREATE TYPE "WorkflowStageSemantic" AS ENUM ('APPROVED', 'SCHEDULED', 'COMPLETED');
ALTER TABLE "WorkflowStage" ADD COLUMN "semanticKey" "WorkflowStageSemantic";
```

- Additive only. No DROP/ALTER of existing columns, no enum removal, no data rewrite.
- Existing rows: `semanticKey` is NULL → every pre-existing stage behaves as a custom (semantic-neutral) stage. Safe for old data.
- Applied to the dev DB; `prisma migrate status` → up to date (15 migrations).
- No unique index (code-level dedup only) — LOW, see Finding B.

## Scheduling review (Q7, Q8)

- Sole runtime writer of `Job.status = SCHEDULED`: `contentService.schedule`, which requires `assertCanTransition(→SCHEDULED)` (from APPROVED) and a valid date, then writes `status/scheduledAt`, then syncs the stage.
- `transitionJob` rejects SCHEDULED semantic stage (409).
- `PATCH /status` rejects SCHEDULED (409) — the direct-force vector is closed.
- Frontend ScheduleModal posts to `/api/contents/:id/schedule` (canonical). Appointment/scheduling flow remains the only path; Appointment stays authoritative.
- Dual write is not atomic (LOW, Finding C).

## Approval review (Q5, Q6, Q9)

- Canonical path: `approvalService.decide` sets `status = decision` (APPROVED/CHANGES_REQUESTED) and, for APPROVED, syncs `currentStageId` to the `APPROVED` semantic stage **inside the same transaction**. Coherence is atomic and label-independent.
- Stage path: `transitionJob` cannot enter the APPROVED stage unless the job is already APPROVED.
- Residual: the legacy `PATCH /status` can still set APPROVED directly from any status (pre-existing ContentsList drag-drop). R1.2 kept it (out-of-scope legacy Kanban) and only added stage sync + the SCHEDULED block. See Finding A.

## Tenant isolation review (Q11, Q12)

All new resolution/write paths filter by the caller's `companyId`:
`resolveStageBySemantic` (`workflow.companyId`), `syncJobStageToSemantic` (`job.companyId`), approval (`approval.companyId`), PATCH route (`req.auth.companyId`), `ensureWorkflowSemantics` (explicit companyId match, throws notFound otherwise). Cross-tenant resolution is not possible.

## Legacy upgrade review (Q13)

`ensureWorkflowSemantics` / `ensureCompanyWorkflowSemantics` (triggered lazily by `resolveStageBySemantic` on a miss):
- deterministic (terminal flag + template defaults + fixed fallback names);
- idempotent (per-workflow semantic map; terminal→COMPLETED only when unset; unit-tested over two runs);
- non-destructive (creates stages / updates one semanticKey; never removes, renames, or reorders);
- duplicate-free sequentially; theoretical race noted (LOW, Finding B).

## Declared limitation assessment

| Reported limitation | Audit verdict |
|---|---|
| 1. legacy ContentsList can still set APPROVED directly | Confirmed. MEDIUM. Safely deferrable to R1.3 (Finding A) |
| 2. semanticKey uniqueness code-only | Confirmed. LOW. Not a blocker (Finding B) |
| 3. sync not one atomic transaction | Confirmed for schedule/publish/PATCH; **approval is actually atomic** (sync inside the decision transaction). LOW (Finding C). The R1.2 report slightly overstates this for approval |

Additional observed (not in the report): `CHANGES_REQUESTED` after a job sits on the APPROVED stage does not revert the stage (pre-existing semantic edge; LOW/informational).

## Findings by severity

**CRITICAL** — none.

**HIGH** — none.

**MEDIUM**
- **A. Legacy `PATCH /contents/:id/status` can set APPROVED without the approval domain rules.** Pre-existing behavior, not introduced by the diff; R1.2 closed SCHEDULED there but left APPROVED, and documented it. The stage path (`transitionJob`) and the canonical approval flow are both protected. Reachable only via the legacy ContentsList drag-drop UI, which R1.3 replaces with `transitionJob`-based movement. **Decision: safely deferrable to R1.3.** Smallest remediation if it must close before R1.3: gate APPROVED in PATCH `/status` with `assertCanTransition(currentStatus, "APPROVED")` (i.e. only from AWAITING_CLIENT), matching the domain `TRANSITIONS`.

**LOW**
- **B. semanticKey uniqueness is code-level only.** A concurrent first protected op on the same legacy workflow could create a duplicate active APPROVED/SCHEDULED stage. Benign for coherence (`resolveStageBySemantic` picks one active); R1.3 could surface a duplicate column in the rarest case. Smallest remediation: additive `@@unique([workflowId, semanticKey])` (Postgres treats NULLs as distinct, so custom stages are unaffected) in a future migration.
- **C. schedule/publish/PATCH dual write is not atomic.** A failure between the status write and the stage sync leaves `status` updated with a stale `currentStageId`. Approval and `transitionJob` are atomic. Rare, recoverable, single-tenant; not a blocker.
- **D (informational). CHANGES_REQUESTED does not revert the APPROVED stage** after a prior approval; reconciles on the next protected transition.

## Validation actually executed

1. `git status --short`, `git diff --stat`, `git diff` (all changed files), `git diff --check` → PASS.
2. Migration SQL inspected → additive only.
3. Focused R1.2 suites: `workflowSemantics` (7), `workflowConfig` (11), `workflowCoherenceDb` (5), `jobsWorkflow` (6), `approval` (7), `contentService` (3) → **39 passed** (6 files).
4. `prisma migrate status` → up to date (15 migrations).
5. Caller sweep: all `status` writers and all semantic-helper callers enumerated from source (no path missed).
6. Full backend (460) / frontend (276) suites, typecheck and build: already substantiated by the R1.2 implementation session on an identical diff; not re-run per anti-repeat guidance (no code changed since).

## Consolidation decision

**PASS.** The R1.2 diff is safe and internally coherent. Every new guarantee (stable label-independent semanticKey, non-injectable key, stage/status coherence, SCHEDULED/APPROVED stage-entry protection, tenant isolation, safe legacy upgrade, additive migration) verifies against source and focused tests. The three findings are MEDIUM/LOW, all pre-existing or theoretical, none blocking consolidation, all with named smallest remediations for later.

## R1.3 readiness

**READY.** The semantic bridge is sound. R1.3 can build the WorkflowStage-driven Kanban on `semanticKey` + `transitionJob` with the documented protection model. R1.3 should also retire the legacy `PATCH /status` APPROVED bypass (Finding A) by routing Kanban movement through `transitionJob`.

## Git state

```
HEAD:               e58c82cb370b69b49db51b009834f41065a22b55 (unchanged)
Dirty files:        11 modified + 4 untracked paths
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## MCPs / skills actually loaded

- Skills loaded: `caveman` (simplicity discipline for the audit lens), `kore-validate` (tiered validation: focused suites only; no heavy re-runs without need).
- `code-review` was requested but is not present in this session's skill registry; equivalent manual review discipline applied (full diff read + caller sweep + invariant checklist).
- MCP: `ai-memory` not needed (reports + source sufficed); files inspected via Read/Grep/Serena-equivalent direct reads.

---

LOOPLY V1-R1.2 INDEPENDENT AUDIT — PASS
