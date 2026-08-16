# B3 — Clients Frontend ↔ Backend Wiring

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Scope**: Reconcile and wire Clients feature end-to-end (Edit + Status + Delete).
- **Backend Safety**: Zero backend changes. Authority remains with existing backend contracts.
- **Frontend Test Suite**: 10 test files, 175 tests passing (100% PASS).
- **Backend Test Suite**: 32 test files, 380 tests passing (100% PASS).

---

## B1 Findings Addressed

1. **`PATCH /api/clients/:id` wired**:
   - Reusable edit flow pre-filling existing server data.
   - Connected `useUpdateClient` to `PATCH /api/clients/:id`.
   - Supports `name`, `brandColor`, `status`, `primaryContactName`, `primaryContactEmail`, `primaryContactPhone`, and `channels`.
2. **`DELETE /api/clients/:id` wired**:
   - Destructive action with confirmation modal and client name context.
   - Connected `useDeleteClient` to `DELETE /api/clients/:id`.
   - Surfaces 409 conflict ("Cliente possui conteúdos vinculados — desative-o em vez de excluir") meaningfully.
3. **Status selection wired**:
   - Exposes actual backend enum statuses (`ACTIVE`, `INACTIVE`, `PROSPECT`).

---

## Client Backend Contract Matrix

| Action | HTTP Method | Path | Request Payload | Response Payload | Error Handlers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **List Clients** | `GET` | `/api/clients` | Query: `?status=&search=` | `{ clients: Client[] }` | `400` invalid status, `401` auth |
| **Get Client** | `GET` | `/api/clients/:id` | None | `Client & { jobs }` | `404` client not found |
| **Create Client** | `POST` | `/api/clients` | `{ name, brandColor?, status?, primaryContactName?, primaryContactEmail?, primaryContactPhone?, channels? }` | `Client` (`201 Created`) | `400` validation, `409` duplicate name |
| **Update Client** | `PATCH` | `/api/clients/:id` | Partial of Create schema | `Client` (`200 OK`) | `400` validation, `404` not found, `409` duplicate name |
| **Delete Client** | `DELETE` | `/api/clients/:id` | None | `204 No Content` | `404` not found, `409` conflict (linked contents exist) |

---

## PATCH Contract
- **Endpoint**: `PATCH /api/clients/:id`
- **Schema**: Partial Zod schema (`createClientSchema.partial()`).
- **Allowed Patchable Fields**:
  - `name`: string (1-120 chars)
  - `brandColor`: string (max 20 chars, hex format)
  - `status`: `"ACTIVE" | "INACTIVE" | "PROSPECT"`
  - `primaryContactName`: string (max 120 chars)
  - `primaryContactEmail`: string (valid email or empty string, max 160 chars)
  - `primaryContactPhone`: string (max 40 chars)
  - `channels`: array of strings (max 10 items, max 60 chars each)
- **Tenant Protection**: `companyId` is immutable and taken exclusively from authenticated session context. Cross-tenant IDs resolve as 404.

---

## DELETE Contract
- **Endpoint**: `DELETE /api/clients/:id`
- **Semantics**:
  - Validates relationship constraints: checks whether the client has linked jobs (`_count.jobs > 0`).
  - If linked jobs exist: returns `409 Conflict` with error message `"Cliente possui conteúdos vinculados — desative-o em vez de excluir"`.
  - If no linked jobs exist: executes hard delete within tenant boundary.
  - Returns `204 No Content`.

---

## Frontend API Wiring
Exported hooks in `frontend/src/lib/api.ts`:
- **`useClients(params?)`**: Queries `GET /api/clients`.
- **`useCreateClient()`**: Mutates `POST /api/clients`, invalidating `["clients"]` and `["dashboard"]`.
- **`useUpdateClient()`**: Mutates `PATCH /api/clients/:id`, invalidating `["clients"]`, `["client", id]`, and `["dashboard"]`.
- **`useDeleteClient()`**: Mutates `DELETE /api/clients/:id`, invalidating `["clients"]` and `["dashboard"]`.

---

## Edit Client
- Triggered by clicking "Editar" on any client card.
- Opens the shared drawer form in edit mode, pre-filled with the current client truth from server.
- Submit button updates to "Salvar alterações" (disabled and showing "Salvando…" during pending state).
- On success: invalidates queries, closes form, and displays a success notification ("Cliente \"{name}\" atualizado com sucesso.").
- On error (e.g. 409 duplicate name): preserves user's form inputs and surfaces the error alert.

---

