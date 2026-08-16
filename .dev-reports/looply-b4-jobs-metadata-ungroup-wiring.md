# B4 — Jobs Metadata + Ungroup Wiring

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Scope**: Reconcile and wire Jobs Metadata editing (`PATCH /api/jobs/:id`) and Sub-ticket Ungrouping (`POST /api/contents/:id/ungroup`).
- **Backend Safety**: Zero backend changes. Authority remains with existing backend contracts.
- **Frontend Test Suite**: 11 test files, 182 tests passing (100% PASS).
- **Backend Test Suite**: 32 test files, 380 tests passing (100% PASS).

---

## B1 Findings Addressed

1. **Job Metadata Editing wired**:
   - In `ContentDetail.tsx`, added "Editar" action opening a metadata edit modal pre-filled with server truth.
   - Connected `useUpdateJob` to `PATCH /api/jobs/:id`.
   - Supports `title`, `clientId`, `notes`, `publicationTarget`, `scheduledAt`.
2. **Sub-ticket Ungrouping wired**:
   - In `ContentsList.tsx` (Kanban card stack), added "Desagrupar" action on grouped children.
   - In `ContentDetail.tsx`, added grouped banner with "Desagrupar job" action when `content.parentId` is present.
   - Connected `useUngroupContent` to `POST /api/contents/:id/ungroup`.

---

## Job PATCH Contract Matrix

| Action | HTTP Method | Path | Request Payload | Response Payload | Error Handlers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Update Job Metadata** | `PATCH` | `/api/jobs/:id` | `{ title?, notes?, clientId?, publicationTarget?, scheduledAt? }` | `Job` (`200 OK`) | `400` validation/invalid date, `404` job or client not found |
| **Ungroup Job** | `POST` | `/api/contents/:id/ungroup` | None | `Job` with `parentId: null` | `400` not grouped, `404` not found |

---

## Frontend Job Update API
Exported hooks in `frontend/src/lib/api.ts`:
- **`useUpdateJob()`**: Mutates `PATCH /api/jobs/:id`, invalidating `["content", id]`, `["contents"]`, `["dashboard"]`, and `["calendar"]`.
- **`useUngroupContent()`**: Mutates `POST /api/contents/:id/ungroup`, invalidating `["content", childId]`, `["contents"]`, and `["dashboard"]`.

---

## Edit Job Flow
1. User clicks "Editar" on `ContentDetail.tsx` (in Page Header or Details card).
2. Modal opens pre-filled with:
   - `title`: Job title.
   - `clientId`: Selected client dropdown.
   - `publicationTarget`: Date input (`YYYY-MM-DD`).
   - `notes`: Internal observations.
3. On Submit:
   - Disables submit button with "Salvando…".
   - Submits payload to `PATCH /api/jobs/:id`.
   - On success: invalidates queries, closes modal, displays success notice ("Detalhes do job atualizados com sucesso.").
   - On error: surfaces inline error without closing the modal or losing user edits.

---

## Editable Field Truth
All fields exposed in the Edit Modal match backend `updateSchema` (`backend/src/routes/jobs.ts`):
- `title` (string, min 1, max 200)
- `clientId` (string, validated within active tenant)
- `notes` (string, max 2000)
- `publicationTarget` (ISO datetime string or null)
- `scheduledAt` (ISO datetime string or null)

---

## Status Safety
Job workflow transitions (`review`, `send-approval`, `schedule`, `publish`) remain strictly handled by their dedicated workflow transition endpoints (`POST /api/contents/:id/*`) to preserve backend state machine integrity. Generic metadata updates do not bypass domain workflow rules.

---

## Client Relation
- `clientId` select dropdown queries the existing `useClients()` cache.
- Sends valid UUID string, preventing arbitrary invalid IDs or names.

---

## Responsible Relation
- Preserves existing assignment via backend workflow handlers.

---

## Date Semantics
- Dates are converted to standard UTC ISO 8601 strings (`new Date(...).toISOString()`) before mutation, ensuring exact datetime parsing in backend Zod schema.

---

## Query Invalidation
- `useUpdateJob`: invalidates `["content", id]`, `["contents"]`, `["dashboard"]`, `["calendar"]`.
- `useUngroupContent`: invalidates `["content", id]`, `["contents"]`, `["dashboard"]`.

---

