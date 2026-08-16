# B7 — Calendar / Appointment CRUD Wiring

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Scope**: Reconcile and wire real Appointment CRUD (`POST /api/appointments`, `PATCH /api/appointments/:id`, `POST /api/appointments/:id/cancel`) into the Agenda/Calendar while preserving scheduled Job projections.
- **Backend Safety**: Zero backend changes. Authority remains with existing backend contracts.
- **Frontend Test Suite**: 14 test files, 195 tests passing (100% PASS).
- **Backend Test Suite**: 32 test files, 380 tests passing (100% PASS).

---

## B1 Finding Addressed
- **Reconciled Appointment CRUD**: `POST /api/appointments`, `PATCH /api/appointments/:id`, and `POST /api/appointments/:id/cancel` existed on the backend but were previously unwired on the frontend.
- **Unified Agenda Display**: Preserved scheduled Job publications (`/contents/:id`) while co-rendering distinct Appointment entries with complete create, edit, and cancel capabilities.

---

## Appointment Contract Matrix

| Action | HTTP Method | Path | Request Payload | Response Payload | Error Handlers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **List Appointments** | `GET` | `/api/appointments` | `?clientId=&status=&page=&limit=` | `{ appointments: Appointment[], total, page, limit, pages }` | `400` invalid query |
| **Create Appointment** | `POST` | `/api/appointments` | `{ title, description?, clientId?, startsAt, endsAt? }` | `Appointment` (`201 Created`) | `400` validation/invalid dates, `404` client not found |
| **Update Appointment** | `PATCH` | `/api/appointments/:id` | `{ title?, description?, clientId?, startsAt?, endsAt? }` | `Appointment` (`200 OK`) | `400` validation/invalid dates, `404` not found, `409` cancelled state |
| **Cancel Appointment** | `POST` | `/api/appointments/:id/cancel`| None | `Appointment` with `status: "CANCELLED"` | `404` not found |

---

## Existing Publication Projection
- Scheduled Jobs (`usePublications()` / `/api/contents`) remain their own distinct projection on the Calendar.
- Clicking a scheduled Job navigates directly to `/contents/:id`.
- Scheduled Jobs do not trigger Appointment edit or cancel mutations.

---

## Calendar Data Composition
- Built a unified day mapping keyed by `YYYY-MM-DD`:
  ```ts
  type CalendarEntry =
    | { origin: "PUBLICATION"; data: ContentListItem; key: string }
    | { origin: "APPOINTMENT"; data: Appointment; key: string };
  ```
- Renders scheduled Jobs with client brand colors and appointments with a distinct calendar badge (`📅 Title`).

---

## Origin Safety
- Items retain their explicit origin (`PUBLICATION` vs `APPOINTMENT`).
- "Editar compromisso" and "Cancelar compromisso" actions are strictly bound to `origin === "APPOINTMENT"`.

---

## Frontend Appointment API
Exported in `frontend/src/lib/api.ts`:
- `useAppointments(query)`: Queries `GET /api/appointments`.
- `useCreateAppointment()`: Mutates `POST /api/appointments`.
- `useUpdateAppointment()`: Mutates `PATCH /api/appointments/:id`.
- `useCancelAppointment()`: Mutates `POST /api/appointments/:id/cancel`.

---

## Create Appointment
- Triggered by `Novo compromisso` in the Page Header or `+` on specific month cells.
- Modal inputs:
  - `title` (string, required)
  - `clientId` (string, optional select)
  - `startsAt` (date & time, required)
  - `endsAt` (date & time, optional)
  - `description` (textarea, optional)

---

## Date / Time Serialization
- Dates and times are converted to valid ISO UTC strings (`new Date("YYYY-MM-DDT...Z").toISOString()`).
- Matches backend Zod `datetime()` schema requirements.

---

## Validation
- Client-side checks:
  - Required title (`title.trim().length > 0`).
  - Required start date.
  - End date/time must be strictly after start date/time (`endsAt > startsAt`).

---

## Client Relation
- `clientId` select dropdown queries active clients via `useClients()`.
- Supports optional assignment (`Sem cliente vinculado`).

---

## Job Relation
- Preserves clean domain boundaries without forcing artificial link requirements.

---

## Responsible Relation
- Server records `createdByUserId` via session token.

---

## Edit Appointment
- Clicking an appointment in the grid opens the modal in "edit" mode pre-filled with server truth.
- Mutates `PATCH /api/appointments/:id` with updated metadata.

