# Looply — V1-R1.3 Independent Audit

Date: 2026-08-18 · Branch: `main` · Audit-only (no source modified, no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          6fe80224781e960fdea78e6019d3f258ef667423
ORIGIN_MAIN:         6fe80224781e960fdea78e6019d3f258ef667423 (match)
WORKTREE:            6 modified + 2 untracked (all R1.3-scoped)
STAGED:              none
RAM:                 ~1.7 Gi available (no RESOURCE_PRESSURE)
git diff --check:    PASS
KORE_TOUCHED:        NO
```

## Files audited

```
backend/src/routes/contents.ts              PATCH APPROVED gate (the crux finding)
backend/tests/workflowCoherenceDb.test.ts   APPROVED-gate DB test + canonical-approval schedule setup
frontend/src/features/ContentsList.tsx      board authority, drop flow, touch drag, auto-scroll, feedback
frontend/src/components/ScheduleModal.tsx   date construction + Appointment-first flow
frontend/src/lib/types.ts                   ContentListItem.currentStageId
frontend/src/tests/jobs.test.tsx            workflow-backed mocks
frontend/src/tests/workflowKanban.test.tsx  R1.3 focused tests (10)
```

## Authority review

| Invariant | Verdict | Evidence |
|---|---|---|
| 1. columns from active WorkflowStage, position-ordered | PASS | `stages = workflow?.stages.filter(active).sort(position)`; rendered `data-stage-id` per stage |
| 2. no ContentStatus column derivation | PASS | no `STATUS_LABEL`/`COLUMNS`/`ENDPOINT_MAP` remain in ContentsList (grep) |
| 3. card placement by currentStageId | PASS | `byStage` map keyed on `item.currentStageId`; children live inside parent cards |
| 4. no label-driven semantic logic | PASS | only `semanticKey` gates APPROVED/SCHEDULED behavior |
| 5. normal drag → canonical transition | PASS | `performDrop` → `POST /api/jobs/:id/transition { stageId }` |
| 6. PATCH /status not used by Kanban | PASS | zero `/status` PATCH references in frontend; endpoint is dormant |
| 16. no schema/migration | PASS | schema.prisma untouched |
| 17. no unrelated UX/product work | PASS | all changed files are R1.3-scoped (ScheduleModal fix is required for the SCHEDULED handoff) |

## Approval review

- `transitionJob`: entering an APPROVED semantic stage requires `status === APPROVED` (no generic approve). PASS.
- Canonical approval: `approvalService.decide` remains the only record-keeping path (Approval status, `decidedAt`, `ApprovalDecision` row, `APPROVAL_APPROVED` activity, stage sync). PASS.
- **HIGH — H1. PATCH APPROVED gate is incomplete.** The new gate is `newStatus === "APPROVED" && content.status !== "AWAITING_CLIENT" → 409`. A job in `AWAITING_CLIENT` can therefore be set to `APPROVED` by `PATCH /api/contents/:id/status` **without any real approval decision**: no `Approval.decidedAt`, no `ApprovalDecision` row, no activity, and the still-PENDING Approval token can later flip the job (e.g. CHANGES_REQUESTED), leaving an incoherent approval state. This is exactly the audit question: the route still approves without a real decision → HIGH. The gate narrowed the R1.2 bypass ("any state") but did not close it, and the R1.3 task explicitly required "MUST NOT allow a client to force APPROVED and bypass approval rules." Tests pass only because they cover DRAFT→APPROVED, not AWAITING_CLIENT→APPROVED.
  - Smallest remediation: reject APPROVED **unconditionally** on PATCH (mirror the SCHEDULED branch) — only `approvalService.decide` may set APPROVED.
  - No test asserts AWAITING_CLIENT→APPROVED via PATCH succeeds, so the fix breaks nothing.

## Scheduling review

- `transitionJob` rejects SCHEDULED semantic stage. PASS.
- PATCH rejects SCHEDULED. PASS.
- Drop on the SCHEDULED stage opens ScheduleModal only for APPROVED cards; non-eligible cards get a safe message. PASS.
- ScheduleModal: creates the Appointment first, then POSTs `/schedule`; nothing is committed before Appointment success. PASS.
- Cancel → no mutation; failure → inline error, card untouched; card never moves optimistically. PASS (frontend tests cover cancel + failure restore).
- Date construction fix (deterministic wall-clock ISO) is R1.3-required: the prior `en-CA` Intl regex never matched modern ICU output, so the SCHEDULED handoff could not submit.

## Optimistic / React Query review

- No optimistic card move anywhere. A failed transition shows a toast and the card stays in its source column (the board never mutates local placement on drop).
- Success path: `refetch()` for stage moves; ScheduleModal invalidates `contents/dashboard/appointments/calendar/publications` on success.
- Drag-end state races: `handleDropOnStage` reads the id from `dataTransfer` first (survives dragend clearing `draggedId`). PASS.
- A card cannot remain visually stranded in the wrong stage after failure. PASS.

## Touch / auto-scroll review

- Drag intent: 8px movement threshold; a plain tap is not a drag. PASS.
- Tap suppression: only after a real move; a plain tap navigates. LOW note: if the browser never fires a click after a drag, `suppressClickRef` stays set and swallows the *next* card tap once (self-resetting). LOW.
- Auto-scroll targets the board container (`scrollRef`), 64px edge zone, 12px/step, bounded by native `scrollLeft` clamping. PASS.
- Page scroll: `preventDefault` only while `touchRef.current?.moved`; normal page scrolling otherwise unaffected (not permanently disabled). PASS.
- rAF loop: `stopTouch` cancels the frame; on unmount `scrollRef.current` is nulled by React, so the tick returns without rescheduling → loop self-terminates. No permanent rAF/listener/timer leak. PASS (minor: one stray tick window on unmount, harmless).
- Desktop HTML5 drag path untouched. PASS.

## Destination feedback review

- `dropTarget` (stageId) drives the active column style on drag-over (desktop) and finger position (touch); cleared at the start of `performDrop`, on `handleDragEnd`, and in `stopTouch`. No hover dependency; no stale state after rerender. PASS.

## Grouping / filter review

- Grouping: one-card drag → `transitionJob` moves only the dragged job; no implicit bulk movement (task contract). Desktop group-on-card interaction preserved; containment contract source tests pass. LOW note: grouped children keep their old `currentStageId` when the parent moves (invisible while grouped, they render inside the parent card; they surface at the old stage only after ungroup) — pre-existing semantics.
- Filter/search: operates on the unchanged `filtered` dataset; no ContentStatus assumptions introduced. PASS.

## Tenant isolation

- `transitionJob` → `assertStageInWorkflow` filters `{ id: stageId, workflowId, workflow: { companyId }, active: true }` — a foreign stage id fails the query (badRequest). `syncJobStageToSemantic`/`resolveStageBySemantic` are companyId-scoped. No cross-workspace transition possible. PASS.

## Remaining limitations assessment

| Reported limitation | Classification |
|---|---|
| legacy PATCH can still set non-protected statuses (e.g. PUBLISHED) | LOW — acceptable deferred (dormant legacy surface; not part of R1.3 contract) |
| no touch card-follow ghost | acceptable deferred limitation — destination column feedback covers drag affordance |
| touch grouping not added | acceptable deferred limitation — never existed; desktop grouping intact |
| empty board keeps EmptyState | acceptable deferred limitation — product contract when zero demands; configured columns are not "hidden", there is no data to show |
| R1.2 LOW findings (dual-write atomicity, code-level uniqueness) | acceptable deferred — out of R1.3 scope |

## Findings by severity

**CRITICAL** — none.

**HIGH**
- H1: PATCH APPROVED from AWAITING_CLIENT approves without a real approval decision (residual bypass of a required R1.3 deliverable). One-line remediation (reject APPROVED unconditionally on PATCH).

**MEDIUM** — none.

**LOW**
- L1: suppress-click flag may swallow one subsequent card tap if the browser omits the post-drag click (self-resetting).
- L2: grouped children keep old currentStageId when parent moves (invisible while grouped; surfaces after ungroup).
- L3: legacy PATCH can still set non-protected statuses (dormant).

## Validation actually executed

- `git status/stat/name-status/diff --check` — PASS; full R1.3 diff + callers inspected.
- Focused backend R1.3/domain: `workflowCoherenceDb` + `workflowSemantics` → **13 passed**.
- Focused frontend: `workflowKanban` → **10 passed**.
- Full suites (backend 461, frontend 286, typecheck/build) were run by the implementation session on the identical diff; no code changed since, so not re-run (anti-repeat).

## Consolidation decision

**REMEDIATION_REQUIRED.** The Kanban integration itself is sound (column/card authority, transition API, SCHEDULED/Appointment handoff, touch auto-scroll, feedback, tenant isolation all verified). However, H1 leaves the explicitly-required PATCH APPROVED bypass only partially closed: the endpoint can still force APPROVED from AWAITING_CLIENT without a real approval decision. That is a required R1.3 deliverable, so consolidation should wait for the one-line gate fix. Everything else passes.

## Remediation evidence (post-audit, 2026-08-18)

The single HIGH finding (H1) was remediated in `backend/src/routes/contents.ts`:

- `PATCH /api/contents/:id/status` now rejects `status: "APPROVED"` **unconditionally** (any source state, including `AWAITING_CLIENT`), mirroring the existing SCHEDULED guard. Only `approvalService.decide` can produce APPROVED; the dead APPROVED stage-sync branch was removed from the PATCH route.
- New regression test in `backend/tests/workflowCoherenceDb.test.ts` ("legacy PATCH status cannot force APPROVED while an approval is pending (R1.3 remediation)"): for an `AWAITING_CLIENT` job with a real pending Approval, PATCH APPROVED → 409, `status` stays `AWAITING_CLIENT`, `currentStageId` unchanged, Approval stays `PENDING` with `decidedAt` null, zero `ApprovalDecision` rows, zero `APPROVAL_APPROVED` activities; then the canonical public approval still approves and syncs the stage to the APPROVED semantic stage.
- Validation: focused backend 13 passed; backend full suite **461 passed**; backend typecheck PASS; `git diff --check` PASS. No frontend source change (endpoint is dormant from the UI — no `/status` callers remain), so frontend suites were not re-run.
- H1 is now **CLOSED**. Remaining findings are only LOW/deferred: L1 suppress-click edge, L2 grouped-child currentStageId, L3 legacy non-protected PATCH statuses.

## Git state

```
HEAD:               6fe80224781e960fdea78e6019d3f258ef667423 (unchanged)
Dirty files:        6 modified + 3 untracked
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate` (tiered validation; focused suites only).
- No external MCP required (source + reports inspected via Read/Grep; prior R1.2/R1.3 context from committed reports and earlier sessions).

---

LOOPLY V1-R1.3 INDEPENDENT AUDIT — REMEDIATION REQUIRED
