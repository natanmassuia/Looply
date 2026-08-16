# F3 — App Shell + Navigation

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **Baseline HEAD:** `48d5413` (`feat(v1): migrate shared components to semantic tokens`)
- **F1:** semantic theme runtime + contract committed (`index.css`, `theme.test.tsx`).
- **F2:** shared component foundation committed (`common.tsx`, `Breadcrumb.tsx`, `index.css` primitives, `components.test.tsx`).
- **Worktree:** intentionally dirty (pre-existing demo-v1-polish redesign: `Icons.tsx`, `Sidebar.tsx`, `StatusPill.tsx`, all `features/*.tsx`, `.dev-reports/looply-contents-card-grouping.md`).
- **Pre-existing dirty at F3 start** (unchanged set): `.dev-reports/looply-contents-card-grouping.md`, `frontend/src/components/Icons.tsx`, `Sidebar.tsx`, `StatusPill.tsx`, all `frontend/src/features/*.tsx`, plus untracked `.dev-reports/demo-v1-*.md`, `.env.backup.*`, `ecosystem.config.cjs`, `package-lock.json`.

## Tooling Evidence

- **AI Memory MCP:** queried at start for F3 / App Shell / navigation / Figma / responsive decisions. Recovered the migration roadmap (F3 = App Shell + Responsive Navigation), the F0 Figma audit reference (272px sidebar / 72px topbar @1440×960 vs current `w-60`/72px-collapse; **no topbar** — user + "Sair" live in the sidebar footer), and the dirty-worktree preservation rule. Repository evidence authoritative.
- **Serena MCP:** inspected `App.tsx`, `AppLayout.tsx`, `Sidebar.tsx`, `Icons.tsx`, `common.tsx`, `Breadcrumb.tsx`, `lib/store.ts`, `lib/api.ts` (useMe/useLogout), `index.css`, `tailwind.config.js`, `theme/*`, `tests/components.test.tsx`, `test/utils.tsx`, `vitest.config.ts`, `package.json` before editing. All actual consumers checked before any API-touching change.
- **Context7 MCP:** not needed — React Router `NavLink` aria-current, Tailwind arbitrary `var()`, and `@testing-library/react` patterns verified against committed code.
- **RTK:** all Git/shell commands routed through `rtk`.
- **Skills:** caveman (loaded, applied — token-only migration, no new wrappers/abstractions). security-audit: reasoned — no new input surface, `NavLink` hrefs are static constants; no injection. Not used. Kore-specific / broad redesign skills: not used. Ponytail **lite** active.

## Existing Shell Architecture

- **Routing** (`App.tsx`): `/login` public; internal `ProtectedRoute` wraps `ThemeProvider` → `AppLayout` → routed pages (`/dashboard`, `/contents`, `/contents/new`, `/contents/:id`, `/calendar`, `/clients`, `/team`); `/approve/:token` public (no shell); `/` and `*` redirect to `/dashboard`. Unchanged.
- **`AppLayout.tsx`** (clean at baseline): `flex h-screen overflow-hidden` → `Sidebar` + scrollable `<main>` using legacy `bg-[var(--looply-background)]`, a top-right user row (`text-neutral-500` name + `Sair` button in raw neutral palette) above `<Outlet />`.
- **`Sidebar.tsx`** (pre-existing dirty): collapsible `w-60` ↔ `w-[72px]` via `useUIStore` (zustand), brand block (inline SVG + `bg-brand-600`/`slate-900`), `NavLink` list driven by static `NAV`, collapse-toggle button (inline SVG, `title` only), user footer (`bg-brand-50`/`brand-700`/`slate-800`), all in raw `sidebar.*`/`brand-*`/`slate-*` palette.
- **`Icons.tsx`** (pre-existing dirty): `currentColor` stroke icons — color-neutral, nothing to migrate.
- **`lib/store.ts`**: minimal zustand UI store (`sidebarCollapsed`, `toggleSidebar`). Unchanged.
- **F2 shared primitives** available: `.btn-secondary`/`.btn-sm`, `.card*`, `Breadcrumb`, semantic `--looply-color-*` tokens.

## Dirty Collision Map

| File | HEAD state | Existing dirty concern | F3 change | Classification |
|---|---|---|---|---|
| `frontend/src/components/Sidebar.tsx` | legacy palette | Collapse feature (`useUIStore`, `w-[72px]`, toggle, brand rework) | Palette `sidebar.*`/`brand-*`/`slate-*` → semantic `--looply-color-*` tokens; shell a11y (`aria-label` on aside/nav, `aria-expanded`+`aria-label` on toggle, `aria-hidden` on decorative SVG, `focus-visible` rings on nav links + toggle). Collapse behavior, NAV routes, user footer preserved byte-for-byte in structure. | `F3_CHANGED_ON_PRE_EXISTING_DIRTY` |
| `frontend/src/components/AppLayout.tsx` | legacy `--looply-background` + neutral palette | — (clean at baseline) | `bg-[var(--looply-color-bg-canvas)]`, name `--looply-color-text-muted`, `Sair` → F2 `.btn-secondary btn-sm` | `F3_CHANGED` |
| `frontend/src/tests/shell.test.tsx` | — | — | New focused shell/nav contract tests (9) | `F3_ADDED` (untracked) |
| `frontend/src/components/Icons.tsx` | currentColor icons | Added icons + size tweak | None | `UNTOUCHED_PRE_EXISTING_DIRTY` |
| `frontend/src/components/StatusPill.tsx` | — | Data-driven colors | None | `UNTOUCHED_PRE_EXISTING_DIRTY` |
| All `frontend/src/features/*.tsx` | — | Redesign hunks | None (zero screen edits) | `UNTOUCHED_PRE_EXISTING_DIRTY` |
| `frontend/src/lib/store.ts`, `index.css`, `tailwind.config.js`, `theme/*`, `App.tsx` | — | — | None | UNTOUCHED / clean |

