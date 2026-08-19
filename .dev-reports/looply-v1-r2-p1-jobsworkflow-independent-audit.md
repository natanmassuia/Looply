# Looply — V1-R2.P1 jobsWorkflow Drift Independent Audit

Date: 2026-08-19 · Branch: `main` @ `99b905d` · Audit only — no source modified, no commit, no push, no stage. `KORE_TOUCHED: NO`.

Purpose: independently audit the uncommitted R2.P1 jobsWorkflow drift fix and confirm it is safe to
consolidate. Ignore unrelated untracked M1/M2 Contabo reports.

## Baseline

- HEAD `99b905df1eb2a063133a9ef68ece7865691e3792` (unchanged, == origin/main).
- R2.P1 change: `backend/tests/jobsWorkflow.test.ts` only (4 insertions, 2 deletions).
- `git diff --check`: PASS (exit 0).

## Invariant 1 — Archived stage confirmed: YES

Live-dev-DB query for the `natan@looply.dev` company (MARKETING_AGENCY) shows:

```
pos=0    "Backlog"      active=true
pos=1    "Em produção"  active=true
pos=2    "Revisão"      active=true
pos=3    "Aprovado"     active=true  semantic=APPROVED
pos=4    "Agendado"     active=true  semantic=SCHEDULED
pos=5    "Concluído"    active=true  terminal=true  semantic=COMPLETED
pos=10000 "Teste"       active=false terminal=false semantic=null
```

`"Teste"` is `active=false` with tombstone position `10_000` — the exact shape `removeStage` produces
(`workflowService.ts` sets `active: false, position: 10_000` to soft-archive). Active count = 6
(= default MARKETING_AGENCY stages), inactive count = 1.

## Invariant 2 — Runtime/product semantics exclude inactive rows: CONFIRMED

The entire operational workflow model operates on `active: true` stages only:
- `addStage` uses active positions for the next slot (workflowService.ts:224)
- `renameStage` updates only `active: true` (line 248)
- `reorderStages` validates/operates only on active stages (lines 266-288)
- `removeStage` soft-archives (`active:false`) and renumbers only active (lines 321, 324)
- `resolveStageBySemantic` / `ensureWorkflowSemantics` / `syncJobStageToSemantic` filter `active: true`
- Frontend board (`ContentsList.tsx:58`): `stages.filter((s) => s.active)` — "Columns come from the active"

Archived (`active:false`) stages are excluded from all active operational behavior; they exist only as
retained history.

## Invariant 3 — Test contract is the ACTIVE template: CONFIRMED

The test "default workflows are deterministic and idempotent per company" asserts that a company's
default workflow matches its template's active stages. The default template defines the *active* stage
set, so comparing active stages is the correct contract.

## Invariant 4 — API behavior correct; test fix does NOT mask a bug: YES

`/api/workflows` (and the board) intentionally expose the full stage list including archived rows:
- `removeStage` explicitly soft-archives and retains rows ("history stays intact", workflowService.ts:316)
- `listWorkflows` / `getWorkflow` return stages with the `active` flag so the client can distinguish
- The frontend board filters `active` at the client (`ContentsList.tsx:58`)

The API contract is: return all stages with an `active` flag; consumers filter active for operational
views. The test filtering `active` matches this contract exactly. This is **not** masking a defect —
the API is behaving as designed (archived stages retained for config/history, distinguished by `active`).

## Invariant 5 — No valid assertion weakened: NO weakening

The change only inserts `.filter((s) => s.active)` before `.map((s) => s.name)` on the two stage-name
assertions. It still asserts: exact set equality of active stage names, exact order (`toEqual` is
order-sensitive), for BOTH companies (MARKETING_AGENCY and HIGH_TICKET). The `companyId` assertions
(lines 26-27) and the idempotency assertion (line 34-36) are unchanged. No assertion weakened beyond
excluding intentionally-retained inactive rows.

## Invariant 6 — Regression strength: STRONG

With `.filter((s) => s.active).map((s) => s.name)` compared via `toEqual`:
- missing active stage → active set shorter than default → FAILS
- wrong active stage name → name mismatch → FAILS
- wrong active order → `toEqual` is order-sensitive → FAILS
- extra unexpected ACTIVE stage → active set longer than default → FAILS

The only tolerated "extra" is an INACTIVE (archived) row, which is correct: archived stages are
intentionally excluded from the active workflow contract.

## Invariant 7 — No data deletion / seed / schema / migration / app change: CONFIRMED

- Diff is confined to `backend/tests/jobsWorkflow.test.ts`.
- No application source, no schema, no migration, no seed data changed.
- No data deleted (DB was only read; the archived `"Teste"` stage remains intact).
- No destructive Prisma used.

## Invariant 8 — Validation: PASS (evidence reused, diff unchanged)

- Focused workflow test (`jobsWorkflow.test.ts`): **6/6 PASS** (re-run this audit).
- Focused workflow suite (jobsWorkflow, workflow, workflowSemantics, workflowConfig, jobsAtomic):
  **41/41 PASS** (from R2.P1, diff unchanged).
- **Full backend suite: 477/477 PASS, zero failures** (from R2.P1, diff unchanged).
- Backend typecheck: PASS · Backend build: PASS (from R2.P1, diff unchanged).
- `git diff --check`: PASS (re-verified this audit).

## Findings

- **CRITICAL: 0** · **HIGH: 0** · **MEDIUM: 0**
- No defects. The test-only fix is semantically valid and does not mask a real API bug.

## Result

```
RESULT: PASS
ROOT_CAUSE_CONFIRMED: YES
ARCHIVED_STAGE_CONFIRMED: YES
ACTIVE_WORKFLOW_CONTRACT: CONFIRMED
API_BEHAVIOR_CORRECT: YES
TEST_FIX_SEMANTICALLY_VALID: YES
TEST_ASSERTION_WEAKENED: NO
ACTIVE_STAGE_REGRESSION_STRENGTH: STRONG

APPLICATION_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
DATA_DELETED: NO

FOCUSED_WORKFLOW_TESTS: PASS
BACKEND_TESTS: 477/477_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

R2_P1_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
KORE_TOUCHED: NO
```

## Git state

```
HEAD:          99b905df1eb2a063133a9ef68ece7865691e3792 (unchanged)
Changed:       backend/tests/jobsWorkflow.test.ts (uncommitted)
Untracked:     this report + R2.P1 report + prior M1/M2 reports (ignored)
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: R2.P1 report, `jobsWorkflow.test.ts` diff, `workflowService.ts`, `jobService.ts`,
  `workflows.ts`, frontend `ContentsList.tsx` / test fixtures.
- Queried the live dev DB (Prisma, masked, read-only) to confirm the archived `"Teste"` stage state.
- Ran: focused workflow test, `git diff --check`.
- No secrets printed; no tenant PII printed; no source modified; no data mutated.

---

LOOPLY R2.P1 JOBSWORKFLOW DRIFT INDEPENDENT AUDIT — PASS