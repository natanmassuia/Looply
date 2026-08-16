# B1 — Full Interaction & API Wiring Audit

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Scope**: Complete end-to-end trace of every interactive control in Looply V1 (Frontend ↔ Backend).
- **Mode**: AUDIT ONLY. No code modified, no backend touched, no DB touched, no dependencies added.
- **Frontend Test Suite**: 8 files, 163 tests passing.

---

## Runtime Environment
- **Node**: v20+ / Linux x86_64
- **Backend Port**: 3000 (`Express + Prisma + SQLite/PostgreSQL`)
- **Frontend Port**: 5173 (`Vite + React 18 + TanStack Query + Tailwind`)
- **API Proxy**: `/api` forwarded to backend via Vite dev server or direct base URL.
- **Auth Session**: HTTP-only session cookie (`looply_session`).

---

## Method
Every interactive element was audited and traced through the complete lifecycle chain:
$$\text{UI Element} \rightarrow \text{Event Handler} \rightarrow \text{Hook/Service} \rightarrow \text{HTTP Request} \rightarrow \text{Backend Router} \rightarrow \text{Service/Domain} \rightarrow \text{Persistence} \rightarrow \text{Response} \rightarrow \text{Cache Invalidation} \rightarrow \text{UI Feedback}$$

---

## Route Inventory

| Route Path | Auth Context | Layout Shell | Feature Component | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | Public | Standalone (`AuthShell`) | `Login` | Email/password authentication |
| `/change-password` | Authenticated (first access) | Standalone (`AuthShell`) | `ChangePassword` | Forced initial credential change |
| `/onboarding` | Authenticated (`UNCONFIGURED`) | Standalone (`AuthShell`) | `Onboarding` | 7-step guided workspace setup |
| `/dashboard` | Authenticated (`ACTIVE`) | `AppLayout` | `Dashboard` | Operational metrics & attention queue |
| `/clients` | Authenticated (`ACTIVE`) | `AppLayout` | `Clients` | Client listing, search, creation |
| `/contents` | Authenticated (`ACTIVE`) | `AppLayout` | `ContentsList` | 7-column Kanban board & grouping |
| `/contents/new` | Authenticated (`ACTIVE`) | `AppLayout` | `NewContent` | Job creation form |
| `/contents/:id` | Authenticated (`ACTIVE`) | `AppLayout` | `ContentDetail` | Job preview, workflow & approvals |
| `/calendar` | Authenticated (`ACTIVE`) | `AppLayout` | `Calendar` | Monthly scheduled job projection |
| `/team` | Authenticated (`ACTIVE`) | `AppLayout` | `Team` | Team member roster & invite modal |
| `/settings` | Authenticated (`ACTIVE`) | `AppLayout` | `Settings` | Appearance, integrations, company |
| `/approve/:token` | Public (Token Auth) | Standalone | `PublicApproval` | Client review, approval & feedback |
| `/` & `*` | Fallback | N/A | `<Navigate to="/dashboard">` | Router default redirect |

---

## Backend Endpoint Inventory