Preservation: no `git reset/stash/clean/checkout/restore`, no branch switch, no `git add .`/`-A`. F3 applied surgically; pre-existing hunks preserved.

## Implemented Shell

- **Layout:** unchanged two-region flex (`aside` + scrollable `main`). No new wrapper layers, no new layout abstraction.
- **`main`:** `bg-[var(--looply-color-bg-canvas)]` (was legacy `--looply-background`).
- **Logout:** reused F2 `.btn-secondary btn-sm` primitive (was raw `border-neutral-300 text-neutral-700 hover:bg-neutral-100`). User name → `--looply-color-text-muted`.
- **Sidebar surface:** `bg-[var(--looply-color-bg-surface)]` + `border-[var(--looply-color-border-default)]` (was `sidebar.*` palette).
- **Brand:** logo tile `bg-[var(--looply-color-action-primary)]` / `text-[var(--looply-color-text-inverse)]`; wordmark `text-[var(--looply-color-text-primary)]`; tagline `text-[var(--looply-color-text-muted)]`.
- **User footer:** avatar `bg-[var(--looply-color-bg-subtle)]` / `text-[var(--looply-color-text-brand)]`; name `text-[var(--looply-color-text-primary)]`; role `text-[var(--looply-color-text-muted)]`.

## Navigation

- **Destinations unchanged:** `/dashboard`, `/contents`, `/calendar`, `/clients`, `/team` (same `NAV` array, same `end` flags, same icon set).
- **Active state:** `bg-[var(--looply-color-bg-subtle)] font-semibold text-[var(--looply-color-text-brand)]` (was `sidebar-active`/`sidebar-text-active`), aria-current from `NavLink` preserved.
- **Hover:** `hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]` (was `sidebar-hover`/`slate-700`).
- **Collapse:** preserved unchanged (`w-60` ↔ `w-[72px]`, `title` tooltip on collapsed links, icon-only rendering).

## Semantic Token Usage

- Canvas: `--looply-color-bg-canvas` (main).
- Surfaces: `--looply-color-bg-surface` (sidebar), `--looply-color-bg-subtle` (active/hover/avatar).
- Text: `--looply-color-text-primary`, `--looply-color-text-muted`, `--looply-color-text-brand`, `--looply-color-text-inverse`.
- Action: `--looply-color-action-primary` (brand tile).
- Structure: `--looply-color-border-default` (sidebar edge), `--looply-color-focus` (focus-visible rings).

No raw palette colors (`sidebar.*`, `brand.*`, `slate.*`, `neutral.*`, hex) remain in `Sidebar.tsx` or `AppLayout.tsx` (verified by grep).

## Responsive Behavior

- Preserved: fixed collapsible sidebar (`w-60` ↔ `w-[72px]`), scrollable main, `mx-auto w-full px-6 lg:px-8` content container.
- No horizontal overflow introduced by the shell; content region is `flex-1 overflow-y-auto`.
- Narrow-width usability: collapse toggle remains the mechanism; deep responsive QA explicitly belongs to F13 (per task).

## Accessibility

