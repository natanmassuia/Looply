# Looply V1 — Frontend Integration Baseline

## Current Architecture

React 19 + Vite + React Router 6 + TanStack Query + Zustand + Tailwind/CSS global styles. The frontend is the Demo V1 shell, not the final Figma application.

## Entry Point

`src/main.tsx` creates:

1. React StrictMode;
2. one TanStack QueryClient;
3. BrowserRouter;
4. `App`.

Query defaults: `staleTime=15s`, retry 1, no refetch on window focus.

## Routing

| Route | Component | Auth | Current API | Classification | Target |
|---|---|---:|---|---|---|
| `/login` | `features/Login.tsx` | no | `/api/auth/login`, `/api/auth/me` | canonical auth, incomplete first-login UX | F3 |
| `/dashboard` | `features/Dashboard.tsx` | yes UX guard | `/api/dashboard`, `/api/team` | mixed canonical/legacy response | F4 |
| `/contents` | `features/ContentsList.tsx` | yes UX guard | `/api/contents`, `/api/clients` | legacy Content bridge | F6 |
| `/contents/new` | `features/NewContent.tsx` | yes UX guard | `/api/clients`, `/api/team`, `/api/contents` | legacy social/content flow | F6 |
| `/contents/:id` | `features/ContentDetail.tsx` | yes UX guard | `/api/contents/:id/*` | legacy Content/Approval flow | F6/F7 |
| `/calendar` | `features/Calendar.tsx` | yes UX guard | `/api/publications` | legacy publication projection | F8 |
| `/clients` | `features/Clients.tsx` | yes UX guard | `/api/clients` | canonical B5 CRUD read/create | F5 |
| `/team` | `features/Team.tsx` | yes UX guard | `/api/team` GET + POST | GET legacy read; POST deprecated 410 | F9 |
| `/approve/:token` | `features/PublicApproval.tsx` | public token | `/api/public/approvals/:token*` | public Approval contract | F7 |
| `/` | Navigate | no | redirects `/dashboard` | shell default | F4 |
| `*` | Navigate | no | redirects `/dashboard` | shell fallback | F2/F4 |

`ProtectedRoute` is a UX redirect only. Backend auth/capability checks remain authoritative.

## Layouts

- `AppLayout`: legacy shell with Sidebar, Outlet and logout/name header.
- `Sidebar`: legacy navigation for Dashboard, Contents, Calendar, Clients, Team.
- `Breadcrumb`: shared legacy navigation primitive.
- No capability-aware navigation exists.

## State Management

### TanStack Query

Server state lives in `src/lib/api.ts`:

- `me`;
- `dashboard`;
- `clients`;
- `team`;
- `contents`;
- `content`;
- `publications`;
- `approval`.

Mutations invalidate broad legacy keys such as `contents`, `dashboard` and `publications`.

### Zustand

`src/lib/store.ts` contains only:

- `sidebarCollapsed`;
- `toggleSidebar`.

No User, Company, Job, Client or Approval server entity is stored in Zustand.

### Local State

Forms, modal visibility, calendar cursor, drag state and feedback messages are local component state.

## API Client

`src/lib/api.ts` provides `apiFetch`, React Query hooks and mutations.

Current behavior:

- relative API URL by default;
- `VITE_API_URL` override;
- `credentials: "include"`;
- JSON headers;
- basic `ApiError(status, message, code)` mapping;
- no centralized 401/403/409/429/503 UX policy;
- no AbortController/cancellation;
- JSON parse errors are not normalized.

## Authentication

Current frontend flow:

`/login` → `POST /api/auth/login` → `window.location.assign("/dashboard")` → `useMe` ProtectedRoute.

Backend B4/B12 additionally requires:

- temporary password change;
- onboarding completion;
- active workspace;
- capabilities.

Frontend currently does not implement the password-change/onboarding gates. Backend still blocks unauthorized domain operations.

## Workspace / Capabilities

Backend `/api/auth/me` returns workspace/template/capabilities, but frontend `SessionInfo` does not model or consume them. No hardcoded capability registry exists in frontend. No `companyId` is sent by current API hooks as an authority.

## Current Pages

- `Dashboard.tsx`: legacy operational dashboard.
- `ContentsList.tsx`: legacy content board/grouping/filters.
- `NewContent.tsx`: social-content creation form.
- `ContentDetail.tsx`: content versions, status actions, Approval link and media URL.
- `Calendar.tsx`: local month grid over publication data.
- `Clients.tsx`: client list/create.
- `Team.tsx`: team list/create legacy mutation.
- `PublicApproval.tsx`: public approval read/approve/request changes.
- `Login.tsx`: minimal login and UX guard.

## Current Components

### Generic/reusable

- `common.tsx` primitives;
- `StatusPill.tsx`;
- `Breadcrumb.tsx`;
- icon wrapper/export layer;
- AppLayout/Sidebar shell primitives.

### Domain-specific/legacy

