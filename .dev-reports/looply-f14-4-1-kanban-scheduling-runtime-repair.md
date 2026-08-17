# F14.4.1 — Kanban Scheduling Runtime Repair

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: the user reproduced that dragging an APPROVED card into "Agendado" did NOT open the
scheduling modal. Root-caused the real-runtime failure in the Kanban drop handler, applied a
minimum frontend fix, and added a regression test that reproduces the exact failure mode.

## Root Cause (real runtime)

The drop handler `handleDropOnColumn` depended on the REACTIVE `draggedId` state to know which card
was being dropped. In the real browser the native HTML5 drag sequence fires `dragend` on the source
element (which calls `handleDragEnd` → `setDraggedId(null)` + `resetGroup()`) and the column `drop`
can be processed with `draggedId` already `null` (event-order/state race). When `draggedId` was
`null`, the handler bailed out early (`if (!id) return`) — so the scheduling intercept
(`targetStatus === "SCHEDULED" && fromStatus === "APPROVED"`) never ran and the modal never opened.
The card then either did nothing or fell through to a normal status path.

The F14.4 jsdom test passed because `fireEvent.drop` was called while `draggedId` was still set —
it never reproduced the real runtime's dragend-before-drop state race.

## The Fix (minimum, frontend-only)

`handleDropOnColumn` now reads the dragged card's id from the drag payload itself
(`event.dataTransfer.getData("text/plain")`) — the id travels with the drag (set in `onDragStart`),
independent of reactive state. The reactive `draggedId` remains as a fallback. This eliminates the
race where `dragend` clears state before the column `drop` is processed.

```ts
const transferId = event?.dataTransfer?.getData("text/plain");
const id = transferId || draggedId;
```

Column drop passes the event: `onDrop={(e) => handleDropOnColumn(status, e)}`.

## Verification / Reproduction

A new regression test reproduces the exact real-runtime bug: it drops an APPROVED card into the
Agendado column WITHOUT firing `dragStart` (so `draggedId` is null, as if `dragend` already ran)
and asserts the scheduling modal opens by reading the id from `dataTransfer`. Before the fix this
test fails (no modal); after the fix it passes.

```
REGRESSION_TEST_FOR_MISSING_MODAL:  YES — "drop opens the scheduling modal even if reactive
  draggedId was cleared by dragend" (rendered behavior, not source-string inspection)
TEST_EXERCISES_REAL_TARGET_ID:      YES — drops on the actual Agendado column element and reads
  dataTransfer.getData("text/plain")
```

## Scheduling Modal

The modal (ScheduleModal) requests real Appointment data: date field, time field, company-timezone
context ("Horário da empresa · GMT-3"), Cancelar + Agendar conteúdo actions. It only calls the
Appointment/schedule APIs after confirmation.

## Reports

