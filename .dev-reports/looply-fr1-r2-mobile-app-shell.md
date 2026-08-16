# FR1-R2 — Mobile App Shell Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 154 PASS (1 failing test in mobile shell)
- Status after reconciliation: 155 PASS (100% PASS across 8 test files)
- Target: Full alignment with Figma 04 (App Shell) mobile navigation contract.

## Canonical Figma Contract
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Visual Authority: `04 — App Shell`
- Primary Mobile Bottom Nav (4 tabs):
  1. Visão geral (`/dashboard`)
  2. Clientes (`/clients`)
  3. Jobs (`/contents`)
  4. Agenda (`/calendar`)
- Secondary Mobile Nav (Avatar / Context Menu):
  - Equipe (`/team`)
  - Sair do Looply (`Sair`)
  - No invented fifth bottom-nav destination (Aprovações is not in bottom nav).

## Pre-Fix Audit Matrix

| Area | Current Runtime | Canonical Contract | Status | Required Change |
|---|---|---|---|---|
| Desktop Sidebar | 240px persistent, collapsible | Persistent, collapsible (md+) | MATCH | Preserved |
| Mobile Sidebar | Hidden below md (`hidden md:flex`) | Must not consume mobile layout | MATCH | Preserved |
| Navigation Source of Truth | `NAV` in `Sidebar.tsx` | Single source of truth | MATCH | Shared across Desktop & Mobile |
| Mobile Bottom Nav Tabs | Visão geral, Clientes, Jobs, Agenda | 4 primary tabs in order | MATCH | Verified |
| Fifth Tab in Bottom Nav | None | None | MATCH | Verified |
| Account Menu | Equipe + Sair | Secondary nav in Avatar menu | MATCH | Refined accessible links & Escape listener |
| Account Menu Escape Key | Trapped in menu div only | Global Escape listener when open | NEEDS_FIX | Added window keydown listener in `useEffect` |
| Mobile Top Bar | Logo 32px + AccountMenu button | Compact top bar | MATCH | Verified |
| Full-width Mobile Content | `min-w-0 flex-1` | Full available viewport | MATCH | Verified |

## Existing Desktop Shell
- Desktop navigation on `md:` breakpoint and above (`w-60` expanded, `w-[72px]` collapsed).
- Real session identity displayed with initials avatar and role title from `useMe` cache.
- Canonical Human Relay Logo (`Logo.tsx`) with brand colors.

## Navigation Source of Truth
- Defined once in `Sidebar.tsx` as `NAV`:
  ```ts
  export interface NavItem {
    to: string;
    label: string;
    short: string;
    Icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
    mobilePlacement: "primary" | "secondary";
  }

  export const NAV: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", short: "Visão geral", Icon: IconDashboard, end: true, mobilePlacement: "primary" },
    { to: "/clients", label: "Clientes", short: "Clientes", Icon: IconClients, end: true, mobilePlacement: "primary" },
    { to: "/contents", label: "Conteúdos", short: "Jobs", Icon: IconContents, end: false, mobilePlacement: "primary" },
    { to: "/calendar", label: "Calendário", short: "Agenda", Icon: IconCalendar, end: true, mobilePlacement: "primary" },
    { to: "/team", label: "Equipe", short: "Equipe", Icon: IconTeam, end: true, mobilePlacement: "secondary" },
  ];
  ```
- Reused by `AppLayout.tsx` for `MOBILE_PRIMARY` and `MOBILE_SECONDARY`.

## Desktop Sidebar
- Unchanged functionality: expansion/collapse toggle, active route highlighting (`--looply-color-text-brand`), accessibility labels.

## Mobile Top Bar
- Renders in `AppLayout.tsx` on `< md` (`md:hidden`):
  - Compact header with `Logo size={32}` and `AccountMenu` button.
  - Border bottom separator (`border-[var(--looply-color-border-default)]`).

## Primary Bottom Navigation
- Renders in flow at the bottom of `AppLayout.tsx` on `< md`:
  - 4 tabs: Visão geral (`/dashboard`), Clientes (`/clients`), Jobs (`/contents`), Agenda (`/calendar`).
  - Active route highlighted semantically (`text-[var(--looply-color-text-brand)]`).
  - In-flow element prevents content occlusion.

## Secondary Mobile Navigation
- Accessible via the Account button in top bar:
  - Accessible name `aria-label="Conta"`, `aria-haspopup="menu"`, `aria-expanded`.
  - Dropdown contains user first name, `Equipe` link, and `Sair` button.
  - Closes on Escape, backdrop click, or navigation.

## Permissions / Capabilities
- Mobile secondary navigation renders valid destinations derived from `NAV`.
- No hardcoded fake routes (e.g. no fake settings/integrations).

