# Looply — V1-R2.P1 jobsWorkflow Drift

Date: 2026-08-19 · Branch: `main` @ `99b905d` · No commit (per scope — R2.P1 left uncommitted for audit). `KORE_TOUCHED: NO`.

## Goal

Make the backend suite fully green by fixing the recurring pre-existing `jobsWorkflow.test.ts`
failure at line 28. Do not assume the test is wrong; establish the actual root cause first.

## Root cause

The failing assertion compared the returned workflow stages against the default template:

```
expect(wa.body.workflows[0].stages.map((s) => s.name)).toEqual(
  DEFAULT_WORKFLOW_STAGES.MARKETING_AGENCY.map((s) => s.name),
);
```

Investigation of the live dev DB (`natan@looply.dev` company, `MARKETING_AGENCY` template) showed the
workflow contains **persistent contamination**: a soft-archived custom stage named `"Teste"`:

```
pos=5    name="Concluído"  terminal=true  active=true  semantic=COMPLETED
pos=10000 name="Teste"     terminal=false active=false semantic=null
```

`"Teste"` is an **archived (soft-deleted) stage** — `active=false` with the tombstone position
`10_000`, which is exactly the shape produced by `removeStage` in `workflowService.ts` (it sets
`active: false, position: 10_000` to soft-archive a stage without deleting history). It was added as a
custom stage during some prior manual/test activity and then archived; it persists in the shared dev DB.

`listWorkflows` → `ensureDefaultWorkflow` returns the existing workflow with `stages: { orderBy:
{ position: "asc" } }` — **no `active: true` filter** — so the archived `"Teste"` stage leaks into the
`/api/workflows` response and broke the exact-match assertion.

**Classification:** persistent archived-stage contamination in the shared dev DB, combined with the
test asserting the exact default-stage set without excluding archived stages. It is deterministic
(not a nondeterministic seed): the archived stage is stable in the DB. It is not an application bug —
the app intentionally retains archived stages (`removeStage` soft-archives them, and other paths like
the board/semantics consistently filter `active: true`). The `/api/workflows` endpoint returning
archived stages is arguably intended for workflow-config management (admins can see archived stages).

## Fix (minimal test isolation — no data mutation, no app change)

`jobsWorkflow.test.ts` now filters the returned stages to `active` before comparing to the default
template, aligning the assertion with the app's active-stage semantics:

```
expect(wa.body.workflows[0].stages.filter((s) => s.active).map((s) => s.name)).toEqual(
  DEFAULT_WORKFLOW_STAGES.MARKETING_AGENCY.map((s) => s.name),
);
expect(wb.body.workflows[0].stages.filter((s) => s.active).map((s) => s.name)).toEqual(
  DEFAULT_WORKFLOW_STAGES.HIGH_TICKET.map((s) => s.name),
);
```

This was chosen deliberately over alternatives:
- **Not** deleting the archived `"Teste"` stage (data mutation; would be destructive and non-repeatable).
- **Not** changing `listWorkflows`/`getWorkflow`/`ensureDefaultWorkflow` to filter `active` (an
  application contract change that could affect the workflow-config UI and the board; out of scope and
  riskier than the failure warrants — archived stages are intentionally retained for management).
- The active-filter aligns the test with the app's own convention (`active` = current/usable stage).

## Proof

- Previously-failing `jobsWorkflow.test.ts`: **6/6 PASS** (including "default workflows are
  deterministic and idempotent per company").
- Focused workflow tests (`jobsWorkflow`, `workflow`, `workflowSemantics`, `workflowConfig`,
  `jobsAtomic`): **41/41 PASS**.
- Backend typecheck: PASS (exit 0).
- Backend build: PASS (exit 0).
- **Full backend suite: 477 passed / 42 files, ZERO failures** (resource-safe, 1.7Gi available).
- `git diff --check`: PASS (exit 0).

## Files changed

```
Modified: backend/tests/jobsWorkflow.test.ts (4 insertions, 2 deletions)
```

`SCHEMA_CHANGE: NO` · `MIGRATION: NO` · no app source changed · no dependency added.

## Git state

```
HEAD:          99b905df1eb2a063133a9ef68ece7865691e3792 (== origin/main, after R2.3B consolidation)
Changed:       backend/tests/jobsWorkflow.test.ts (uncommitted — R2.P1 left for audit)
Untracked:     this report + prior M1/M2 reports
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: `jobsWorkflow.test.ts`, `workflowService.ts`, `workflows.ts`, `jobService.ts`, `domain/jobWorkflow.ts`.
- Queried the live dev DB (via Prisma, masked, read-only) to inspect the actual workflow stages and
  confirm the archived `"Teste"` contamination.
- Ran: previously-failing test, focused workflow tests, typecheck, build, full suite, `git diff --check`.
- No secrets printed; no tenant PII printed; no data deleted; no destructive Prisma used.

---

**R2_P1_STATUS: COMPLETE** · `PREVIOUS_FAILURE: CLOSED` · `NEXT_STATUS: READY_FOR_R2_P1_INDEPENDENT_AUDIT` ·
`KORE_TOUCHED: NO`

LOOPLY R2.P1 JOBSWORKFLOW DRIFT — COMPLETE (uncommitted, awaiting independent audit)