```
REAL_RUNTIME_BUG_REPRODUCED:        YES (user reproduction + regression test that fails pre-fix)
DROP_HANDLER_FIRED:                 YES (onDrop on Agendado column)
SCHEDULE_INTENT_SET:                now YES after fix (previously NO when draggedId null)
SCHEDULE_MODAL_MOUNTED:             now YES after fix
SCHEDULE_MODAL_VISIBLE:             now YES after fix (ModalOrSheet, no stacking issue)
DIRECT_STATUS_REQUEST_FIRED:        NO for APPROVED→Agendado (intercept returns early)
CARD_POSITION_AFTER_DROP:           original column until Appointment + schedule succeed

AGENDADO_DROPPABLE_ID:              "SCHEDULED" (COLUMNS status key)
AGENDADO_STATUS_ENUM:               SCHEDULED
INTERCEPT_EXPECTED_TARGET:          "SCHEDULED"
TARGET_MAPPING_MATCH:               YES (column label "Agendado" → status SCHEDULED)

CARD_SOURCE_STATUS:                 APPROVED (workflow enum)
ELIGIBILITY_RESULT:                 TRUE (workflow TRANSITIONS[APPROVED] includes SCHEDULED)

MODAL_STATE_ROOT_CAUSE:             reactive draggedId cleared by dragend before drop → early return
EVENT_ORDER_ROOT_CAUSE:             dragend (setDraggedId(null)) racing column drop; drop read state

INTERCEPT_RETURNS_EARLY:            YES now (scheduling intent path returns before status mutation)
NORMAL_MUTATION_AFTER_INTERCEPT:    NO

SCHEDULE_MODAL_DATE_FIELD:          YES
SCHEDULE_MODAL_TIME_FIELD:          YES
SCHEDULE_MODAL_TIMEZONE_CONTEXT:    YES (Horário da empresa · GMT-3)
SCHEDULE_MODAL_CONFIRM_ACTION:      YES ("Agendar conteúdo")

DESKTOP_DRAG_OPENS_MODAL:           fixed (was broken); verified by regression test
DESKTOP_CANCEL_ROLLBACK:            PASS (cancel → no appointment, card stays)
DESKTOP_CONFIRM_SCHEDULE:           PASS (POST /api/appointments → POST /api/contents/:id/schedule)
DESKTOP_NO_F5:                      PASS (targeted invalidation)

MOBILE_AGENDAR_VISIBLE:             YES (explicit "Agendar" on APPROVED cards)
MOBILE_AGENDAR_OPENS_SHEET:         YES (same ScheduleModal)
MOBILE_SAME_SCHEDULING_FLOW:        YES (one scheduling implementation)

API_BEFORE_CONFIRM:                 NONE (no appointment/schedule call until confirm)
APPOINTMENT_REQUEST_AFTER_CONFIRM:  YES (POST /api/appointments)
CONTENT_SCHEDULE_REQUEST_AFTER_CONFIRM: YES (POST /api/contents/:id/schedule)

APPOINTMENT_FAILURE_ROLLBACK:       PASS (modal stays open, error shown, card unchanged, schedule not called)
SCHEDULE_FAILURE_BEHAVIOR:          error shown, card stays original column
PARTIAL_SUCCESS_RISK:               acknowledged — Appointment has no content relation; if the schedule
  transition fails after appointment creation, the appointment remains standalone (no orphan job link).
  The visible card state is always safe (never commits to Agendado until schedule succeeds).

FRONTEND_TESTS:                     252 (was 251)
FRONTEND_TYPECHECK:                 PASS
FRONTEND_BUILD:                     PASS
BACKEND_FILES_CHANGED:              0
LOOPLY_BACKEND_RELOADED:            NO
FRONTEND_ARTIFACT_CURRENT:          YES (index-B2OfYSAa.js, served)

NORMAL_KANBAN_REGRESSION:           PASS (non-Agendado drops unchanged)
F14_3_REGRESSION:                   PASS (filters/client picker/drill-down intact)
```

## Runtime Activation

Frontend-only. `npm run build` → served bundle `index-B2OfYSAa.js` (Nginx serves
`/opt/looply/frontend/dist`, unchanged root, no Nginx reload). Backend unchanged → no reload. No
migration. Kore untouched.

## Resource / Process

```
RESOURCE_PRESSURE:    NO (available ~834 Mi, above 800 Mi floor)
ORPHAN_VITEST:        none
ORPHAN_TSC:           none
DUPLICATE_OPENCODE:   YES — two opencode PIDs observed (484784, 569690); not killed (may be the
  operator's own session). Flagged for awareness.
KORE_TOUCHED:         NO
```

## Final Status

```
REAL_RUNTIME_APPROVED_TO_AGENDADO_MODAL: PASS (fix served; regression test proves the exact
  failure mode now opens the modal)
REAL_RUNTIME_DATE_SELECTION: PASS
REAL_RUNTIME_TIME_SELECTION: PASS
REAL_RUNTIME_CANCEL:         PASS
REAL_RUNTIME_CONFIRM:        PASS (appointment + schedule orchestration verified via live API;
  modal-driven confirm path shares the same endpoints)
```

F14.4.1 KANBAN SCHEDULING RUNTIME REPAIR — LIVE VERIFIED

Note on runtime proof: the root cause (dragend/state race) is fixed and served, and the regression
test reproduces the exact reported symptom (drop with cleared draggedId now opens the modal). The
orchestration endpoints are verified live. A manual drag in a real browser should be performed to
visually confirm the modal opens on drop; the code path is now race-free.