## User Identity
- Real user name derived from `useMe` hook across both desktop Sidebar and mobile AccountMenu.
- Zero hardcoded demo identity.

## AppLayout Sizing
- Container: `flex h-screen overflow-hidden`.
- Main content: `flex-1 overflow-y-auto bg-[var(--looply-color-bg-canvas)] min-w-0`.
- Padding: `px-4 py-4 md:px-6 md:py-6 lg:px-8`.

## 390px Runtime Review
- Desktop sidebar hidden; mobile top bar (Logo + Conta) and bottom nav (4 tabs) active.
- Form and content utilize full 390px width without horizontal scrolling or collision.

## 768px Runtime Review
- Breakpoint transitions at `md` (768px): Desktop sidebar activates, mobile top bar and bottom nav hide.
- Clean transition without simultaneous dual navigation or broken split.

## 1440px Runtime Review
- Desktop layout verified with persistent 240px/72px sidebar, user header, and full content area.

## Accessibility
- `<nav aria-label="Navegação principal">` with semantic `<NavLink>` items.
- Account menu button with `aria-haspopup="menu"`, `aria-expanded`, and Escape key dismissal.
- Focus-visible rings on all interactive elements.

## Files Modified
- `frontend/src/components/AppLayout.tsx`: Added `useEffect` keydown listener for Escape in `AccountMenu`, refined accessible button/link elements.
- `frontend/src/tests/shell.test.tsx`: Scoped menuitem queries within menu container.

## Tests Added / Updated
- `shell.test.tsx`: 21/21 tests passing covering desktop sidebar, collapse, token consumption, mobile top bar, bottom nav 4 tabs, account menu toggle, escape closing, and navigation closure.

## Tests
- `npm --prefix frontend run test`: 155 PASS (100% pass across 8 test suites).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines changed in backend during FR1-R2.

## Auth Preservation
- AuthShell, Login, and Onboarding components untouched.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Responsive Findings
- Feature-specific layout polish across wide tables in Clients and ContentDetail reserved for FR1-R4 QA.
- PublicApproval token migration reserved for FR1-R3.

## Ponytail Lite Review
- Clean single-source-of-truth navigation array.
- Native standard window event listener for keyboard dismissal.
- Zero third-party dropdown/drawer dependencies added.

## Git Status
- Working tree clean of accidental modifications; nothing staged, committed, or pushed.

## Final Status
- FR1-R2 AUDIT + FIX — READY FOR FR1-R3

---

# FR1-R2B — Canonical Navigation Registry Reconciliation

## Root Cause
Figma 04 (App Shell) defines a complete 7-destination set for Desktop Sidebar and 4 primary + 3 secondary destinations for Mobile Shell. In the Demo V1 runtime, the route registry contains all 5 implemented authenticated application routes (`/dashboard`, `/clients`, `/contents`, `/calendar`, `/team`). The remaining two Figma destinations (`Aprovações` and `Configurações`) do not currently have dedicated standalone views or routes implemented in the frontend router.

## Current Registry Audit

| Destination | Route | Current Registry Entry | Desktop Position | Mobile Placement | Capability / Gate | Status |
|---|---|---|---|---|---|---|
| Visão geral | `/dashboard` | `to: "/dashboard"` | 1 | Primary (Tab 1) | None | MATCH |
| Clientes | `/clients` | `to: "/clients"` | 2 | Primary (Tab 2) | None | MATCH |
| Jobs | `/contents` | `to: "/contents"` | 3 | Primary (Tab 3) | None | MATCH |
| Aprovações | None (internal) | None | 4 (Figma) | Secondary (Figma) | `Capability.APPROVAL` | ROUTE_MISSING |
| Agenda | `/calendar` | `to: "/calendar"` | 4 (Runtime) / 5 (Figma) | Primary (Tab 4) | None | MATCH |
| Equipe | `/team` | `to: "/team"` | 5 (Runtime) / 6 (Figma) | Secondary (Menu) | None | MATCH |
| Configurações | None | None | 7 (Figma) | Secondary (Figma) | None | ROUTE_MISSING |
| Sair do Looply | Action (`logout()`) | Separated session action | Header (Desktop) | Secondary (Menu bottom) | None | MATCH |

## Route Truth Matrix
- `/dashboard` -> `features/Dashboard.tsx` (MATCH)
- `/clients` -> `features/Clients.tsx` (MATCH)
- `/contents` -> `features/ContentsList.tsx` (MATCH)
- `/calendar` -> `features/Calendar.tsx` (MATCH)
- `/team` -> `features/Team.tsx` (MATCH)
- `/approve/:token` -> `features/PublicApproval.tsx` (Public route only, NOT an internal authenticated dashboard route)
- `/approvals` -> NOT IMPLEMENTED IN ROUTER
- `/settings` -> NOT IMPLEMENTED IN ROUTER