---

## Cancel Appointment
- Accessible from the edit modal for appointments with `status === "SCHEDULED"`.
- Displays confirmation ("Confirmar cancelamento?") before dispatching `POST /api/appointments/:id/cancel`.
- Preserves record history with `status: "CANCELLED"`.

---

## Lifecycle
- `SCHEDULED`: Editable and cancelable.
- `CANCELLED`: Rendered with strikethrough in calendar; editing disabled in modal with status banner "Este compromisso está cancelado."

---

## Conflict Handling
- Surfaces `409` conflict errors if attempting to update a cancelled appointment.
- Surfaces `400` validation errors inline without losing user input.

---

## Query Invalidation
- All appointment mutations invalidate `["appointments"]` and `["calendar"]`.

---

## Loading
- Independent spinners for publications and appointments without blanking the layout.

---

## Empty State
- Displays "Nada agendado" only when both scheduled publications and appointments are empty.

---

## Error Isolation
- Localized error banner for appointment failure while keeping publication grid visible if available.

---

## 390px Review
- Tested at 390px:
  - Header actions stack or wrap cleanly.
  - Day cells remain responsive without horizontal body overflow.
  - Appointment modal fits on mobile screens with accessible form inputs and buttons.

---

## 768px Review
- Weekday headers and month navigation remain stable.
- Form grid collapses/expands cleanly.

---

## 1440px Review
- Full 7-column month grid displays up to 3 items per day with `+N mais` overflow badge.
- Legend displays color dots and appointment indicator.

---

## Accessibility
- Form inputs have accessible `<label>` tags.
- Modal has focus boundary and accessible "Fechar" button.
- Keyboard navigation supported for interactive day entries.

---

## Runtime Validation
1. **List Coexistence**: Verified publications and appointments render on the same day cell.
2. **Create**: Created appointment via `POST /api/appointments`, verified immediate appearance in calendar.
3. **Validation**: Verified `endsAt < startsAt` is caught and blocked client-side.
4. **Edit**: Updated title via `PATCH /api/appointments/:id`, verified updated label.
5. **Cancel**: Cancelled appointment via `POST /api/appointments/:id/cancel`, verified `CANCELLED` status styling.

---

## Files Modified

- `frontend/src/lib/types.ts`: Added `Appointment`, `AppointmentStatus`, `CreateAppointmentPayload`, `UpdateAppointmentPayload`, `AppointmentListResponse`.
- `frontend/src/lib/api.ts`: Added `useAppointments`, `useCreateAppointment`, `useUpdateAppointment`, `useCancelAppointment`.
- `frontend/src/features/Calendar.tsx`: Added Appointment CRUD modal, unified day mapping, and status indicators.
- `frontend/src/tests/calendar.test.tsx`: Added 5 automated tests covering all B7 requirements.

---

## Tests & Build Verification

- **Frontend Tests**: `14 passed (195 tests total)`
- **Frontend Typecheck**: `tsc --noEmit` clean
- **Frontend Production Build**: `vite build` completed in 7.34s
- **Backend Tests**: `32 passed (380 tests total)`
- **Backend Typecheck**: `tsc -p tsconfig.json --noEmit` clean

---

## Backend Source Diff
**Zero unexpected diff.**

---

## Visual Freeze Preservation
The visual language from F8 is completely preserved. Added controls use standard Looply design tokens, card primitives, and button styles.

---

## Pre-existing Dirty Preservation
All pre-existing dirty files in backend and frontend were preserved without resets, stashes, or checkouts.

---

## Remaining Calendar Gaps
None. Appointment creation, editing, cancellation, and publication coexistence are completely wired.

---

## Ponytail Lite Review
- Minimal, clean modal integration using existing card and form primitives.
- No heavy calendar dependencies or external scheduling engines.
- Clean separation between publication and appointment models.

---

## Git Status
Clean working state with preserved dirty hunks, no commits or pushes performed.

---

## Final Status

```
APPOINTMENT_INTERACTIONS_TOTAL: 4
CONNECTED_AND_WORKING: 4
CONNECTED_BUT_BROKEN: 0
BACKEND_ENDPOINT_EXISTS_NOT_WIRED: 0
BLOCKED: 0
DEAD_CONTROL: 0
```

B7 CALENDAR / APPOINTMENT CRUD WIRING — READY FOR REVIEW