- `<aside aria-label="Menu principal">` and `<nav aria-label="Navegação">` — named landmarks.
- Collapse toggle: `aria-label` (Expandir/Recolher) + `aria-expanded={!sidebarCollapsed}`; decorative SVG `aria-hidden="true"`.
- Nav links: semantic `<a>` via `NavLink`, active route communicated via `aria-current="page"` + visual `text-brand` state.
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]` on nav links and toggle (was no visible focus treatment).
- Icons are `currentColor`; labels remain in DOM when expanded, `title` tooltip when collapsed.

## Files Modified

- `frontend/src/components/Sidebar.tsx` — palette → semantic tokens; shell a11y; collapse feature preserved.
- `frontend/src/components/AppLayout.tsx` — legacy bg/neutral palette → semantic tokens; `Sair` → F2 `.btn-secondary btn-sm`.
- `frontend/src/tests/shell.test.tsx` — new focused shell/nav contract tests.

## Pre-existing Dirty Preservation

Verified identical pre/post for all untouched dirty files (`Icons.tsx`, `StatusPill.tsx`, all 7 `features/*.tsx`, `.dev-reports/looply-contents-card-grouping.md`, untracked files). For `Sidebar.tsx` (only F3-touched file that was already dirty): pre-existing collapse hunks (`useUIStore`, `sidebarCollapsed`, `w-[72px]`, toggle button, user footer, `title` tooltip, brand rework) preserved verbatim; only color-class strings swapped to semantic tokens plus additive a11y attributes.

## Routes Preserved

`/login`, `/dashboard`, `/contents`, `/contents/new`, `/contents/:id`, `/calendar`, `/clients`, `/team`, `/approve/:token`, `/`→`/dashboard`, `*`→`/dashboard`. `App.tsx` untouched. Navigation destinations in `NAV` unchanged.

## Tests

`npm --prefix frontend run test` → **104 passing** (6 files; baseline 95 + 9 new).

New `shell.test.tsx` locks:
- Sidebar/AppLayout never reference a legacy `--looply-*` alias.
- Shell never uses raw `sidebar-`/`brand-`/`slate-`/`neutral-` palette classes.
- AppLayout renders on `--looply-color-bg-canvas` and reuses `.btn-secondary btn-sm`.
- Five expected nav destinations render with correct hrefs.
- Active route has `aria-current="page"` + `--looply-color-text-brand`; inactive route does not.
- Navigation landmark is labeled.
- Collapse toggle is accessible (`aria-expanded`).
- AppLayout renders sidebar + `Sair` + routed outlet content.

## Typecheck

`npm --prefix frontend run typecheck` → **PASS** (`tsc --noEmit`).

## Build

`npm --prefix frontend run build` (`tsc --noEmit && vite build`) → **PASS** (115 modules, dist emitted).

## Code Review

- **Correctness:** routes, NAV destinations, collapse state machine, and user/logout hooks untouched. All changes are presentation + a11y on the same DOM tree.
- **Semantic correctness:** every replaced color maps to the matching F1 role (canvas/surface/subtle for backgrounds; primary/muted/brand/inverse for text; border-default for edges; focus for rings; action-primary for the brand tile). LIGHT and DARK both resolve through the same runtime vars.
- **Dark mode:** shell is fully variable-driven, so `[data-looply-theme="aura"][data-looply-mode="dark"]` overrides flow to the sidebar/main automatically (was hard-coded light-only `sidebar.*`/`slate-*`/`neutral-*`).
- **Security:** `NAV` to/aria values are static constants; no user input reaches shell DOM attributes; no injection surface. Logout flow unchanged.
- **Scope:** zero feature edits, zero backend edits, zero route changes, zero dependency changes, `App.tsx`/`store.ts`/`tailwind.config.js`/`index.css` untouched.

## Ponytail Lite Review

- **Speculative layout abstractions:** none — no new Shell/Topbar/BottomNav components, no new layout layer, no mobile nav invented (F13 owns it).
- **Redundant wrappers:** none added.
- **Duplicated navigation config:** none — `NAV` remains single-source; no second router/state mechanism.
- **Unnecessary local state:** none — reuse of existing `useUIStore`.
- **Raw colors:** zero remaining in shell files.
- **Accessibility regressions:** none — added `aria-label`s, `aria-expanded`, `aria-hidden`, `focus-visible` rings; `aria-current` preserved.
- **F4+ scope leakage:** none.
- **Kept simplification:** left Figma's 272px/72px-topbar shell as noted remaining work (F0 audit GAP) rather than restructuring navigation mid-flight; collapse width stays `w-60` (pre-existing design). `.btn-secondary` reuse removed ~5 lines of bespoke logout styling.

## Remaining Shell Work

- **Figma 272px sidebar + 72px topbar** (F0 audit G8/G9): current shell has no topbar; user + "Sair" remain in the sidebar footer. Deciding this is a deliberate navigation restructure — left for a dedicated shell/frame pass, not F3.
- **Mobile bottom-nav / mobile drawer** (F0 G16): out of scope (F13 responsive pass).
- **`tailwind.config.js` sidebar.* palette:** still declared but now unused by the shell; removal deferred to avoid churn in a clean config file (harmless dead entry).
- `Icons.tsx`/`StatusPill.tsx` and feature screens remain on pre-existing dirty work; feature screens still use legacy aliases inline (F4+/screen pass).

## Git Status

```
 M .dev-reports/looply-contents-card-grouping.md            PRE_EXISTING_DIRTY
 M frontend/src/components/AppLayout.tsx                    F3_CHANGED
 M frontend/src/components/Icons.tsx                        UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/components/Sidebar.tsx                      F3_CHANGED_ON_PRE_EXISTING_DIRTY
 M frontend/src/components/StatusPill.tsx                   UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/*.tsx (7 files)                    UNTOUCHED_PRE_EXISTING_DIRTY
?? frontend/src/tests/shell.test.tsx                        F3_ADDED (new test file)
?? .dev-reports/demo-v1-*.md, .env.backup.*, ecosystem.config.cjs, package-lock.json   PRE_EXISTING_UNTRACKED
```

Nothing staged. Nothing committed. Backend clean. F1/F2 files intact (no diff on `index.css`, `common.tsx`, `Breadcrumb.tsx`, `theme/*`).

## Final Status

F3 IMPLEMENTATION — READY FOR REVIEW