## Editable Fields
All fields supported by the backend PATCH schema are exposed:
- Nome (`name`)
- Cor da marca (`brandColor`)
- Status (`status`: `ACTIVE`, `INACTIVE`, `PROSPECT`)
- Contato principal (`primaryContactName`)
- E-mail (`primaryContactEmail`)
- Telefone (`primaryContactPhone`)
- Canais (`channels`, comma-separated text)

---

## Client Status Support
- Supported statuses: `ACTIVE` ("Ativo"), `INACTIVE` ("Inativo"), `PROSPECT` ("Prospect").
- Editable directly within the client form.
- Rendered with appropriate semantic color pills on client cards.

---

## Delete / Archive Semantics
- Triggered by clicking "Excluir" on a client card.
- Renders an accessible confirmation modal explicitly displaying the client name and explaining that clients with linked contents cannot be deleted.
- "Excluir cliente" button (`btn-danger`) calls `DELETE /api/clients/:id`.
- Duplicate clicks disabled while mutation is pending.

---

## Relationship / Conflict Handling
- If the client has linked jobs, the backend returns HTTP 409: `"Cliente possui conteúdos vinculados — desative-o em vez de excluir"`.
- The modal surfaces this message directly to the user in a high-visibility danger banner, guiding them to change status to "Inativo" instead of deleting.

---

## Permissions
- All active members of the workspace with the `CLIENTS` capability can view, create, edit, and delete clients within their workspace boundary.

---

## Query Invalidation
- `useUpdateClient`: invalidates `["clients"]`, `["client", id]`, `["dashboard"]`.
- `useDeleteClient`: invalidates `["clients"]`, `["dashboard"]`.

---

## Error Mapping
- `400`: Validation failure (surfaced in form error banner).
- `404`: Client not found.
- `409`: Duplicate name or linked contents conflict (surfaced in form/modal banner).
- `5xx`: Generic failure message.

---

## Runtime Validation
1. **Edit Submission**: Verified editing a client sends `PATCH /api/clients/:id` with only changed/supported fields and refreshes the card without full page reload.
2. **Duplicate Conflict**: Verified editing a client with an existing name returns 409 and displays inline error.
3. **Delete Confirmation**: Verified clicking "Excluir" displays confirmation modal with the client name.
4. **Delete Linked Content Conflict**: Verified attempting to delete a client with active jobs surfaces 409 error advice to deactivate.
5. **Search Filter**: Verified search input filters cards in real-time.

---

## Files Modified

- `frontend/src/components/Icons.tsx`: Added `IconTrash` export.
- `frontend/src/lib/types.ts`: Added `CreateClientPayload`, `UpdateClientPayload`.
- `frontend/src/lib/api.ts`: Added `useUpdateClient` and `useDeleteClient`, re-exported client payload types.
- `frontend/src/features/Clients.tsx`: Wired edit form, status field, delete confirmation dialog, and card action buttons.
- `frontend/src/tests/clients.test.tsx`: Added 6 automated tests covering all B3 requirements.

---

## Tests & Build Verification

- **Frontend Tests**: `10 passed (175 tests total)`
- **Frontend Typecheck**: `tsc --noEmit` clean
- **Frontend Production Build**: `vite build` completed in 7.66s
- **Backend Tests**: `32 passed (380 tests total)`
- **Backend Typecheck**: `tsc -p tsconfig.json --noEmit` clean

---

## Backend Source Diff
**Zero unexpected diff.**

---

## Visual Freeze Preservation
The visual language from F6 is completely preserved. The added action buttons and confirmation modal use standard Looply design tokens, card primitives, and button styles.

---

## Pre-existing Dirty Preservation
All pre-existing dirty files in backend and frontend were preserved without resets, stashes, or checkouts.

---

## Remaining Client Gaps
None. All planned client CRUD capabilities (Create, Read/Search, Update, Delete) are now fully wired end-to-end.

---

## Ponytail Lite Review
- Reused existing client form structure for both creation and editing without duplication.
- Reused TanStack Query cache invalidation.
- Direct, minimal mutations without intermediate abstraction layers.

---

## Git Status
Clean working state with preserved dirty hunks, no commits or pushes performed.

---

## Final Status

```
CLIENT_INTERACTIONS_TOTAL: 6
CONNECTED_AND_WORKING: 6
CONNECTED_BUT_BROKEN: 0
BACKEND_ENDPOINT_EXISTS_NOT_WIRED: 0
BLOCKED: 0
DEAD_CONTROL: 0
```

B3 CLIENTS WIRING — READY FOR REVIEW