- Content cards and grouping UI inside `ContentsList.tsx`;
- content version editor in `ContentDetail.tsx`;
- social/media fields in `NewContent.tsx`;
- publication-oriented calendar in `Calendar.tsx`;
- approval public UI in `PublicApproval.tsx`;
- team creation UI in `Team.tsx` (backend POST now 410).

## Current API Calls

| Caller | Endpoint | Classification |
|---|---|---|
| `useLogin` | `POST /api/auth/login` | CANONICAL |
| `useMe` | `GET /api/auth/me` | CANONICAL, response model incomplete |
| `useLogout` | `POST /api/auth/logout` | CANONICAL |
| `useDashboard` | `GET /api/dashboard` | CANONICAL path, legacy fields consumed |
| `useClients` / `useCreateClient` | `/api/clients` | CANONICAL |
| `useTeam` | `GET /api/team` | LEGACY bridge |
| `useCreateTeamMember` | `POST /api/team` | DEPRECATED; backend returns 410 |
| `useContents` | `GET /api/contents` | LEGACY bridge |
| `useContent` | `GET /api/contents/:id` | LEGACY bridge |
| `useCreateContent` | `POST /api/contents` | LEGACY bridge |
| `useWorkflowAction` | `/api/contents/:id/*` | LEGACY bridge |
| `useCreateVersion` | `/api/contents/:id/versions` | LEGACY bridge |
| `useGroupContent` | `/api/contents/:id/group` | LEGACY bridge |
| `useUngroupContent` | `/api/contents/:id/ungroup` | LEGACY bridge |
| `usePublications` | `GET /api/publications` | LEGACY bridge |
| `useApproval` | `GET /api/public/approvals/:token` | CANONICAL public path, response drift |
| `useApprovePublic` | `POST /api/public/approvals/:token/approve` | CANONICAL public path |
| `useRequestChangesPublic` | `POST /api/public/approvals/:token/request-changes` | CANONICAL public path |

No frontend caller currently uses `/api/jobs`, `/api/jobs/board`, `/api/calendar`, `/api/files`, internal Approval APIs or members/invitations APIs.

## Legacy Bridge Callers

- `/api/contents`: ContentsList, NewContent, ContentDetail and mutation helpers.
- `/api/publications`: Calendar.
- `/api/team`: Dashboard, NewContent, Team.
- Legacy Dashboard fields: Dashboard consumes `counts`, `recentContents`, `needingAttention`.
- `mediaUrl`/`mediaType`: NewContent, ContentDetail, PublicApproval and shared types.

No bridge was removed in F1 because callers still exist.

## Canonical Contract Map

| Area | Backend canonical contract | Frontend status | Target |
|---|---|---|---|
| Auth | `/api/auth/login`, `/logout`, `/me`, `/change-password` | login/me/logout only; onboarding missing | F3 |
| Workspace | `/api/onboarding/*`, `/api/auth/me.workspace` | not consumed | F3 |
| Clients | `/api/clients` | already used | F5 |
| Jobs | `/api/jobs`, board, summary, transition, activity | unused | F6 |
| Files | `/api/jobs/:jobId/files`, `/api/files/*` | unused | F7 |
| Approval internal | `/api/jobs/:jobId/approvals`, `/api/approvals/*` | unused | F7 |
| Approval public | `/api/public/approvals/*` | partially used | F7 |
| Calendar | `/api/calendar` | unused; uses publications | F8 |
| Dashboard | `/api/dashboard` capability-aware | path used; legacy fields | F4 |
| Members/invitations | canonical B4 routes | unused; Team bridge | F9 |

## Contract Drift

| Area | Drift | Action |
|---|---|---|
| Login/Me | Backend exposes `mustChangePassword`, workspace/template/capabilities; `SessionInfo` omits them | F3 |
| Dashboard | Backend has summary/attention/recent/capability sections; `Dashboard` type only models legacy counts | F4 |
| Approval internal | Backend no longer exposes plaintext token in Job/Approval metadata; `Approval` type expects `token` | F7 |
| Approval status | Backend includes REJECTED/REVOKED; frontend type has only old statuses | F7 |
| Jobs | Frontend has no canonical Job types/hooks | F6 |
| Calendar | Backend uses `/api/calendar`; frontend expects publications | F8 |
| Team | POST `/api/team` returns 410; Team UI still calls it | F9 |
| Files | Backend exists; frontend has no contract/types | F7 |

## Capability Flow

No frontend capability consumption exists. Current route visibility is static Sidebar. Future frontend should read `/api/auth/me.workspace.capabilities`; it must never recreate authority locally.

## Tenant State Review

No `companyId`, `workspaceId` or `tenantId` is sent in current API request payloads/queries as an authority. `SessionMembership.companyId` exists as response data but is not used to authorize fetches. No localStorage tenant authority was found.

## Visual System

- Tailwind config and global `index.css` contain the current Demo visual tokens/styles.
- Current dirty frontend files include the visual redesign work.
- `common.tsx`, icons, StatusPill, Sidebar and shell are reusable candidates but visually legacy/Figma-replaceable.
- F1 made no visual changes.

## Dependency Inventory

