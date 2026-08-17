# Dev Report: Looply F12 Figma + Notion Frontend Reconciliation

**Status**: Complete
**Signoff Token**: `F12 FIGMA → RUNTIME RECONCILIATION — PASS`
**Date**: 2026-08-16
**Target Repository**: `/opt/looply` (branch: `main`)
**Scope**: Frontend Only (`backend/` diff = 0)

---

## 1. Product & Architecture Summary

This task reconciled the Looply frontend implementation with the canonical product definitions from Figma (`Looply — Brand + Product`, File key: `8JDixNLJNe1f3KVPRwEFBi`) and Notion requirements.

### Core Gates Addressed:
1. **Terminology Rebranding**:
   - Customer-facing UI renamed from "Jobs" to "Demandas" across Navbar, page titles, badges, activity feed, marketing preview, filters, and modal headers.
   - Internal API contracts, hooks, and types preserved as `Job` (`useUpdateJob`, `useJobActivity`, `/api/jobs/...`) to ensure zero backend breaking changes.
2. **Workspace & Identity Header**:
   - Obsolete fixed subtitle `"Fluxo de conteúdos"` replaced with dynamic company/workspace identity and fallback badge.
3. **Canonical Logout Contract**:
   - Top-right duplicate desktop logout button removed from `AppLayout`.
   - Logout is cleanly placed inside the lower-left account popover menu (desktop) and mobile account menu (`Sair do Looply`).
4. **Interactive Demandas ativas Counter & Client Demands Modal**:
   - Clients list now features an interactive count button (`1 demanda →`, `X demandas →`, `Nenhuma demanda`).
   - Clicking opens `ClientDemandsModal` (Desktop Modal / Mobile Bottom Sheet) displaying active demands with status pills, formats, and direct navigation links (`/contents/:id`).
   - "Abrir" action preserved to navigate directly to the full Client profile.
5. **Demandas List & Grouping**:
   - In `ContentsList`, client/company header is rendered once per group.
   - Child cards render title, stage, responsible, and due date.
   - Single "Desagrupar demandas" button provided for the entire group.
6. **Responsive Quick Edit Pattern (`ModalOrSheet`)**:
   - Unified responsive dialog container created at `frontend/src/components/ModalOrSheet.tsx`.
   - Renders centered accessible modal on desktop (`md:` breakpoint) and draggable bottom sheet on mobile.
   - Wired for:
     - Client Quick Edit (`Editar cliente`)
     - Team Member Quick Edit (`Editar membro`)
     - Demand Details Quick Edit (`Editar detalhes da demanda`)
     - Appointment Quick Edit (`Novo compromisso` / `Editar compromisso`)
     - Account Profile Modal (`Minha conta` opened from account menu)

---

## 2. File Level Changes

### Newly Created Components:
- `frontend/src/components/ModalOrSheet.tsx`: Responsive desktop centered modal & mobile bottom sheet with backdrop click, Escape key handling, and touch handle.
- `frontend/src/features/ClientDemandsModal.tsx`: Lists active client demands with status and quick navigation.
- `frontend/src/features/MyAccountModal.tsx`: Displays logged-in user profile, role, email, and clear read-only workspace notes.

### Updated Frontend Components:
- `frontend/src/components/Sidebar.tsx`: Reconciled navigation labels to "Demandas", dynamic workspace identity lockup, "Minha conta" trigger.
- `frontend/src/components/AppLayout.tsx`: Removed header duplicate logout, wired `MyAccountModal`.
- `frontend/src/components/AuthShell.tsx`: Reconciled marketing preview tabs and copy to "Demandas".
- `frontend/src/features/Clients.tsx`: Wired `ModalOrSheet` for edit/create/delete, interactive "Demandas ativas" counter, `ClientDemandsModal` integration.
- `frontend/src/features/ContentsList.tsx`: Reconciled headers to "Demandas", single company group header and single ungroup button.
- `frontend/src/features/ContentDetail.tsx`: Reconciled breadcrumbs, edit modal with `ModalOrSheet`, activity feed copy to "demanda".
- `frontend/src/features/Team.tsx`: Reconciled member edit, invite, and security modals to `ModalOrSheet`.
- `frontend/src/features/Calendar.tsx`: Reconciled appointment modal to `ModalOrSheet`, copy to "Demandas".
- `frontend/src/features/Dashboard.tsx`: Metric cards and attention feed updated to "Demandas ativas".
- `frontend/src/features/NewContent.tsx`: Page title and breadcrumbs updated to "Nova demanda".
- `frontend/src/features/Settings.tsx`: Clean copy reconciliation.

### Test Suite Updates:
- `frontend/src/tests/activity.test.tsx`
- `frontend/src/tests/clients.test.tsx`
- `frontend/src/tests/components.test.tsx`
- `frontend/src/tests/jobs.test.tsx`
- `frontend/src/tests/login.test.tsx`
- `frontend/src/tests/shell.test.tsx`

---

## 3. Test & Build Validation Results

### Backend Validation:
- Typecheck: **PASS** (`tsc -p tsconfig.json --noEmit`)
- Tests: **34 test files, 394 tests PASS** (0 failures)
- Backend diff: **0 files changed**

### Frontend Validation:
- Typecheck: **PASS** (`tsc --noEmit`)
- Tests: **15 test files, 200 tests PASS** (0 failures)
- Production Build: **PASS** (`dist/` built cleanly in 6.96s)
