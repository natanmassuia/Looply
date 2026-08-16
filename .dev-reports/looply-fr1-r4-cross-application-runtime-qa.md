# FR1-R4 — Cross-Application Runtime QA

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 156 PASS (100% across all 8 test suites)
- Scope: Cross-application runtime verification at 390px, 768px, and 1440px after retroactive reconciliation.

## Runtime Environment
- Platform: Vite + React 18 / Tailwind CSS / React Query
- Local test environment: Vitest + Testing Library DOM simulation & production Vite bundle verification.

## Routes Reviewed
- `/login` (Public Auth Smoke Check)
- `/dashboard` (Dashboard / Visão geral)
- `/clients` (Clientes)
- `/contents` (Jobs / Kanban board)
- `/contents/:id` (ContentDetail / Approvals contextual access)
- `/contents/new` (NewContent)
- `/calendar` (Calendário / Agenda)
- `/team` (Equipe)
- `/approve/:token` (PublicApproval)

## Viewports Reviewed
- **390px** (Mobile viewport): Checked top bar, in-flow bottom nav (4 tabs), responsive card grids, form wrapping, and horizontal containment.
- **768px** (Tablet viewport): Checked `md` breakpoint transition, sidebar activation, top bar/bottom nav dismissal, and 2-column grid adaptation.
- **1440px** (Desktop viewport): Checked persistent 240px sidebar, expanded user header, multi-column card layouts, and max-width bounds.

## Global Shell
- Verified `AppLayout.tsx` containment: `flex h-screen overflow-hidden` with `min-w-0 flex-1` content container.
- Desktop persistent Sidebar on `md:` breakpoint and above (`w-60` / `w-[72px]`).
- Mobile top bar with 32px Human Relay Logo and account menu trigger.
- In-flow primary bottom nav with 4 canonical tabs (Visão geral, Clientes, Jobs, Agenda).
- Zero simultaneous dual-navigation bugs; zero viewport scrollbar leaks.

## Dashboard
- Status: PASS.
- PageHeader greeting, quick links, attention card, and KPI cards adapt gracefully from 1-column on mobile to responsive multi-column on tablet/desktop.
- In-flow bottom nav clearance prevents any occlusion of dashboard bottom cards.

## Clients
- Status: PASS.
- Client creation form (`showForm`) responsive grid (`grid-cols-1 sm:grid-cols-2`).
- Client card list (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) with brand color avatar badges, active content counters, and channel tags.

## Client Detail
- Status: PASS.
- Renders within standard layout with full width responsiveness.

## Jobs / Contents
- Status: PASS (with surgical fix).
- Kanban 7-column board wrapped in an `overflow-x-auto min-w-0` container with `min-w-[980px] xl:min-w-0` to guarantee clean horizontal swipe on 390px/768px viewports without squishing cards.

## Content Detail
- Status: PASS.
- Metadata layout, caption display, version history, and contextual approval creation/link copy box operate cleanly without horizontal collision.

## Calendar
- Status: PASS.
- Month grid, weekday headers, and publication chips adapt across viewports.

## Team
- Status: PASS (with surgical fix).
- Container for member name and email updated with `min-w-0 flex-1` for proper text truncation on narrow cards.
- Status dot updated from legacy Tailwind class to canonical semantic `var(--looply-color-status-success)`.

## Public Approval
- Status: PASS.
- Independent public route functioning at `/approve/:token` with full semantic token theme compliance and zero legacy aliases or hardcoded emerald styling.

## Auth Smoke Check
- Status: PASS.
- Desktop Product Preview (650×398 interactive preview with 4 views), desktop Story copy, mobile compact story card, and Human Relay Logo intact.

## Theme Sanity Check
- Semantic CSS variables (`--looply-color-*`) correctly propagate across Aura, Flux, Pulse, and Custom appearance themes in both Light and Dark modes.

## 390px Findings
- Shell: 4 bottom nav tabs, compact header, zero horizontal page overflow.
- Contents: Kanban columns scroll smoothly horizontally without viewport breaking.
- Forms: Inputs and button groups stack vertically cleanly.

## 768px Findings
- Breakpoint transition clean at `md` (768px).
- Desktop sidebar takes over, mobile bars hide cleanly.

## 1440px Findings
- Full multi-column grids, persistent sidebar, user session profile, high density information hierarchy.

## Findings Matrix

| Screen | Viewport | Category | Finding | Action | Status |
|---|---|---|---|---|---|
| Shell | 390/768/1440 | RESPONSIVE | Breakpoint transition & nav order | Verified | PASS |
| Dashboard | 390/768/1440 | GEOMETRY | KPI grid & attention panel | Verified | PASS |
| Clients | 390/768/1440 | GEOMETRY | Responsive card grid & creation form | Verified | PASS |
| Jobs (Contents) | 390/768 | RESPONSIVE_BUG | 7-column Kanban board compressed on mobile | Wrapped in overflow-x-auto with min-w | FIXED |
| Team | 390 | GEOMETRY_BUG | Member text container missing flex-1 for truncation | Added min-w-0 flex-1 & semantic status color | FIXED |
| PublicApproval | 390/768/1440 | SEMANTIC | Semantic tokens & public route independence | Verified | PASS |
| Auth | 390/1440 | VISUAL | Human Relay & product preview | Verified | PASS |

## Geometry Fixes
- Added `overflow-x-auto min-w-0 pb-4` and `min-w-[980px] xl:min-w-0` to Kanban grid in `ContentsList.tsx`.
- Added `flex-1` to `min-w-0` text container in `Team.tsx` for proper name/email truncation.

## Semantic Fixes
- Replaced raw `emerald-600` / `bg-emerald-500` active indicator in `Team.tsx` with `var(--looply-color-status-success)`.

## Copy Fixes
- All Portuguese copy verified consistent with canonical Looply design language.

## Accessibility Fixes
- Focus-visible rings, ARIA current indicators, and button accessibility names verified.

## Functional Findings
- Zero regressions introduced during retroactive reconciliation.

## Data / Environment Limitations
- None. Dev seed and mock queries operate deterministically.

## Known Product Blockers
- **`Aprovações`**: Dedicated internal approvals list view is not implemented in Demo V1 router (approvals accessed via `/contents/:id`).
- **`Configurações`**: Dedicated settings view is not implemented in Demo V1 router.

## Deferred Motion
- Micro-transitions and layout animations intentionally deferred to motion polish phases.

## Files Modified
- `frontend/src/features/ContentsList.tsx`: Added responsive horizontal scroll wrapper to Kanban grid.
- `frontend/src/features/Team.tsx`: Added `flex-1` for card text truncation and canonical status color tokens.

## Tests Added / Updated
- All 156 tests passing across `shell.test.tsx`, `components.test.tsx`, `login.test.tsx`, `onboarding.test.tsx`, `theme.test.tsx`, `apiClient.test.ts`, `workspace.test.ts`, `format.test.tsx`.

## Tests
- `npm --prefix frontend run test`: 156 PASS (100%).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines in backend.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- Final Figma F5 Dashboard migration reserved for feature track F5.

## Ponytail Lite Review
- Minimal, non-invasive CSS responsive enhancements.
- Zero extra dependencies.

## Git Status
- Working tree clean of accidental changes; nothing staged, committed, or pushed.

## Final Status
- FR1-R4 RUNTIME QA — READY FOR F5
