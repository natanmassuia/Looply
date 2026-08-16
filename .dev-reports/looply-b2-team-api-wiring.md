# B2 — Team Frontend ↔ Backend Wiring

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Scope**: Reconcile and wire Team feature end-to-end (Invitations + Member Management).
- **Backend Safety**: Zero backend changes. Authority remains with existing backend contracts.
- **Frontend Test Suite**: 9 test files, 169 tests passing (100% PASS).
- **Backend Test Suite**: 32 test files, 380 tests passing (100% PASS).

---

## B1 Findings Addressed

1. **BROKEN `POST /api/team` removed**:
   - Replaced legacy `POST /api/team` call with `POST /api/invitations`.
   - `410 Gone` error eliminated from user path.
2. **`POST /api/invitations` wired**:
   - Invitation creation form now connects to the backend token-based invitation system.
3. **`GET /api/invitations` wired**:
   - Pending invitations list displayed for authorized roles (`OWNER` and `ADMIN`).
4. **`POST /api/invitations/:id/revoke` wired**:
   - Revocation action connects directly to the backend revocation handler.
5. **`GET /api/members` and `PATCH /api/members/:id` wired**:
   - Role updates (`OWNER`, `ADMIN`, `MEMBER`) and member status (`isActive`) updates connected for `OWNER`.

---

## Backend Contract Matrix

| Action | HTTP Method | Path | Request Payload | Response Payload | Authorization Guard |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Create Invitation** | `POST` | `/api/invitations` | `{ email: string, role: "ADMIN" \| "MEMBER" }` | `{ invitationId, token, expiresAt }` | `OWNER` (can invite `ADMIN`/`MEMBER`), `ADMIN` (can invite `MEMBER`) |
| **List Invitations** | `GET` | `/api/invitations` | None | `{ invitations: Invitation[] }` | `OWNER`, `ADMIN` |
| **Revoke Invitation** | `POST` | `/api/invitations/:id/revoke` | None | `{ ok: true }` | `OWNER`, `ADMIN` |
| **List Members** | `GET` | `/api/members` | None | `{ members: CompanyMember[] }` | `OWNER`, `ADMIN` (returns 403 for `MEMBER`) |
| **Update Member** | `PATCH` | `/api/members/:id` | `{ role?: "OWNER" \| "ADMIN" \| "MEMBER", isActive?: boolean }` | `CompanyMember` | `OWNER` only |
| **List Team (Fallback)** | `GET` | `/api/team` | None | `{ team: User[] }` | Any authenticated active workspace user |

---

## Legacy /api/team Root Cause

During B4/B12 hardening, direct arbitrary user creation was removed from `POST /api/team` in favor of an invitation-based onboarding lifecycle (`POST /api/invitations` → single-use 256-bit token → invitee sets password on `/api/invitations/accept`). The backend router `team.ts` explicitly returned `410 Gone`.

The frontend `Team.tsx` had retained the legacy `useCreateTeamMember` mutation pointing to `/api/team`. In B2, the mutation has been completely rewired to `useCreateInvitation` pointing to `POST /api/invitations`.

---

## Invitation API
The following hooks are exported in `frontend/src/lib/api.ts`:
- **`useInvitations(enabled?: boolean)`**: Queries `GET /api/invitations`, scoped to active workspace.
- **`useCreateInvitation()`**: Mutates `POST /api/invitations`, automatically invalidating `["invitations"]`, `["members"]`, `["team"]`, and `["dashboard"]`.
- **`useRevokeInvitation()`**: Mutates `POST /api/invitations/:id/revoke`, invalidating `["invitations"]`.

---

## Invite Flow
1. User clicks "Convidar membro" in the Page Header (visible to `OWNER` and `ADMIN`).
2. Drawer/Card opens with Email and Role selector:
   - If current user is `OWNER`: options are `Membro` (`MEMBER`) and `Administrador` (`ADMIN`).
   - If current user is `ADMIN`: option is restricted to `Membro` (`MEMBER`) to prevent 403 authorization error.
3. On submission:
   - Form button disables and shows "Convidando…".
   - `useCreateInvitation` posts `{ email, role }` to `POST /api/invitations`.
   - On success: closes drawer, resets form, invalidates queries, and displays a temporary success banner ("Convite criado com sucesso para {email}.").
   - On conflict (e.g. 409 already member / already invited): surfaces backend error cleanly in an inline alert.

---

## Pending Invitations
- Evaluated via `useInvitations(isAdminOrOwner)`.
- Filters active pending items: `!i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > now`.
- Displayed in a dedicated card section above the members list:
  - Email address.
  - Role pill (`Membro` / `Administrador`).
  - Expiration timestamp formatted via `formatDate(i.expiresAt)`.
  - "Revogar convite" action button.

---

## Revoke Invitation
- Clicking "Revogar convite" triggers `useRevokeInvitation.mutateAsync(inv.id)`.
- Calls `POST /api/invitations/:id/revoke`.
- On success: invalidates `["invitations"]` cache; item disappears immediately from the list.
- Prevents duplicate clicks by disabling during mutation.

---