| Dependency | Use | Status |
|---|---|---|
| React/React DOM | runtime | used |
| React Router 6 | routing | used; advisory |
| TanStack Query | server state | used |
| Zustand | sidebar UI state | used minimally |
| Tailwind/PostCSS | styling | used |
| Testing Library/JSDOM | tests | minimal current coverage |
| Vitest | tests | used |

No form, date, chart, upload or drag/drop library is central to the current API layer; drag/group logic is hand-written in ContentsList.

## React Router Advisory

Installed version is `react-router-dom@6.30.4`. Frontend audit reports moderate advisories with no safe patch within the current major range identified by the audit. F1 does not perform a major upgrade or frontend change. Revisit during F2/F10 dependency compatibility work.

## Test Inventory

- Framework: Vitest + Testing Library/JSDOM.
- Current test file: `src/tests/format.test.tsx`.
- Current coverage: formatting utilities only, 5 tests.
- No route tests.
- No API client tests.
- No QueryClient/auth guard tests.
- No capability/workspace tests.
- No API mocks/MSW harness.

## Security Findings

- Cookie credentials are correctly included.
- No local auth token persistence.
- Backend authorization remains authoritative.
- Approval internal response drift must be handled before F7; current frontend type expects token plaintext.
- First-login/onboarding guards are missing in frontend UX; backend enforcement exists.
- Frontend dependency audit has 5 moderate, 1 high and 1 critical total findings across runtime/dev dependency graph; React Router runtime concern is deferred for compatibility review.

## Performance Findings

- ContentsList loads legacy collection and filters/groups in browser.
- Calendar loads legacy publications and builds month grid locally.
- Dashboard performs dashboard + team queries and consumes legacy fields.
- API client has no centralized 429/503 retry or cancellation policy.
- No obvious API calls inside render loops.

## Dirty Worktree Context

Preexisting tracked changes:

- `.dev-reports/looply-contents-card-grouping.md`;
- 13 frontend files, including shell, features, CSS and Tailwind config.

Preexisting untracked files:

- four demo reports;
- `.env.backup.20260813-132904`;
- `ecosystem.config.cjs`;
- root `package-lock.json`.

F1 added no overlapping edits and staged none of these files.

## Migration Matrix

| Current Area | Current API | Canonical API | Legacy Dependency | Target Phase | Action |
|---|---|---|---|---|---|
| Login | `/api/auth/login` | same | none | F3 | Extend session model and first-login flow |
| Protected shell | `/api/auth/me` | same + workspace/capabilities | missing capability consumption | F3 | Add auth/workspace context |
| Dashboard | `/api/dashboard` | same canonical sections | legacy counts/recent fields | F4 | Replace types/sections incrementally |
| Clients | `/api/clients` | same | none relevant | F5 | Adopt canonical types and errors |
| Contents list | `/api/contents` | `/api/jobs` | Content bridge, legacy statuses | F6 | Replace API/query contract |
| Content detail | `/api/contents/:id` | `/api/jobs/:id` | media/version/Approval legacy | F6/F7 | Split Job, Files and Approval contracts |
| New Content | `POST /api/contents` | `POST /api/jobs` | social fields, team caller | F6 | Figma Job creation flow |
| Content grouping | `/api/contents/:id/group` | Job/workflow behavior | legacy grouping | F6 | Decide if grouping survives generic Job |
| Calendar | `/api/publications` | `/api/calendar` | publication bridge | F8 | Consume range projection |
| Public approval | `/api/public/approvals/:token` | same public API | response/type drift | F7 | Update public contract/types |
| Team | `GET /api/team` | members routes | legacy read-only team | F9 | Replace with members/invitations |
| Team create | `POST /api/team` | invitation/provisioning | deprecated 410 | F9 | Remove caller/UI |
| Files | none | `/api/jobs/:jobId/files`, `/api/files/*` | no current caller | F7 | Add Figma attachment flow |

## F2–F12 Mapping

- F2: Foundations + Components + App Shell; API client/error/capability primitives.
- F3: Login, session, first-login password change, onboarding and workspace context.
- F4: canonical Dashboard sections and capability-aware rendering.
- F5: Clients canonical types/API integration.
- F6: Jobs, Workflow, list/board and transition APIs.
- F7: Files and Approval integration.
- F8: Calendar range API.
- F9: Team, members, invitations and settings.
- F10: full E2E integration.
- F11: storage/Nginx/backup staging readiness.
- F12: acceptance/go-live checklist.

## Known Risks

- Figma work must not recreate unsupported backend behavior.
- Current Content/Publication bridges must remain until callers migrate.
- Approval token field drift can cause current ContentDetail breakage when backend returns canonical sanitized Approval data.
- Current frontend test coverage is narrow.

## Rules for Figma Integration

1. Backend canonical contracts are data authority.
2. `/api/auth/me` capabilities are authority for visibility only; authorization remains backend-side.
3. Do not send companyId as tenant authority.
4. Do not persist auth tokens in localStorage.
5. Migrate one domain at a time.
6. Keep legacy bridges until repository-wide caller search proves removal safe.
7. Preserve non-Figma user changes in dirty files.