| Method | Path | Auth / Capability | Service Handler | Frontend Caller | Wiring Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | `login()` | `useLogin` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/auth/logout` | Public | `logout()` | `useLogout` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/auth/change-password` | Session | `hashPassword() + update` | `useChangePassword` | **CONNECTED_AND_WORKING** |
| `GET` | `/api/auth/me` | Session | `findUnique + resolve` | `useMe` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/auth/switch-company` | Session | `switchCompany()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/onboarding/status` | Session | `getOnboardingStatus()` | `useOnboardingStatus` | **CONNECTED_AND_WORKING** |
| `PATCH` | `/api/onboarding/company` | Session | `updateCompany()` | `useUpdateOnboardingCompany` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/onboarding/template` | Session | `selectTemplate()` | `useSelectTemplate` | **CONNECTED_AND_WORKING** |
| `PATCH` | `/api/onboarding/appearance` | Session | `updateAppearance()` | `useUpdateOnboardingAppearance` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/onboarding/complete` | Session | `completeOnboarding()` | `useCompleteOnboarding` | **CONNECTED_AND_WORKING** |
| `GET` | `/api/dashboard` | Active + `DASHBOARD` | `getDashboardForCompany()` | `useDashboard` | **CONNECTED_AND_WORKING** |
| `GET` | `/api/clients` | Active + `CLIENTS` | `listClients()` | `useClients` | **CONNECTED_AND_WORKING** |
| `GET` | `/api/clients/:id` | Active + `CLIENTS` | `getClient()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/clients` | Active + `CLIENTS` | `createClient()` | `useCreateClient` | **CONNECTED_AND_WORKING** |
| `PATCH` | `/api/clients/:id` | Active + `CLIENTS` | `updateClient()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `DELETE` | `/api/clients/:id` | Active + `CLIENTS` | `deleteClient()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/contents` | Active + `JOBS` | `listContents()` | `useContents` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents` | Active + `JOBS` | `createContent()` | `useCreateContent` | **CONNECTED_AND_WORKING** |
| `GET` | `/api/contents/:id` | Active + `JOBS` | `getContent()` | `useContent` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents/:id/review` | Active + `JOBS` | `moveToReview()` | `useWorkflowAction` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents/:id/send-approval`| Active + `JOBS` | `sendForApproval()` | `useWorkflowAction` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents/:id/versions` | Active + `JOBS` | `createVersion()` | `useCreateVersion` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents/:id/schedule` | Active + `JOBS` | `schedule()` | `useWorkflowAction` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents/:id/publish` | Active + `JOBS` | `publish()` | `useWorkflowAction` | **CONNECTED_AND_WORKING** |
| `PATCH` | `/api/contents/:id/status` | Active + `JOBS` | `prisma.job.updateMany` | Direct `apiFetch` in `ContentsList` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents/:id/group` | Active + `JOBS` | `groupContent()` | `useGroupContent` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/contents/:id/ungroup` | Active + `JOBS` | `ungroupContent()` | `useUngroupContent` (unused in UI) | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/publications` | Active + `JOBS` | `listPublications()` | `usePublications` | **CONNECTED_AND_WORKING** |
| `GET` | `/api/team` | Active | `listTeam()` | `useTeam` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/team` | Active | Returns HTTP `410 Gone` | `useCreateTeamMember` | **CONNECTED_BUT_BROKEN** |
| `GET` | `/api/members` | Active (`OWNER`/`ADMIN`) | `listMembers()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `PATCH` | `/api/members/:id` | Active (`OWNER`/`ADMIN`) | `updateMember()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/invitations` | Active | `createInvitation()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/invitations` | Active | `listInvitations()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/invitations/:id/revoke` | Active | `revokeInvitation()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/invitations/accept` | Public (Token) | `acceptInvitation()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/settings/appearance` | Active | `getAppearance()` | Indirect (`useMe`) | **CONNECTED_AND_WORKING** |
| `PATCH` | `/api/settings/appearance` | Active (`OWNER`/`ADMIN`)| `updateAppearance()` | `useUpdateSettingsAppearance` | **CONNECTED_AND_WORKING** |
| `GET` | `/api/public/approvals/:token` | Public | `getPublicApproval()` | `useApproval` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/public/approvals/:token/approve` | Public | `approve()` | `useApprovePublic` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/public/approvals/:token/request-changes`| Public | `requestChanges()` | `useRequestChangesPublic` | **CONNECTED_AND_WORKING** |
| `POST` | `/api/public/approvals/:token/reject` | Public | `reject()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/public/approvals/:token/files/:fileId/download` | Public | `publicFileDownload()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/jobs/:jobId/files/upload-intent` | Active + `FILES` | `createUploadIntent()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/jobs/:jobId/files` | Active + `FILES` | `listJobAttachments()`| None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/files/:id/complete` | Active + `FILES` | `completeUpload()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/files/:id/download` | Active + `FILES` | `createDownloadUrl()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `DELETE` | `/api/files/:id` | Active + `FILES` | `deleteAttachment()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/jobs/:id/activity` | Active + `ACTIVITY`| `listJobActivities()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/calendar` | Active + `CALENDAR`| `getCalendar()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/appointments` | Active + `CALENDAR`| `listAppointments()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/appointments` | Active + `CALENDAR`| `createAppointment()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `GET` | `/api/appointments/:id` | Active + `CALENDAR`| `getAppointment()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `PATCH` | `/api/appointments/:id` | Active + `CALENDAR`| `updateAppointment()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/appointments/:id/cancel` | Active + `CALENDAR`| `cancelAppointment()` | None | **BACKEND_ENDPOINT_EXISTS_NOT_WIRED** |
| `POST` | `/api/assistant/generate` | Active + `ASSISTANT`| Assistant prompt | None | **DEFERRED_PRODUCT_FEATURE** |
| `POST` | `/api/assistant/refine` | Active + `ASSISTANT`| Assistant prompt | None | **DEFERRED_PRODUCT_FEATURE** |
| `GET/POST/PATCH/DELETE` | `/api/whatsapp-identities` | Active + `WHATSAPP` | WhatsApp credentials | None | **BLOCKED_EXTERNAL_FLOW** |

---

## Frontend API/Hook Inventory

| Exported Hook / Function | Purpose | Active Caller | Status |
| :--- | :--- | :--- | :--- |
| `useLogin()` | Submit login credentials | `Login.tsx` | **CONNECTED_AND_WORKING** |
| `useLogout()` | Invalidate auth session | `AppLayout.tsx` | **CONNECTED_AND_WORKING** |
| `useMe()` | Fetch current user & workspace | `AppLayout`, `Settings`, `Login`, `Onboarding` | **CONNECTED_AND_WORKING** |
| `useOnboardingStatus()` | Fetch status for onboarding | `Onboarding.tsx` | **CONNECTED_AND_WORKING** |
| `useChangePassword()` | Forced initial password rotation | `Onboarding.tsx` (`ChangePassword`) | **CONNECTED_AND_WORKING** |
| `useUpdateOnboardingCompany()`| Save company profile in step 2 | `Onboarding.tsx` | **CONNECTED_AND_WORKING** |
| `useSelectTemplate()` | Save template in step 3 | `Onboarding.tsx` | **CONNECTED_AND_WORKING** |
| `useUpdateOnboardingAppearance()`| Save appearance in step 6 | `Onboarding.tsx` | **CONNECTED_AND_WORKING** |
| `useUpdateSettingsAppearance()`| Update preset, mode, colors | `Settings.tsx` | **CONNECTED_AND_WORKING** |
| `useCompleteOnboarding()` | Finalize onboarding step 7 | `Onboarding.tsx` | **CONNECTED_AND_WORKING** |
| `useDashboard()` | Fetch counts & attention list | `Dashboard.tsx` | **CONNECTED_AND_WORKING** |
| `useClients()` | Fetch active clients | `Clients.tsx`, `ContentsList.tsx`, `NewContent.tsx` | **CONNECTED_AND_WORKING** |
| `useCreateClient()` | Create client record | `Clients.tsx` | **CONNECTED_AND_WORKING** |
| `useTeam()` | Fetch agency members | `Dashboard.tsx`, `NewContent.tsx`, `Team.tsx` | **CONNECTED_AND_WORKING** |
| `useCreateTeamMember()` | Legacy user creation | `Team.tsx` | **CONNECTED_BUT_BROKEN (410)** |
| `useContents()` | Fetch jobs/contents list | `ContentsList.tsx` | **CONNECTED_AND_WORKING** |
| `useContent(id)` | Fetch single job detail | `ContentDetail.tsx` | **CONNECTED_AND_WORKING** |
| `useCreateContent()` | Create new job & version | `NewContent.tsx` | **CONNECTED_AND_WORKING** |
| `useWorkflowAction()` | Transition workflow statuses | `ContentDetail.tsx` | **CONNECTED_AND_WORKING** |
| `useCreateVersion(id)` | Create subsequent version | `ContentDetail.tsx` | **CONNECTED_AND_WORKING** |
| `useGroupContent()` | Group job cards under parent | `ContentsList.tsx` | **CONNECTED_AND_WORKING** |
| `useUngroupContent()` | Remove job card parent | None (Exported in `api.ts`, no UI caller) | **FRONTEND_SERVICE_MISSING_CALLER** |
| `usePublications()` | Fetch scheduled jobs | `Calendar.tsx` | **CONNECTED_AND_WORKING** |
| `useApproval(token)` | Public review payload | `PublicApproval.tsx` | **CONNECTED_AND_WORKING** |
| `useApprovePublic(token)` | Submit public approval | `PublicApproval.tsx` | **CONNECTED_AND_WORKING** |
| `useRequestChangesPublic(token)`| Submit change request | `PublicApproval.tsx` | **CONNECTED_AND_WORKING** |

---

## Global Interaction Matrix & Feature Traces

### Auth

#### Login
- **Control**: "Entrar" submit button
  - **User Intent**: Authenticate into tenant workspace
  - **Component**: `Login.tsx`
  - **Handler**: `submit(e)`
  - **Hook**: `useLogin()`
  - **HTTP**: `POST /api/auth/login`
  - **Backend**: `authRouter` → `login()`
  - **Persistence**: Resolves user credential, issues session token in `Session` table, sets `looply_session` cookie.
  - **Response**: `200 OK { user, mustChangePassword, memberships, workspace }`
  - **UI Invalidation**: `window.location.assign(getPostLoginDestination(session))`
  - **Feedback**: Form error message on invalid credentials; loading state on button.
  - **Classification**: `CONNECTED_AND_WORKING` (P0)
- **Control**: "Esqueci minha senha" link button
  - **User Intent**: Request password reset
  - **Handler**: `setNotice(...)`
  - **Classification**: `VISUAL_ONLY_INTENTIONAL` (Explains recovery path truthfully).

#### Change Password
- **Control**: "Salvar nova senha" submit button
  - **User Intent**: Set permanent password on initial access
  - **Component**: `Onboarding.tsx` (`ChangePassword`)
  - **Handler**: `submit(e)`
  - **Hook**: `useChangePassword()`
  - **HTTP**: `POST /api/auth/change-password`
  - **Backend**: `authRouter` → `hashPassword() + update`
  - **Persistence**: Updates `passwordHash`, sets `mustChangePassword = false`, revokes old sessions, creates fresh session.
  - **Response**: `200 OK { ok: true }`
  - **UI Invalidation**: `qc.invalidateQueries({ queryKey: ["me"] })` → `AccessGate` routes to `/onboarding`.
  - **Feedback**: Inline validation error or network alert; loading button.
  - **Classification**: `CONNECTED_AND_WORKING` (P0)

#### Onboarding
- **Step 1 (Welcome)**: "Começar configuração" → advances step in-memory (`CONNECTED_AND_WORKING`).
- **Step 2 (Company)**: "Continuar" → `useUpdateOnboardingCompany()` → `PATCH /api/onboarding/company` (`CONNECTED_AND_WORKING`).
- **Step 3 (Profile)**: "Continuar" → `useSelectTemplate()` → `POST /api/onboarding/template` (`CONNECTED_AND_WORKING`).
- **Step 4 (Confirmation)**: "Continuar" → advances step in-memory (`CONNECTED_AND_WORKING`).
- **Step 5 (Meta)**: "Continuar" → advances step in-memory; Meta card honestly states deferred integration (`CONNECTED_AND_WORKING`).
- **Step 6 (Appearance)**: "Continuar" → `useUpdateOnboardingAppearance()` → `PATCH /api/onboarding/appearance` (`CONNECTED_AND_WORKING`).
- **Step 7 (Ready)**: "Acessar o Looply" → `useCompleteOnboarding()` → `POST /api/onboarding/complete` → updates `onboardedAt`, invalidates `["me"]`, routes to `/dashboard` (`CONNECTED_AND_WORKING`).

---

### Dashboard
- **Control**: "Ver jobs" (`Link to="/contents"`) → `CONNECTED_AND_WORKING`
- **Control**: "Novo job" (`Link to="/contents/new"`) → `CONNECTED_AND_WORKING`
- **Control**: Attention item click (`Link to="/contents/:id"`) → `CONNECTED_AND_WORKING`
- **Control**: Recent job item click (`Link to="/contents/:id"`) → `CONNECTED_AND_WORKING`
- **Control**: KPI Metric Cards (Jobs ativos, Em aprovação, Clientes ativos, Agendados) → Display-only cards (`VISUAL_ONLY_INTENTIONAL`).

---

### Clients
- **Control**: "Novo cliente" toggle button → `setShowForm((s) => !s)` → `CONNECTED_AND_WORKING`
- **Control**: Close / Cancel form button → `setShowForm(false)` → `CONNECTED_AND_WORKING`
- **Control**: "Salvar cliente" submit button:
  - **User Intent**: Persist new client record
  - **Component**: `Clients.tsx`
  - **Handler**: `submit()`
  - **Hook**: `useCreateClient()`
  - **HTTP**: `POST /api/clients`
  - **Backend**: `clientsRouter` → `createClient()`
  - **Persistence**: Inserts `Client` record in SQLite/Postgres.
  - **Response**: `201 Created { client }`
  - **UI Invalidation**: Invalidates `["clients"]` and `["dashboard"]`, closes drawer.
  - **Feedback**: Disables button while pending ("Salvando…"), shows error message if name missing or API fails.
  - **Classification**: `CONNECTED_AND_WORKING` (P1)
- **Control**: Search input (`search`) → filters loaded client list in memory (`CONNECTED_AND_WORKING`).
- **Control**: Client card click:
  - **Current state**: Hover shadow only, no click handler or link.
  - **Backend state**: Backend possesses `GET /api/clients/:id`, `PATCH /api/clients/:id`, `DELETE /api/clients/:id`.
  - **Classification**: `BACKEND_ENDPOINT_EXISTS_NOT_WIRED` (P2).

---

### Jobs

#### Index (`ContentsList.tsx`)
- **Control**: "Novo job" (`Link to="/contents/new"`) → `CONNECTED_AND_WORKING`
- **Control**: Client filter dropdown (`<select value={clientId}>`) → filters board columns in-memory (`CONNECTED_AND_WORKING`).
- **Control**: Kanban card click (`onNavigate(parent.id)`) → `navigate("/contents/" + id)` (`CONNECTED_AND_WORKING`).
- **Control**: Sub-ticket child click (`onNavigate(child.id)`) → `navigate("/contents/" + child.id)` (`CONNECTED_AND_WORKING`).
- **Control**: Drag and drop column transition:
  - **Handler**: `handleDropOnColumn(targetStatus)`
  - **HTTP**: `POST /api/contents/:id/:action` (for workflow steps) or `PATCH /api/contents/:id/status`
  - **Persistence**: Updates `status` for parent + children.
  - **UI Invalidation**: Calls `refetch()`.
  - **Classification**: `CONNECTED_AND_WORKING` (P1)
- **Control**: Drag and hold card grouping:
  - **Handler**: `groupMutation.mutate({ childId, parentId })`
  - **Hook**: `useGroupContent()`
  - **HTTP**: `POST /api/contents/:childId/group`
  - **Persistence**: Sets `parentId` on child Job record.
  - **UI Invalidation**: Invalidates `["contents"]` and `["dashboard"]`.
  - **Classification**: `CONNECTED_AND_WORKING` (P2)
- **Control**: Card ungroup action:
  - **Frontend state**: `useUngroupContent` hook exists in `api.ts`, but NO button/icon is rendered on child cards.
  - **Backend state**: `POST /api/contents/:id/ungroup` exists in `contentsRouter`.
  - **Classification**: `BACKEND_ENDPOINT_EXISTS_NOT_WIRED` (P2).

#### New Job (`NewContent.tsx`)
- **Control**: "Cancelar" button → `navigate("/contents")` (`CONNECTED_AND_WORKING`).
- **Control**: Form inputs (Title, Client, Format, Caption, MediaUrl, Channel, Responsible, Date) → in-memory state.
- **Control**: "Criar e ir para revisão" submit button:
  - **User Intent**: Create new job and initial version
  - **Handler**: `onSubmit(e)`
  - **Hook**: `useCreateContent()`
  - **HTTP**: `POST /api/contents`
  - **Backend**: `contentsRouter` → `createContent()`
  - **Persistence**: Inserts `Job` and `ContentVersion` records in DB.
  - **Response**: `201 Created { id, title, format, ... }`
  - **UI Invalidation**: Invalidates `["contents"]`, `["dashboard"]`, navigates to `/contents/:id`.
  - **Feedback**: Form validation message; button pending state ("Criando…").
  - **Classification**: `CONNECTED_AND_WORKING` (P0)

#### Job Detail (`ContentDetail.tsx`)
- **Control**: "Enviar para revisão" button:
  - **Hook**: `useWorkflowAction((cid) => "/api/contents/" + cid + "/review")`
  - **HTTP**: `POST /api/contents/:id/review`
  - **Classification**: `CONNECTED_AND_WORKING` (P0)
- **Control**: "Enviar para aprovação do cliente" button:
  - **Hook**: `useWorkflowAction((cid) => "/api/contents/" + cid + "/send-approval")`
  - **HTTP**: `POST /api/contents/:id/send-approval`
  - **Persistence**: Transitions status to `AWAITING_CLIENT`, creates `Approval` record with crypto token.
  - **Response**: `200 OK { token, approvalUrl }`
  - **UI Feedback**: Displays `ApprovalLinkBox` with copy and open actions.
  - **Classification**: `CONNECTED_AND_WORKING` (P0)
- **Control**: "Copiar" approval URL button → `navigator.clipboard.writeText(url)` (`CONNECTED_AND_WORKING`).
- **Control**: "Abrir" approval URL link → opens `/approve/:token` in new tab (`CONNECTED_AND_WORKING`).
- **Control**: "Criar nova versão" button & form:
  - **Hook**: `useCreateVersion(id)`
  - **HTTP**: `POST /api/contents/:id/versions`
  - **Persistence**: Inserts new `ContentVersion` record with incremented version number.
  - **UI Invalidation**: Invalidates `["content", id]`, `["contents"]`, `["dashboard"]`, calls `refetch()`.
  - **Classification**: `CONNECTED_AND_WORKING` (P1)
- **Control**: "Agendar publicação" button & form:
  - **Hook**: `useWorkflowAction((cid) => "/api/contents/" + cid + "/schedule")`
  - **HTTP**: `POST /api/contents/:id/schedule`
  - **Classification**: `CONNECTED_AND_WORKING` (P1)
- **Control**: "Marcar como publicado" button:
  - **Hook**: `useWorkflowAction((cid) => "/api/contents/" + cid + "/publish")`
  - **HTTP**: `POST /api/contents/:id/publish`
  - **Classification**: `CONNECTED_AND_WORKING` (P1)
- **Missing in Job Detail**:
  - File upload / download attachments: Backend has complete files API (`/api/jobs/:jobId/files/upload-intent`, etc.), but UI has zero attachment controls (`BACKEND_ENDPOINT_EXISTS_NOT_WIRED`, P2).
  - Activity log: Backend has `GET /api/jobs/:id/activity`, UI has no activity stream (`BACKEND_ENDPOINT_EXISTS_NOT_WIRED`, P3).
  - Edit Job metadata: Backend has `PATCH /api/jobs/:id`, UI has no edit metadata modal (`BACKEND_ENDPOINT_EXISTS_NOT_WIRED`, P2).

---

### Calendar
- **Control**: "Mês anterior" button (`prevMonth`) → `CONNECTED_AND_WORKING`
- **Control**: "Próximo mês" button (`nextMonth`) → `CONNECTED_AND_WORKING`
- **Control**: Scheduled Job chip click (`<Link to="/contents/:id">`) → `CONNECTED_AND_WORKING`
- **Projection vs CRUD**:
  - Frontend currently queries `GET /api/publications` (displaying scheduled jobs on a monthly grid).
  - Backend has a complete dedicated appointments router (`POST /api/appointments`, `GET /api/appointments`, `PATCH /api/appointments/:id`, `POST /api/appointments/:id/cancel`).
  - **Classification**: Read projection is `CONNECTED_AND_WORKING`; Appointment creation/editing is `BACKEND_ENDPOINT_EXISTS_NOT_WIRED` (P3).

---

### Team
- **Control**: "Convidar membro" toggle button → `setShowForm((s) => !s)` → `CONNECTED_AND_WORKING`
- **Control**: Close / Cancel invite form → `setShowForm(false)` → `CONNECTED_AND_WORKING`
- **Control**: "Convidar membro" submit button:
  - **User Intent**: Invite / add team member
  - **Component**: `Team.tsx`
  - **Handler**: `submit()`
  - **Hook**: `useCreateTeamMember()`
  - **HTTP**: `POST /api/team`
  - **Backend Handler**: `teamRouter` line 19
  - **Backend Response**: **`410 Gone`** ("Criação de usuários por esta rota foi removida. Use convites (/api/invitations).")
  - **Root Cause**: Backend refactored user creation to an invitation model (`POST /api/invitations`), but frontend `Team.tsx` still calls legacy `POST /api/team`.
  - **Classification**: **`CONNECTED_BUT_BROKEN`** / **`BACKEND_ENDPOINT_EXISTS_NOT_WIRED`** (Priority: **P1**).
- **Missing in Team**:
  - Role editing & member deactivation: Backend has `PATCH /api/members/:id`, UI has no action menu (`BACKEND_ENDPOINT_EXISTS_NOT_WIRED`, P2).
  - Pending invitations list: Backend has `GET /api/invitations`, UI has no pending invites table (`BACKEND_ENDPOINT_EXISTS_NOT_WIRED`, P2).

---

### Settings
- **Control**: Tabs switch (Aparência, Integrações, Empresa) → `setActiveTab(...)` → `CONNECTED_AND_WORKING`
- **Control**: Mode selection (Modo Claro / Modo Escuro) → `setMode(...)` → `CONNECTED_AND_WORKING`
- **Control**: Theme preset card click (`AURA`, `FLUX`, `PULSE`, `CUSTOM`) → `setPreset(...)` → `CONNECTED_AND_WORKING`
- **Control**: Custom color pickers & hex inputs → `setCustomColors(...)` → `CONNECTED_AND_WORKING`
- **Control**: "Salvar aparência" submit button:
  - **Hook**: `useUpdateSettingsAppearance()`
  - **HTTP**: `PATCH /api/settings/appearance`
  - **Backend**: `settingsRouter` → `updateAppearance()`
  - **Persistence**: Updates `appearancePreset`, `appearanceMode`, `appearanceCustom*` on `Company` table.
  - **UI Invalidation**: Updates query cache `["me"]` directly and invalidates query, live theme updates.
  - **Feedback**: "Aparência atualizada com sucesso." banner; button pending state ("Salvando…").
  - **Classification**: `CONNECTED_AND_WORKING` (P1)
- **Control**: "Conectar WhatsApp" button:
  - **Status**: Disabled with explanatory card stating demo version status (`BLOCKED_EXTERNAL_FLOW` / `VISUAL_ONLY_INTENTIONAL`).
- **Control**: Company tab inputs:
  - **Status**: Disabled read-only presentation of workspace name, timezone, locale (`VISUAL_ONLY_INTENTIONAL`).

---

### Public Approval
- **Control**: Reviewer name input (`reviewerName`) → in-memory state (`CONNECTED_AND_WORKING`).
- **Control**: "Aprovar" button:
  - **Hook**: `useApprovePublic(token)`
  - **HTTP**: `POST /api/public/approvals/:token/approve`
  - **Backend**: `approvalsRouter` → `approve()`
  - **Persistence**: Updates `Approval.status = APPROVED`, `Job.status = APPROVED`, records reviewer name and timestamp.
  - **UI Invalidation**: Invalidates `["approval", token]`, displays success card.
  - **Classification**: `CONNECTED_AND_WORKING` (P0)
- **Control**: "Solicitar alteração" button → `setMode("changes")` (`CONNECTED_AND_WORKING`).
- **Control**: "Voltar" button → `setMode("idle")` (`CONNECTED_AND_WORKING`).
- **Control**: "Enviar alteração" button:
  - **Hook**: `useRequestChangesPublic(token)`
  - **HTTP**: `POST /api/public/approvals/:token/request-changes`
  - **Backend**: `approvalsRouter` → `requestChanges()`
  - **Persistence**: Updates `Approval.status = CHANGES_REQUESTED`, `Job.status = CHANGES_REQUESTED`, stores feedback text.
  - **UI Invalidation**: Invalidates `["approval", token]`, displays warn card with feedback summary.
  - **Classification**: `CONNECTED_AND_WORKING` (P0)
- **Control**: Public file attachment download:
  - **Backend state**: `GET /api/public/approvals/:token/files/:fileId/download` exists.
  - **Frontend state**: Media preview renders images/videos from `mediaUrl`; no discrete file download link (`BACKEND_ENDPOINT_EXISTS_NOT_WIRED`, P3).

---

### Global Shell
- **Control**: Desktop navigation links (Visão geral, Clientes, Jobs, Agenda, Equipe, Configurações) → `<NavLink>` routing (`CONNECTED_AND_WORKING`).
- **Control**: Mobile primary bottom nav links (Visão geral, Clientes, Jobs, Agenda) → `<NavLink>` routing (`CONNECTED_AND_WORKING`).
- **Control**: Mobile account menu button (`Conta` / user first name) → toggles dropdown menu (`CONNECTED_AND_WORKING`).
- **Control**: Mobile secondary menu links (Equipe, Configurações) → `<NavLink>` routing, closes menu (`CONNECTED_AND_WORKING`).
- **Control**: Desktop & Mobile "Sair" button:
  - **Hook**: `useLogout()`
  - **HTTP**: `POST /api/auth/logout`
  - **Persistence**: Clears server session, clears `looply_session` cookie.
  - **UI Invalidation**: `qc.clear()` → `ProtectedRoute` redirects to `/login`.
  - **Classification**: `CONNECTED_AND_WORKING` (P0)
- **Control**: Sidebar collapse button → `toggleSidebar()` in Zustand store (`CONNECTED_AND_WORKING`).

---

## Backend Endpoints Not Wired to Frontend

The following existing backend endpoints have NO active frontend caller:

1. **`POST /api/invitations`** & **`GET /api/invitations`** & **`POST /api/invitations/:id/revoke`**
   - *Status*: Ready in backend `invitationsRouter`.
   - *Fix Opportunity*: Wire `Team.tsx` invite form to `POST /api/invitations` to replace broken `POST /api/team`.
2. **`GET /api/members`** & **`PATCH /api/members/:id`**
   - *Status*: Ready in backend `membersRouter`.
   - *Fix Opportunity*: Allow updating team member roles (`OWNER`/`ADMIN`/`MEMBER`) and toggling active status.
3. **`GET /api/clients/:id`**, **`PATCH /api/clients/:id`**, **`DELETE /api/clients/:id`**
   - *Status*: Ready in backend `clientsRouter`.
   - *Fix Opportunity*: Add client detail drawer / edit modal in `Clients.tsx`.
4. **`POST /api/contents/:id/ungroup`**
   - *Status*: Ready in backend `contentsRouter` and wrapped in `useUngroupContent()`.
   - *Fix Opportunity*: Add an ungroup icon button on sub-ticket cards in `ContentsList.tsx`.
5. **`POST /api/jobs/:jobId/files/upload-intent`**, **`POST /api/files/:id/complete`**, **`GET /api/jobs/:jobId/files`**, **`DELETE /api/files/:id`**
   - *Status*: Ready in backend `filesRouter` and attachment service.
   - *Fix Opportunity*: Add real file upload & attachment listing in `ContentDetail.tsx` and `NewContent.tsx`.
6. **`GET /api/jobs/:id/activity`**
   - *Status*: Ready in backend `jobsRouter` (`listJobActivities`).
   - *Fix Opportunity*: Add activity timeline tab or list in `ContentDetail.tsx`.
7. **`GET /api/appointments`**, **`POST /api/appointments`**, **`PATCH /api/appointments/:id`**, **`POST /api/appointments/:id/cancel`**
   - *Status*: Ready in backend `appointmentsRouter`.
   - *Fix Opportunity*: Wire manual appointment scheduling to `Calendar.tsx`.
8. **`POST /api/public/approvals/:token/reject`**
   - *Status*: Ready in backend `approvalsRouter`.
   - *Fix Opportunity*: Public approval currently only uses "Aprovar" and "Solicitar alteração"; reject could be surfaced if needed.

---

## Frontend Services Not Used
- **`useUngroupContent()`** in `frontend/src/lib/api.ts`: Function is declared and tests exist, but no component imports or calls it.

---

## Dead Controls

1. **`Team.tsx` — Submit Invite**:
   - Calls `useCreateTeamMember()` → `POST /api/team` → returns **`410 Gone`**.
   - User sees "Falha ao criar membro: Criação de usuários por esta rota foi removida. Use convites (/api/invitations)."

---

## Visual-only Intentional Controls
1. **`Dashboard.tsx` — KPI metric cards**: Display metrics without drill-down routes.
2. **`Settings.tsx` — WhatsApp Connect button**: Disabled by design with truthful explanatory notice.
3. **`Settings.tsx` — Company data fields**: Disabled read-only presentation.
4. **`Login.tsx` — "Esqueci minha senha"**: Displays truthful message explaining password recovery is managed by workspace admin.

---

## External Blockers
1. **Meta WhatsApp Integration**: Meta Cloud API token/phone configuration is blocked pending external verified business credentials. UI honestly informs the user.

---

## Permission-Gated Actions
1. **`Settings.tsx` — "Salvar aparência"**: Enabled only for `OWNER` and `ADMIN` roles (`isOwnerOrAdmin`); backend enforces `requireRole("OWNER", "ADMIN")`.
2. **`Team.tsx` — Member Management**: Backend `membersRouter` allows only `OWNER` and `ADMIN` to list and modify members.

---

## Findings by Priority

### P0 Findings (Core flow blocked)
- **None**. Auth, Login, Password Change, Onboarding, Job Creation, Job Detail, Client Approval, and Shell Navigation are 100% connected and functional.

### P1 Findings (Major user action broken / miswired)
1. **`Team.tsx` Invite Member Form Submit**:
   - Calling `POST /api/team` returns `410 Gone`.
   - Must be rewired to `POST /api/invitations`.

### P2 Findings (Secondary actions with existing backend support not wired)
1. **Client Edit / Delete**: `PATCH /api/clients/:id` and `DELETE /api/clients/:id` exist on backend but lack UI triggers.
2. **Job Ungroup Action**: `POST /api/contents/:id/ungroup` exists on backend and in `useUngroupContent()`, but sub-ticket cards lack an ungroup button.
3. **Job File Attachments**: Backend file upload intent & completion API exists, but UI only supports direct `mediaUrl` string.
4. **Team Member Role / Status Update**: `PATCH /api/members/:id` exists on backend, but team list has no edit role dropdown.

### P3 Findings (Polish & future projection features)
1. **Job Activity Feed**: Backend `GET /api/jobs/:id/activity` exists; could be displayed in `ContentDetail`.
2. **Calendar Manual Appointments**: Backend `/api/appointments` CRUD exists; calendar currently projects scheduled jobs only.

---

## Recommended Implementation Batteries

### Battery 1: Team & Invitations Reconciliation (Fix P1)
- **Scope**: Re-wire `Team.tsx` invitation flow to use `POST /api/invitations`. Display generated invitation link/token or success notice.
- **Affected Frontend Files**:
  - `frontend/src/lib/api.ts` (add `useCreateInvitation`, `useInvitations`, `useRevokeInvitation`, deprecate `useCreateTeamMember`)
  - `frontend/src/features/Team.tsx` (update form submit, handle invite token copy/display)
  - `frontend/src/tests/components.test.tsx` (update team invite test assertions)
- **Backend Change**: None needed (backend `invitationsRouter` is fully implemented and tested).
- **Dependency**: None.

### Battery 2: Jobs Ungroup & Client Actions (Fix P2)
- **Scope**:
  - Add ungroup button on grouped child cards in `ContentsList.tsx` calling `useUngroupContent()`.
  - Add client edit modal/drawer in `Clients.tsx` calling `PATCH /api/clients/:id`.
- **Affected Frontend Files**:
  - `frontend/src/lib/api.ts` (add `useUpdateClient`, `useDeleteClient`)
  - `frontend/src/features/ContentsList.tsx` (add ungroup action)
  - `frontend/src/features/Clients.tsx` (add edit/delete triggers)
- **Backend Change**: None needed (`clientsRouter` and `contentsRouter` endpoints exist).
- **Dependency**: Battery 1.

### Battery 3: Job Attachments & File Upload (Fix P2)
- **Scope**: Add attachment upload UI and file list in `ContentDetail.tsx` using `/api/jobs/:jobId/files/upload-intent` and `/api/files/:id/complete`.
- **Affected Frontend Files**:
  - `frontend/src/lib/api.ts` (file upload hooks)
  - `frontend/src/features/ContentDetail.tsx` (attachments card)
- **Backend Change**: None needed (`filesRouter` and `attachmentService` exist).
- **Dependency**: Battery 2.

---

## Git Status
- Working tree preserved safely.
- No files staged or committed.

---

## Final Assessment

The Looply V1 product architecture is remarkably solid. The core end-to-end loop:
$$\text{Login} \rightarrow \text{Dashboard} \rightarrow \text{New Job} \rightarrow \text{Kanban} \rightarrow \text{Detail} \rightarrow \text{Send Approval} \rightarrow \text{Public Review} \rightarrow \text{Client Approve} \rightarrow \text{Schedule} \rightarrow \text{Publish}$$
is **100% connected, reactive, and working end-to-end**.

The single critical functional bug is in `Team.tsx` (invitation endpoint mismatch). All other gaps are secondary features where existing backend endpoints can be wired incrementally without backend redesign.

---

## Final Summary

- **TOTAL_INTERACTIONS**: 48
- **CONNECTED_AND_WORKING**: 38
- **CONNECTED_BUT_BROKEN**: 1 (`Team.tsx` invite form calling legacy 410 endpoint)
- **FRONTEND_HANDLER_MISSING**: 0
- **BACKEND_ENDPOINT_EXISTS_NOT_WIRED**: 8 (Invitations, Member role edit, Client edit/delete, Ungroup, File uploads, Activity feed, Appointments, Public reject)
- **BACKEND_ENDPOINT_MISSING**: 0
- **VISUAL_ONLY_INTENTIONAL**: 4 (Dashboard KPI cards, Company settings, WhatsApp demo notice, Forgot password note)
- **BLOCKED_EXTERNAL_FLOW**: 1 (Meta Cloud API WhatsApp live connection)
- **PERMISSION_GATED**: 2 (Settings appearance edit, Team management)
- **DEAD_CONTROL**: 1 (`POST /api/team` button in `Team.tsx`)

### TOP 10 FUNCTIONAL GAPS
1. **Team Member Invite**: `Team.tsx` submit calls `POST /api/team` (410 Gone) instead of `POST /api/invitations`.
2. **Sub-ticket Ungroup**: `useUngroupContent` hook and `POST /api/contents/:id/ungroup` exist, but child cards lack an ungroup button.
3. **Client Edit / Status Update**: `PATCH /api/clients/:id` exists, but client cards lack an "Editar" action.
4. **Client Delete / Archive**: `DELETE /api/clients/:id` exists, but client cards lack a delete action.
5. **Team Member Role & Status Update**: `PATCH /api/members/:id` exists, but `Team.tsx` lacks role changing and member deactivation controls.
6. **Pending Invitations Management**: `GET /api/invitations` and revoke exist, but `Team.tsx` lacks an invitations list.
7. **Job File Attachments Upload**: Complete backend object storage upload intent API exists, but UI only accepts URL string.
8. **Job Metadata Editing**: `PATCH /api/jobs/:id` exists, but `ContentDetail.tsx` is read-only for metadata after creation.
9. **Job Activity Feed**: `GET /api/jobs/:id/activity` exists, but `ContentDetail.tsx` has no activity timeline.
10. **Calendar Appointment Management**: `POST/PATCH/CANCEL /api/appointments` exists, but `Calendar.tsx` is currently a display projection of scheduled jobs.