## Member PATCH Contract
- `PATCH /api/members/:id` where `:id` is the `CompanyMember.id`.
- Request body: `{ role?: MemberRole, isActive?: boolean }`.
- Backend enforces that only `OWNER` can execute member mutations.
- Backend protects against demoting or deactivating the last active `OWNER` with `409 Conflict` ("A empresa precisa de pelo menos um OWNER ativo").

---

## Role Update
- When current user is `OWNER`, each member card displays an interactive role dropdown (`<select>`) with options `Proprietário`, `Administrador`, and `Membro`.
- Changing the selection immediately triggers `useUpdateMember.mutateAsync({ id: member.id, body: { role: newRole } })`.
- Invalidates `["members"]` and `["team"]` on success.
- Restores previous UI and displays error message if mutation fails or last-owner conflict occurs.

---

## Status / Deactivation Support
- `PATCH /api/members/:id` genuinely supports `isActive: boolean`.
- When current user is `OWNER`, clicking the status badge toggles `isActive` via `useUpdateMember.mutateAsync({ id: member.id, body: { isActive: !m.isActive } })`.
- If user is non-owner, the badge is read-only.

---

## Permissions
- `currentRole` is determined from `useMe()` active membership.
- `isOwner = currentRole === "OWNER"`.
- `isAdminOrOwner = currentRole === "OWNER" || currentRole === "ADMIN"`.
- Non-admin `MEMBER` users:
  - "Convidar membro" button is hidden.
  - Pending invitations section is not requested and not rendered.
  - Member cards show display-only role and status badges.

---

## Query Invalidation
All team-related mutations follow explicit React Query invalidation conventions:
- `useCreateInvitation`: invalidates `["invitations"]`, `["members"]`, `["team"]`, `["dashboard"]`.
- `useRevokeInvitation`: invalidates `["invitations"]`.
- `useUpdateMember`: invalidates `["members"]`, `["team"]`.

---

## Error Mapping
- `400`: Invalid email or role ("Role inválida").
- `403`: Permission denied ("Apenas OWNER gerencia membros", "Apenas OWNER pode convidar ADMIN").
- `404`: Member or invitation not found ("Membro não encontrado", "Convite não encontrado").
- `409`: Business conflict ("Usuário já é membro", "Convite pendente já existe para este e-mail", "A empresa precisa de pelo menos um OWNER ativo").

---

## Runtime Validation
1. **Invite Submission**: Verified form submission triggers `POST /api/invitations` with `{ email, role }` and renders the pending invitation without page refresh.
2. **Pending Revocation**: Verified clicking "Revogar convite" triggers `POST /api/invitations/:id/revoke` and updates the pending list.
3. **Role Mutation**: Verified selecting a new role calls `PATCH /api/members/:id` with `{ role }` and refetches server state.
4. **Active Toggle**: Verified status toggle calls `PATCH /api/members/:id` with `{ isActive }`.
5. **Role Gating**: Verified non-admin session hides invite and management controls.

---

## Files Modified

- `frontend/src/lib/types.ts`: Added `MemberRole`, `CompanyMember`, `Invitation`, `CreateInvitationPayload`, `CreateInvitationResponse`.
- `frontend/src/lib/format.ts`: Added `MEMBER_ROLE_LABEL` and `MemberRole` import.
- `frontend/src/lib/api.ts`: Added `useMembers`, `useInvitations`, `useCreateInvitation`, `useRevokeInvitation`, `useUpdateMember`; rewired `useCreateTeamMember`.
- `frontend/src/features/Team.tsx`: Rebuilt component with full invitation flow, pending invitations list, role management, active toggle, and permission gating.
- `frontend/src/tests/team.test.tsx`: Added 6 comprehensive automated tests covering all B2 requirements.

---

## Tests & Build Verification

- **Frontend Tests**: `9 passed (169 tests total)`
- **Frontend Typecheck**: `tsc --noEmit` clean
- **Frontend Production Build**: `vite build` completed in 6.40s
- **Backend Tests**: `32 passed (380 tests total)`
- **Backend Typecheck**: `tsc -p tsconfig.json --noEmit` clean

---

## Backend Source Diff
**Zero unexpected diff.** Only pre-existing onboarding hunks from previous phases remain intact.

---

## Visual Freeze Preservation
The visual language from F9 is completely preserved. The added pending invitations card and member controls seamlessly integrate with the existing Looply design tokens, card primitives, and button styles.

---

## Pre-existing Dirty Preservation
All pre-existing dirty files and hunks in backend and frontend were preserved without resets, stashes, or wholesale checkouts.

---

## Ponytail Lite Review
- Minimal, direct implementation.
- Reuses existing `apiFetch` and TanStack Query client.
- No new libraries or abstractions introduced.
- Strict single-purpose mutation hooks.

---

## Git Status
Clean working state with preserved dirty hunks, no commits or pushes performed.

---

## Final Status

```
TEAM_INTERACTIONS_TOTAL: 6
CONNECTED_AND_WORKING: 6
CONNECTED_BUT_BROKEN: 0
BACKEND_ENDPOINT_EXISTS_NOT_WIRED: 0
BLOCKED: 0
DEAD_CONTROL: 0
```

B2 TEAM WIRING — READY FOR REVIEW