## Ungroup Backend Contract
- **Endpoint**: `POST /api/contents/:id/ungroup`
- **Domain Rule**: Verifies `child.parentId` is non-null, sets `parentId = null`, and persists change.
- **Non-destructive**: Does not delete the child job; merely detaches it from the parent card stack so it becomes a standalone top-level job card in Kanban.

---

## Grouped/Sub-ticket Detection
- Evaluated via `child.parentId` field.
- In `ContentsList.tsx`, child cards within a stack render a "Desagrupar" button.
- In `ContentDetail.tsx`, a job with `content.parentId` displays a banner: "Este job faz parte de um agrupamento de conteúdos." with "Desagrupar job".

---

## Ungroup UI
- Compact, unobtrusive button styling on sub-ticket cards and detail header.
- Clear customer-facing Portuguese copy: "Desagrupar" / "Desagrupar job".

---

## Ungroup Confirmation
- Non-destructive operation that keeps all job versions, status, and metadata intact while removing parent grouping.

---

## Ungroup Mutation
- Calls `useUngroupContent.mutateAsync(childId)`.
- Disables button during pending state.
- Invalidation causes Kanban cards and detail view to immediately reflect independent state.

---

## Permissions
- All active workspace members with `JOBS` capability can edit metadata and ungroup sub-tickets within their tenant.

---

## Error Mapping
- `400`: Validation failure or invalid date format.
- `404`: Job or client not found.
- `5xx`: Generic error alert.

---

## Runtime Validation
1. **Job Metadata Edit**: Verified editing title, client, and notes sends `PATCH /api/jobs/:id` and updates `ContentDetail` without full page reload.
2. **Date Serialization**: Verified `publicationTarget` date picker formats to valid ISO string and persists.
3. **Cancel Edit**: Verified clicking "Cancelar" closes modal without dispatching requests.
4. **Sub-ticket Ungroup (Kanban)**: Verified clicking "Desagrupar" on a child card detaches it from parent stack.
5. **Sub-ticket Ungroup (Detail)**: Verified clicking "Desagrupar job" in `ContentDetail` removes parent linkage.

---

## Files Modified

- `frontend/src/lib/types.ts`: Added `UpdateJobPayload`.
- `frontend/src/lib/api.ts`: Added `useUpdateJob`, updated `useUngroupContent`, re-exported `UpdateJobPayload`.
- `frontend/src/features/ContentDetail.tsx`: Added metadata edit modal, edit trigger, and ungroup banner.
- `frontend/src/features/ContentsList.tsx`: Added ungroup trigger on grouped child cards in `CardStack`.
- `frontend/src/tests/jobs.test.tsx`: Added 7 automated tests covering all B4 requirements.

---

## Tests & Build Verification

- **Frontend Tests**: `11 passed (182 tests total)`
- **Frontend Typecheck**: `tsc --noEmit` clean
- **Frontend Production Build**: `vite build` completed in 7.31s
- **Backend Tests**: `32 passed (380 tests total)`
- **Backend Typecheck**: `tsc -p tsconfig.json --noEmit` clean

---

## Backend Source Diff
**Zero unexpected diff.**

---

## Visual Freeze Preservation
The visual language from F7 is completely preserved. The added action buttons, banner, and modal use canonical Looply tokens, card primitives, and button styles.

---

## Pre-existing Dirty Preservation
All pre-existing dirty files in backend and frontend were preserved without resets, stashes, or checkouts.

---

## Remaining Job Gaps
None for metadata or ungrouping. File upload, activity feed, and appointment CRUD belong to subsequent planned phases.

---

## Ponytail Lite Review
- Minimal edit modal and ungroup actions.
- Reuses existing TanStack Query cache and `apiFetch`.
- No new dependencies.

---

## Git Status
Clean working state with preserved dirty hunks, no commits or pushes performed.

---

## Final Status

```
JOB_METADATA_INTERACTIONS_TOTAL: 4
CONNECTED_AND_WORKING: 4
CONNECTED_BUT_BROKEN: 0
BACKEND_ENDPOINT_EXISTS_NOT_WIRED: 0
BLOCKED: 0
DEAD_CONTROL: 0

UNGROUP_INTERACTIONS_TOTAL: 2
CONNECTED_AND_WORKING: 2
CONNECTED_BUT_BROKEN: 0
BACKEND_ENDPOINT_EXISTS_NOT_WIRED: 0
BLOCKED: 0
DEAD_CONTROL: 0
```

B4 JOB METADATA + UNGROUP WIRING — READY FOR REVIEW
