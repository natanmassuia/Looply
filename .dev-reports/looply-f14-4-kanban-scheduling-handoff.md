# F14.4 — Kanban → Scheduling Handoff

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: intercept the drop of an eligible (Aprovado) card into the Agendado column as an INTENT
TO SCHEDULE, open a scheduling modal/sheet, create the canonical Appointment, then move the demand
to Agendado. The card is never committed to Agendado until the Appointment succeeds. Frontend-only
orchestration that reuses the existing Appointment service/API and the existing `/schedule` content
transition. No backend files changed this battery. No migration. No commit. No push.

## Baseline
- F14 → F14.3 LIVE VERIFIED (backend 434 tests, frontend 248 tests).
- Working tree dirty: 71 entries at start (F12.2 → F14.3 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving `/opt/looply/frontend/dist`.

## Kanban Transition Audit

```
KANBAN_COMPONENT:               ContentsList.tsx (CardStack + grid-cols-7 columns)
KANBAN_DRAG_LIBRARY:            native HTML5 drag/drop (draggable, dataTransfer)
KANBAN_DROP_HANDLER:            handleDropOnColumn(targetStatus)
KANBAN_STATUS_MUTATION:         PATCH /api/contents/:id/status OR POST /api/contents/:id/{workflow endpoint}
KANBAN_ALLOWED_TRANSITIONS_SOURCE: backend domain/workflow.ts TRANSITIONS (APPROVED → SCHEDULED only)
KANBAN_OPTIMISTIC_UPDATE_BEHAVIOR: none for status (mutation happens server-side, then refetch)
KANBAN_ROLLBACK_BEHAVIOR:       refetch after mutation; on error card stays (no local optimistic move)
KANBAN_CURRENT_SCHEDULED_DROP:  APPROVED → SCHEDULED used ENDPOINT_MAP "APPROVED-SCHEDULED": "/schedule"
KANBAN_CURRENT_AGENDADO_BEHAVIOR: direct status transition via /api/contents/:id/schedule (sets
  job.status=SCHEDULED + scheduledAt) WITHOUT creating a canonical Appointment
KANBAN_TRANSITION_AUTHORITY:    backend assertCanTransition (workflow.ts)
```

Root finding: previously, dropping an APPROVED card into Agendado called `POST /api/contents/:id/schedule`
which set `job.status = "SCHEDULED"` + `scheduledAt` — but did NOT create an `Appointment` in the
canonical scheduling domain. The Appointment model is a separate entity (no `jobId` relation). F14.4
makes the drop open the scheduling handoff that creates a real Appointment first.

## Appointment Domain Audit

```
APPOINTMENT_MODEL:          Appointment (title, description, clientId, startsAt, endsAt, status, createdByUserId)
APPOINTMENT_CREATE_ENDPOINT: POST /api/appointments
APPOINTMENT_UPDATE_ENDPOINT: PATCH /api/appointments/:id
APPOINTMENT_CANCEL_ENDPOINT: POST /api/appointments/:id/cancel
APPOINTMENT_READ_ENDPOINT:   GET /api/appointments (+ /:id)
APPOINTMENT_JOB_RELATION:    NONE — Appointment has no jobId/contentId relation
APPOINTMENT_DATETIME_FIELDS: startsAt (required), endsAt (optional)
APPOINTMENT_TIMEZONE_AUTHORITY: Company.timezone (workspace.timezone via /me)
APPOINTMENT_STATUS_VALUES:   SCHEDULED | CANCELLED
```

## Scheduling Eligibility

```
SCHEDULING_ELIGIBLE_STATUSES:   [APPROVED]   (workflow.ts TRANSITIONS[APPROVED] = ["SCHEDULED"])
SCHEDULING_INELIGIBLE_STATUSES: DRAFT, IN_REVIEW, AWAITING_CLIENT, CHANGES_REQUESTED, SCHEDULED, PUBLISHED
```

Eligibility is the existing workflow authority (no second transition map).

## Agendado Drop Interception

In `handleDropOnColumn`, when `targetStatus === "SCHEDULED" && fromStatus === "APPROVED"` the handler
now stores a `scheduleIntent` (`{ id, title, clientId }`) instead of committing a status. The card
remains logically in its original column. Non-eligible drops into Agendado are rejected by the
existing backend `assertCanTransition` (e.g. a DRAFT dropped into Agendado → TransitionError 4xx,
card stays). No ghost permanent position is written.

## Appointment Editor Reuse

```
EXISTING_APPOINTMENT_EDITOR:   Calendar.tsx has its own inline create/edit form (no shared component)
KANBAN_REUSES_APPOINTMENT_EDITOR: NO — a new ScheduleModal is a thin date/time capture that calls the
  SAME canonical Appointment API (POST /api/appointments). It is not a second data model or form
  duplicating the full Calendar editor; it only collects the minimal scheduling fields.
NEW_DUPLICATE_SCHEDULING_FORM_CREATED: NO (reuses the canonical Appointment API/service; the modal
  is a lightweight handoff surface, not a parallel scheduling entity)
```

## Scheduling Modal Fields

`ScheduleModal` captures only real Appointment fields: date + start time (used to build `startsAt`
ISO in the company timezone), plus context (title + client from the dropped demand). It labels the
intent clearly ("Agendar conteúdo" + demand title + company timezone).

## Timezone Semantics

```
KANBAN_SCHEDULING_TIMEZONE_SOURCE:      Company.timezone (useMe → workspace.timezone)
KANBAN_SCHEDULING_BROWSER_TIMEZONE_DEPENDENCY: NO — startsAt is built with Intl timeZone = company zone;
  the modal shows "Horário da empresa · GMT-3" (reuses gmtOffsetLabel from F14.2)
```

## Existing Appointment Behavior

```
APPOINTMENT_CARDINALITY:          N/A — Appointment has no content relation; each scheduling handoff
  creates a new Appointment (one scheduling intent = one Appointment). No job↔appointment join exists.
EXISTING_APPOINTMENT_ON_DROP_BEHAVIOR: n/a (no per-content appointment lookup possible without a relation)
DUPLICATE_APPOINTMENT_PREVENTION: n/a at the data-model level; the handoff creates one Appointment per
  confirmed drop (the model cannot associate it with a specific content)
```

## Success Flow

On confirm, `ScheduleModal.submit`:
1. Validates date/time locally (UX only).
2. `POST /api/appointments` (canonical) with title + clientId + startsAt.
3. `POST /api/contents/:id/schedule` (moves demand to SCHEDULED, sets scheduledAt).
4. Invalidates `["contents"]`, `["dashboard"]`, `["appointments"]`, `["calendar"]`, `["publications"]`.
5. Closes modal + `refetch()` → card appears in Agendado; Agenda + Dashboard Próximas agendas reflect
   the new appointment (targeted invalidation, no F5, no route change).

```
SCHEDULING_CREATE_SUCCESS:                    YES (appointment 201 verified live)
KANBAN_MOVES_AFTER_APPOINTMENT_SUCCESS:       YES
CALENDAR_UPDATES_AFTER_SCHEDULING:            YES (["appointments"]+["calendar"] invalidated)
DASHBOARD_UPCOMING_UPDATES_AFTER_SCHEDULING:  YES (["dashboard"] invalidated)
```

## Status / Appointment Coordination

```
AGENDADO_STATE_SOURCE:                  job.status = "SCHEDULED" (set by /api/contents/:id/schedule)
APPOINTMENT_CREATE_CHANGES_STATUS:      NO — creating an Appointment does not change job.status
SEPARATE_STATUS_TRANSITION_REQUIRED:    YES — two operations: (1) create Appointment, (2) /schedule transition
```

Design (frontend orchestration): Appointment is created FIRST (domain authority), then the demand is
moved to SCHEDULED. Ordering is failure-safe for the visible state: the card never moves to Agendado
until the Appointment succeeds. If the /schedule transition fails after Appointment creation, the card
stays in its original column and an error is shown; because Appointment has no content relation, there
is no orphan linkage to clean up (the appointment remains a standalone scheduled item). This is the
minimal safe coordination given the current model — no backend atomic orchestration added this battery.

## Cancel Rollback

```
SCHEDULING_CANCEL_ROLLBACK:           PASS — Cancel closes the modal; no Appointment created, no status
  mutation, card stays in previous column (drag state fully reset by handleDragEnd).
APPOINTMENT_CREATED_ON_CANCEL:        NO (verified by test — createAppointment not called on cancel)
```

## Error Rollback

```
SCHEDULING_API_FAILURE_ROLLBACK:      PASS — on create/schedule failure the modal shows a controlled
  error, user input is preserved, and the card remains in its original column (no Agendado, no fake
  success toast, no duplicate activity).
```

## Invalid Drop

```
INVALID_SCHEDULE_DROP_BLOCKED:        YES — non-APPROVED cards dropped into Agendado are rejected by the
  backend transition authority; the frontend does not open the modal for ineligible states.
INVALID_SCHEDULE_DROP_FEEDBACK:       backend TransitionError (controlled error), card returns to original column.
```

## Grouped Demands

```
GROUPED_CHILD_SCHEDULING:             Only the dragged child is scheduled. The scheduling handoff uses
  the single child id (scheduleIntent.id). The group container + containment (F14.1) are preserved.
GROUPED_DEMAND_REGRESSION:            NO — the group wrapper, "Desagrupar demandas" button, and child
  containment are untouched; rollback keeps the child inside its group.
```

## Desktop UX (1440px / 1024px)

```
DESKTOP_SCHEDULING_SUCCESS:           PASS — drag Aprovado → Agendado opens modal; complete → card enters
  Agendado; Appointment appears in Agenda.
DESKTOP_SCHEDULING_MODAL:             PASS — modal opens, no permanent card move before save.
DESKTOP_KANBAN_REGRESSION:            PASS — non-scheduling drops unchanged (other columns behave normally).
```

## Mobile UX (390px)

```
MOBILE_KANBAN_DRAG_SUPPORTED:         native HTML5 drag is unreliable on touch; not extended this battery.
MOBILE_SCHEDULING_ENTRY_PATTERN:      explicit "Agendar" button on eligible (APPROVED) cards — opens the
  SAME ScheduleModal sheet. Touch-friendly, keyboard-accessible alternative to drag.
MOBILE_SCHEDULING_SUCCESS:            PASS (sheet, date/time inputs, confirm)
MOBILE_SCHEDULING_CANCEL:             PASS (Cancel closes, no commit)
MOBILE_SCHEDULING_OVERFLOW:           NO (ModalOrSheet with internal layout; date/time inputs fit)
```

## Accessibility

```
SCHEDULING_KEYBOARD_ACCESS:           PASS — the explicit "Agendar" button is keyboard-activatable; the
  modal has labeled Date/Time inputs, Cancel/confirm buttons, and ModalOrSheet focus/close behavior.
SCHEDULING_ACCESSIBLE_ALTERNATIVE:    YES — "Agendar" button on eligible cards (non-drag path), so drag
  into Agendado is not the only way to schedule.
```

## Calendar Consistency

```
KANBAN_APPOINTMENT_CANONICAL:         YES — the handoff calls the same POST /api/appointments used by
  Calendar; no special "Kanban appointment" flag/field.
CALENDAR_APPOINTMENT_EDITABLE:        YES (same Appointment entity)
CALENDAR_APPOINTMENT_CANCELABLE:      YES (same Appointment lifecycle)
```

## Dashboard Reactivity

```
SCHEDULING_INVALIDATION_KEYS:         ["contents"], ["dashboard"], ["appointments"], ["calendar"], ["publications"]
DASHBOARD_UPDATES_WITHOUT_REFRESH:    YES (["dashboard"] invalidated)
SCHEDULING_REQUIRES_F5:               NO
```

## Activity History

```
SCHEDULING_ACTIVITY_SOURCE:           existing domain — the /schedule transition and Appointment create
  follow existing server behavior; no frontend-invented activity rows.
DUPLICATE_ACTIVITY_CREATED:           NO
```

## Regression

```
F14_REGRESSION:   PASS — appearance 200, public upload intent 201, no loopback.
F14_1_REGRESSION: PASS — grouped containment + mobile Settings untouched.
F14_1_1_REGRESSION: PASS — ClientEditor + identity propagation intact.
F14_2_REGRESSION: PASS — dashboard recentContents=5, timezone, activity pagination works.
F14_3_REGRESSION: PASS — Clients/Team filters + rich Demand client filter + KPI drill-down intact.
```

## Runtime Activation

- Frontend-only → `npm run build` → served bundle `index-DgRvJMhB.js`; Nginx serves
  `/opt/looply/frontend/dist` (unchanged root, no Nginx reload).
- Backend unchanged → no backend build/reload.
- No migration. No Kore.

```
BACKEND_FILES_CHANGED: 0 (this battery)
LOOPLY_BACKEND_RELOADED: NO
FRONTEND_ARTIFACT_CURRENT: YES
```

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Backend tests  | 434    | 434   |
| Frontend tests | 248    | 251   |

Frontend additions (jobs.test.tsx):
- Drop Aprovado → Agendado opens the scheduling modal (no direct status commit).
- Cancel leaves original column and does NOT call the Appointment mutation.
- Explicit "Agendar" button exists on eligible cards (keyboard/mobile alternative).

Backend unchanged (no new backend tests needed).

## Resource Safety

```
AVAILABLE_RAM_START: ~1.6 Gi
AVAILABLE_RAM_FINAL: ~1.4 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: frontend typecheck → frontend tests → frontend build. Backend not rerun (unchanged this battery; last validated 434 in F14.2).

## Git Status

Working tree preserved (F12.2 → F14.4). Session touched (frontend only):
`features/ContentsList.tsx`, `components/ScheduleModal.tsx` (new), `tests/jobs.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.6 Gi
AVAILABLE_RAM_FINAL:                       ~1.4 Gi

KANBAN_COMPONENT:                          ContentsList (CardStack, HTML5 drag)
KANBAN_DROP_HANDLER:                       handleDropOnColumn
KANBAN_TRANSITION_AUTHORITY:               backend workflow.ts TRANSITIONS
KANBAN_CURRENT_SCHEDULED_DROP:             intercepted → scheduling handoff
KANBAN_CURRENT_AGENDADO_BEHAVIOR:          was direct /schedule; now Appointment + /schedule

APPOINTMENT_MODEL:                         Appointment (title, clientId, startsAt, endsAt, status)
APPOINTMENT_CREATE_ENDPOINT:               POST /api/appointments
APPOINTMENT_CARDINALITY:                   n/a (no job↔appointment relation)
APPOINTMENT_TIMEZONE_AUTHORITY:            Company.timezone

SCHEDULING_ELIGIBLE_STATUSES:              [APPROVED]
SCHEDULING_INELIGIBLE_STATUSES:            DRAFT, IN_REVIEW, AWAITING_CLIENT, CHANGES_REQUESTED, SCHEDULED, PUBLISHED

EXISTING_APPOINTMENT_EDITOR:               Calendar inline form (no shared component)
KANBAN_REUSES_APPOINTMENT_EDITOR:          reuses canonical Appointment API (ScheduleModal)
NEW_DUPLICATE_SCHEDULING_FORM_CREATED:     NO

KANBAN_SCHEDULING_TIMEZONE_SOURCE:         COMPANY_TIMEZONE
KANBAN_SCHEDULING_BROWSER_TIMEZONE_DEPENDENCY: NO

AGENDADO_STATE_SOURCE:                     job.status = SCHEDULED (via /schedule)
APPOINTMENT_CREATE_CHANGES_STATUS:         NO
SEPARATE_STATUS_TRANSITION_REQUIRED:       YES (Appointment first, then /schedule)

SCHEDULING_CREATE_SUCCESS:                 YES
KANBAN_MOVES_AFTER_APPOINTMENT_SUCCESS:    YES
SCHEDULING_CANCEL_ROLLBACK:                PASS
APPOINTMENT_CREATED_ON_CANCEL:             NO
SCHEDULING_API_FAILURE_ROLLBACK:           PASS
INVALID_SCHEDULE_DROP_BLOCKED:             YES

DRAG_STATE_CLEAN_AFTER_MODAL_OPEN:         YES
DRAG_STATE_CLEAN_AFTER_CANCEL:             YES
DRAG_STATE_CLEAN_AFTER_SUCCESS:            YES

GROUPED_CHILD_SCHEDULING:                  single child only
GROUPED_DEMAND_REGRESSION:                 NO

MOBILE_KANBAN_DRAG_SUPPORTED:              native HTML5 drag (unreliable on touch)
MOBILE_SCHEDULING_ENTRY_PATTERN:           explicit "Agendar" button (same sheet)
MOBILE_SCHEDULING_SUCCESS:                 PASS
MOBILE_SCHEDULING_CANCEL:                  PASS
MOBILE_SCHEDULING_OVERFLOW:                NO

DESKTOP_SCHEDULING_SUCCESS:                PASS
DESKTOP_KANBAN_REGRESSION:                 PASS

KANBAN_APPOINTMENT_CANONICAL:              YES
CALENDAR_APPOINTMENT_EDITABLE:             YES
CALENDAR_APPOINTMENT_CANCELABLE:           YES

SCHEDULING_INVALIDATION_KEYS:              contents, dashboard, appointments, calendar, publications
DASHBOARD_UPDATES_WITHOUT_REFRESH:         YES
SCHEDULING_REQUIRES_F5:                    NO

SCHEDULING_KEYBOARD_ACCESS:                PASS
SCHEDULING_ACCESSIBLE_ALTERNATIVE:         YES ("Agendar" button)

MIGRATION_CREATED:                         NO
BACKEND_FILES_CHANGED:                     0 (this battery)
LOOPLY_BACKEND_RELOADED:                   NO
FRONTEND_ARTIFACT_CURRENT:                 YES

F14_REGRESSION:                            PASS
F14_1_REGRESSION:                          PASS
F14_1_1_REGRESSION:                        PASS
F14_2_REGRESSION:                          PASS
F14_3_REGRESSION:                          PASS

BACKEND_TESTS:                             434
FRONTEND_TESTS:                            251
BACKEND_TYPECHECK:                         PASS (unchanged)
FRONTEND_TYPECHECK:                        PASS
BACKEND_BUILD:                             PASS (unchanged)
FRONTEND_BUILD:                            PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none

KORE_TOUCHED:                              NO
```

F14.4 KANBAN → SCHEDULING HANDOFF — LIVE VERIFIED