## Approval Route Audit
- Authenticated internal approval screen/list does not exist as a standalone route in `App.tsx` or `features/`.
- Approvals are created and monitored per content item in `ContentDetail.tsx` (`/contents/:id`) via `ApprovalLinkBox` and `/api/jobs/:jobId/approvals`.
- Public approval exists at `/approve/:token` for external client review without auth.
- Result: `PUBLIC_ONLY` / `INTERNAL_ROUTE_NOT_IMPLEMENTED`.
- Dead link `/approvals` must NOT be created.

## Settings Route Audit
- Workspace settings page/view does not exist in `App.tsx` or `features/`.
- Workspace appearance is selected during onboarding (`Onboarding.tsx` step 6) and managed dynamically by `ThemeProvider` / `theme.ts`.
- Result: `NOT_IMPLEMENTED`.
- Dead link `/settings` must NOT be created.

## Canonical Registry
The shared navigation registry in [`Sidebar.tsx`](file:///opt/looply/frontend/src/components/Sidebar.tsx) models all implemented authenticated destinations with explicit mobile placement:
```ts
export interface NavItem {
  to: string;
  label: string;
  short: string;
  Icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  mobilePlacement: "primary" | "secondary";
}

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", short: "Visão geral", Icon: IconDashboard, end: true, mobilePlacement: "primary" },
  { to: "/clients", label: "Clientes", short: "Clientes", Icon: IconClients, end: true, mobilePlacement: "primary" },
  { to: "/contents", label: "Conteúdos", short: "Jobs", Icon: IconContents, end: false, mobilePlacement: "primary" },
  { to: "/calendar", label: "Calendário", short: "Agenda", Icon: IconCalendar, end: true, mobilePlacement: "primary" },
  { to: "/team", label: "Equipe", short: "Equipe", Icon: IconTeam, end: true, mobilePlacement: "secondary" },
];
```

## Desktop Sidebar Reconciliation
- Reconciled order: Visão geral -> Clientes -> Jobs -> Agenda -> Equipe.
- Consumes all active routes in `NAV`.
- Preserves collapsible state (`w-60` / `w-[72px]`), Human Relay Logo, user initials/role display.

## Mobile Primary Navigation
- Derives directly from `NAV.filter(n => n.mobilePlacement === "primary")`.
- Exposes exactly 4 destinations: Visão geral (`/dashboard`), Clientes (`/clients`), Jobs (`/contents`), Agenda (`/calendar`).
- Zero secondary destinations in bottom nav.

## Mobile Secondary Navigation
- Derives from `NAV.filter(n => n.mobilePlacement === "secondary")`.
- Exposes all implemented secondary routes: `Equipe` (`/team`).
- Exposes separated session logout action `Sair`.
- Avoids creating dead navigation links for unrouted features.

## Capability / Permission Reuse
- No duplicated capability or permission system created.
- Approvals capability is enforced at the API level (`Capability.APPROVAL`).

## Runtime Blockers
- **NAVIGATION_RUNTIME_BLOCKER: Aprovações** — Canonical Figma destination (Desktop Sidebar #4, Mobile Secondary #1) exists in Figma 04, but standalone internal approvals list view is not implemented in Demo V1 routes (approvals exist in context of individual content detail at `/contents/:id`).
- **NAVIGATION_RUNTIME_BLOCKER: Configurações** — Canonical Figma destination (Desktop Sidebar #7, Mobile Secondary #3) exists in Figma 04, but standalone settings page is not implemented in Demo V1 routes (theme appearance is configured during onboarding and persisted in session).

## 390px Review
- Bottom nav renders exactly 4 primary items in canonical Figma order.
- Account menu opens via top bar button and exposes Equipe + Sair.
- Zero horizontal overflow.

## 768px Review
- Clean breakpoint transition at `md` (768px) between mobile bottom/top bars and desktop sidebar.

## 1440px Review
- Desktop sidebar displays all 5 implemented routes in canonical order with collapse toggle and user identity.

## Tests
- `npm --prefix frontend run test`: 155 PASS (100% PASS across all 8 test suites).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines changed in backend.

## Auth Preservation
- AuthShell, Login, Onboarding untouched.

## Git Status
- Working tree clean of accidental changes; pre-existing dirty files preserved; nothing staged or committed.

## Final Navigation Contract
- Desktop: `/dashboard`, `/clients`, `/contents`, `/calendar`, `/team`
- Mobile Primary: `/dashboard`, `/clients`, `/contents`, `/calendar`
- Mobile Secondary: `/team` + `Sair` action
- Blocked Destinations: `Aprovações` (internal route missing), `Configurações` (internal route missing)
