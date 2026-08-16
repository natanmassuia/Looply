# F0 — Figma → Frontend Gap Audit

Status: `F0 FIGMA FRONTEND AUDIT — PASS`

Branch: `feature/demo-v1-polish` · HEAD: `979c423f213cacba3193209f4b951276dea4a86c`

Figma source: https://www.figma.com/design/8JDixNLJNe1f3KVPRwEFBi/Looply-%E2%80%94-Brand---Product

---

## Executive Decision

**Migrate the frontend to the Figma design (visual pass only).** The current
blue/zinc/Inter implementation is functionally complete and stable (typecheck
clean, 32/32 tests passing, production build succeeds) but is a **restyle**, not
a reuse, of the Figma visual system. Figma is the visual authority; the current
frontend is the functional authority. F1+ will restyle the shell, tokens, and
components **without** changing any working state/query/router/API logic.

---

## Authoritative Gap Table (current vs Figma)

| Gap ID | Area | Current (verified) | Figma (source of truth) | Verdict |
| --- | --- | --- | --- | --- |
| G1 | Brand color | `#2563eb` (blue 600, `tailwind.config.js` `brand.600`, `--looply-primary`) | `action.primary` `#F06D55` (warm coral) | COLLISION |
| G2 | Canvas/surface | `--looply-background: #f4f5f7` (cool grey), surfaces white | `bg.canvas` `#FFF7F1` (warm peach) | COLLISION |
| G3 | Neutral ramp | zinc/slate greys (`#5f6577`, `#9498a8`, `#1a1d26`) | warm-toned neutrals on `#FFF7F1` canvas | COLLISION |
| G4 | Accent amber | Tailwind `amber-*` (used for IN_REVIEW/warning) | `#F3B84B` (brand amber) | MERGE |
| G5 | Font | Inter (`--looply-*` + `tailwind.config.js` `fontFamily.sans`) | Manrope | COLLISION |
| G6 | Radius | `--looply-radius*`: 6/8/10/12/16px | `radius.md` 10px family | MERGE (align scale) |
| G7 | Buttons | full-round `9999px` pill (`.btn*`) | Figma component radius (`radius.md` 10px) | COLLISION |
| G8 | Sidebar | 240px/72px collapsible (`w-60`/`w-[72px]`), light `sidebar.*` palette | 272px sidebar, 72px topbar @1440×960 | COLLISION (width + topbar) |
| G9 | Shell | no topbar; user + "Sair" in sidebar footer | topbar 72px with global controls | GAP |
| G10 | Icons | custom stroke SVG set (`Icons.tsx`, strokeWidth 1.8) | Figma icon set (stroke family) | MERGE (re-derive from Figma glyphs) |
| G11 | Dashboard | asymmetric 3/2 grid, compact metric row, needs-attention card | Figma dashboard composition | MERGE |
| G12 | Contents | 7-column kanban + drag grouping (500ms hold) | Figma board/table composition | MERGE (verify columns vs Figma) |
| G13 | Calendar | month grid, 3-item chip cap, client-color legend | Figma calendar component | MERGE |
| G14 | Clients/Team | 3-col card grids | Figma cards | MERGE |
| G15 | Login | centered white card, neutral button | Figma auth frame | MERGE |
| G16 | Mobile | stack-based responsive, sidebar collapse; **no bottom-nav** | mobile 390×844 with bottom nav (Figma) | GAP |
| G17 | Status pill | round `9999px` pill with dot (`status-pill`) | Figma status tokens | MERGE |
| G18 | Media | `MediaPreview` (img / placeholder tile) | Figma media frames | MERGE |

**Collision zones (restyle, not reuse):** G1, G2, G3, G5, G7, G8, G9, G16.
**Merge zones (re-map existing structure):** G4, G6, G10, G11, G12, G13, G14,
G15, G17, G18.

---

## Foundations

### Current frontend tokens (verified in `src/index.css` + `tailwind.config.js`)

- Surfaces: `#f4f5f7` bg, white surfaces, `#f0f1f4` muted, `#f7f8fa` subtle.
- Borders: `#e2e4e9` / `#c8ccd4` / `#eaecf0`.
- Text: `#1a1d26` fg, `#5f6577` muted, `#9498a8` faint, `#b0b4c0` tertiary.
- Brand: `#2563eb` primary (hover `#1d4ed8`, active `#1e40af`, subtle `#eff4ff`).
- Semantic: success `#059669`, warning `#d97706`, danger `#dc2626`,
  information `#2563eb`, each with tinted `-bg`/`-border`.
- Shape: radius 6/8/10/12/16; shadows 0.03–0.08 alpha, selective.
- Font: Inter with `cv11`, `ss01` feature settings.

### Figma foundations (source of truth, per design brief)

> NOTE: no Figma API/MCP access was available in this environment. Figma
> foundation values below are taken from the design brief provided with the
> task (tokens/structure facts), not from a live Figma read. Verify against the
> file before executing F1 token replacement.

- Canvas `bg.canvas` `#FFF7F1` (warm peach).
- Brand primary `action.primary` `#F06D55` (warm coral).
- Accent `#F3B84B` (amber).
- Radius family centered on `radius.md` 10px.
- Type: Manrope.
- Frame: desktop 1440×960 — sidebar 272px, topbar 72px; mobile 390×844 with
  bottom navigation.

### Token mapping plan (F1 scope, current → Figma)

| Current | Figma | Action |
| --- | --- | --- |
| `--looply-primary` `#2563eb` | `#F06D55` | Replace all brand blues |
| `brand.50..900` tailwind scale | coral scale | Regenerate scale around `#F06D55` |
| `--looply-background` `#f4f5f7` | `#FFF7F1` | Replace |
| zinc/slate text ramp | warm neutral ramp | Re-map to Figma neutrals |
| `amber-*` accent | `#F3B84B` | Keep as accent; align hex |
| Inter stack | Manrope | Swap `fontFamily.sans` + `--looply-*` font var |
| radius 6/8/10/12/16 | `radius.md` 10px family | Align scale to Figma |

---

## Component Inventory (Figma 03.1–03.18)

Figma component spec (per design brief, page 03.x): buttons, inputs, cards,
status tokens, avatars, calendar cell, kanban card, sidebar item, topbar,
bottom-nav (mobile), toast/alert, dropdown, empty state, tabs, table row,
modal, media frame.

Current shared components (verified):

- `components/AppLayout.tsx` — shell (flex h-screen, Sidebar + scroll main).
- `components/Sidebar.tsx` — collapsible `w-60`/`w-[72px]`, brand block, NavLink
  list (Dashboard, Conteúdos, Calendário, Clientes, Equipe), user + "Sair".
- `components/Breadcrumb.tsx` — crumb nav with chevron separators.
- `components/StatusPill.tsx` — round pill + dot, 7 statuses.
- `components/common.tsx` — `PageHeader`, `Card`/`CardCompact`/`CardFlush`,
  `Spinner`, `EmptyState`, `ErrorState`, `MediaPreview`, `KpiCard`.
- `components/Icons.tsx` — custom stroke SVG set (strokeWidth 1.8). **No
  Lucide/Heroicons dependency.**

Component gap matrix (current → Figma):

| Figma component | Current equivalent | Gap |
| --- | --- | --- |
| Buttons | `.btn*` (pill 9999px) | Restyle radius to Figma |
| Inputs | `.input` | Restyle focus/border to Figma |
| Cards | `Card*` + `.card` | Restyle radius/shadow/border |
| Status tokens | `StatusPill` | Re-map colors to Figma tokens |
| Avatars | Team initials / client monogram | Align to Figma avatar |
| Calendar cell | Calendar cell | Align to Figma calendar |
| Kanban card | ContentsList `CardStack` | Align to Figma board card |
| Sidebar item | NavLink items | Align to Figma (272px) |
| Topbar | **missing** | **NEW** — add 72px topbar |
| Bottom-nav (mobile) | **missing** | **NEW** — F16 |
| Toast/alert | error banners inline | Align to Figma alert |
| Dropdown | native `<select>` | Evaluate Figma dropdown (F1/F2) |
| Empty state | `EmptyState` | Align visuals |
| Modal | inline expand/collapse | Evaluate Figma modal (F1/F2) |
| Media frame | `MediaPreview` | Align to Figma media |

---

## App Shell Gap

Current shell (`AppLayout` + `Sidebar`):

- Sidebar 240px (`w-60`), collapses to 72px icons via `useUIStore`.
- Brand block at top of sidebar with inline SVG logo.
- Nav: Dashboard, Conteúdos, Calendário, Clientes, Equipe (matches the
  hard-coded sidebar spec — no Integrations).
- User name + "Sair" (logout) in sidebar footer.
- **No topbar.**

Figma shell:

- Sidebar 272px + topbar 72px @1440×960.
- Mobile 390×844 with bottom navigation.

**F1 scope:** resize sidebar to 272px, introduce 72px topbar (breadcrumb / page
title / user menu), preserve collapse behavior and `useUIStore` contract.

---

## Page Gap Matrix

| Page | Route | Current (verified) | Figma page | Gap |
| --- | --- | --- | --- | --- |
| Login | `/login` | centered white card, neutral-900 button | auth frame | MERGE |
| Dashboard | `/dashboard` | greeting + attention card + 4 compact metrics + 3/2 asymmetric grid | dashboard | MERGE |
| Contents board | `/contents` | 7-col kanban + client filter + DnD grouping | board/table | MERGE |
| New content | `/contents/new` | 3-col form grid + side details/actions | create form | MERGE |
| Content detail | `/contents/:id` | 3/2 grid: preview, metadata, versions, actions | detail page | MERGE |
| Calendar | `/calendar` | month grid + legend | calendar | MERGE |
| Clients | `/clients` | 3-col cards + inline create form | clients page | MERGE |
| Team | `/team` | 3-col cards + inline create form | team page | MERGE |
| Public approval | `/approve/:token` | public brand-header + content + approve/change actions | public approval | MERGE |
| `*` | `*` | → `/dashboard` redirect | — | keep |

---

## Functional Preservation Contracts (must survive the restyle)

- **Routing:** all routes in `App.tsx` unchanged; `/approve/:token` stays
  outside the internal shell.
- **Data layer:** TanStack Query hooks in `lib/api.ts` (credentials-include
  `apiFetch`, `Retry-After` 429 handling, `ApiError`) untouched.
- **Auth:** `ProtectedRoute` session gate + Login redirect flow unchanged.
- **Local state:** `useUIStore` (zustand) sidebar collapse contract unchanged;
  `useStore`-backed UI only.
- **Workflow:** status transition endpoints + drag grouping (500ms hold,
  `groupContent`) unchanged — the `ContentsList` DnD semantics are functional
  authority and must be preserved verbatim.
- **Pure helpers:** `lib/format.ts` (pt-BR labels/dates), `lib/workspace.ts`
  (capability UX helpers), `lib/types.ts` mirrored types — unchanged.
- **Copy:** all Portuguese UI copy preserved unless F-design copy differs and
  F1 explicitly adopts it.

---

## Dirty-File Protection

F0 is read-only; the following pre-existing dirty files were **not touched**:

- Modified (14): `components/Icons.tsx`, `Sidebar.tsx`, `StatusPill.tsx`,
  `common.tsx`; `features/Calendar.tsx`, `Clients.tsx`, `ContentDetail.tsx`,
  `Dashboard.tsx`, `NewContent.tsx`, `PublicApproval.tsx`, `Team.tsx`;
  `index.css`; `tailwind.config.js`; `.dev-reports/looply-contents-card-grouping.md`.
- Untracked (7): `.dev-reports/demo-v1-*.md` ×4, `.env.backup.20260813-132904`,
  `ecosystem.config.cjs`, `package-lock.json`.

Verification: `git diff --cached --name-only` is empty (FRONTEND_DIRTY_STAGED=NO);
`git status --short` matches the pre-session baseline exactly.

---

## Asset & Icon Strategy

- Current icons are hand-authored inline SVG (stroke 1.8, `Icons.tsx`) — no icon
  package dependency. F1 should **re-derive** icon paths from Figma glyphs into
  the same local `Icons.tsx` (keep zero-dependency approach; avoid adding an icon
  library).
- Logo: inline SVG in `Sidebar.tsx` brand block; Figma brand lockup should be
  ported as inline SVG (no image asset required unless Figma specifies one).
- No external font-loading is wired today; Manrope adoption (G5) must ship the
  font (Google Fonts `@fontsource` or CDN) as part of F1.

---

## Responsive & Accessibility Gaps

- **Responsive (G16):** desktop 1440×960 and mobile 390×844 are the two Figma
  frames. Current app is desktop-first with stacking grids; mobile bottom-nav is
  **missing** → F16.
- **Calendar:** cells render at `min-h-[90px]`, truncate chips; acceptable, align
  to Figma cell.
- **Kanban:** 7 fixed columns `grid-cols-7` with `calc(100vh - 200px)` min-height
  — desktop-only by design; confirm Figma behavior on mobile.
- **A11y:** current code uses `aria-label` on icon buttons (calendar nav, client
  filter), `aria-label` on calendar month nav, focus-visible rings on buttons,
  form labels on all inputs. Gaps to close in F1+: focus ring colors must follow
  new brand tokens; color contrast of coral `#F06D55` on white must be checked
  against AA for text; status conveyed by color must keep the label text
  (already present in `StatusPill`); DnD (ContentsList) needs a keyboard
  alternative (existing gap, non-blocking for F1 restyle).

---

## Migration Battery Plan (F1+)

| # | Work | Scope |
| --- | --- | --- |
| F1 | Token replacement (brand/neutral/canvas/radius/font) | `index.css` + `tailwind.config.js` + semantic re-map |
| F2 | Button/input/form primitives restyle | `.btn*`, `.input`, `.label` |
| F3 | Card + status pill + empty/error/loading states | `common.tsx`, `StatusPill.tsx` |
| F4 | Icon set re-derivation from Figma | `Icons.tsx` |
| F5 | App shell: 272px sidebar + 72px topbar | `AppLayout.tsx`, `Sidebar.tsx`, new `Topbar` |
| F6 | Login page restyle | `Login.tsx` |
| F7 | Dashboard composition | `Dashboard.tsx` |
| F8 | Contents board + DnD restyle (semantics unchanged) | `ContentsList.tsx` |
| F9 | New content form restyle | `NewContent.tsx` |
| F10 | Content detail + approval link restyle | `ContentDetail.tsx` |
| F11 | Calendar restyle | `Calendar.tsx` |
| F12 | Clients page restyle | `Clients.tsx` |
| F13 | Team page restyle | `Team.tsx` |
| F14 | Public approval restyle | `PublicApproval.tsx` |
| F15 | Tokens/a11y/contrast pass + test suite re-run | global |
| F16 | Mobile: 390×844 bottom-nav responsive pass | `AppLayout.tsx`/shell |

**Dependency order:** F1 → F2 → F3 → F4 → F5 → (F6–F14 in any order) → F15 →
F16.

---

## Visual Validation Plan (F1+)

1. `npm --prefix frontend run typecheck && npm --prefix frontend run test` after
   every F-step (baseline: 32 passing).
2. `npm --prefix frontend run build` (production) after every F-step.
3. Side-by-side screenshot comparison per Figma frame at 1440×960 and 390×844.
4. Contrast spot-check for `#F06D55`-based text and `#FFF7F1` backgrounds.
5. Final: full route walkthrough (all 9 routes) with a seeded DB, verifying no
   functional regression.

---

## Non-Goals

- No functional/state/query/router/API changes in F1+ (restyle only).
- No new UI libraries (no icon lib, no component lib) without explicit approval.
- No Figma-generated code copied into the repo verbatim.
- No backend changes, DB commands, migrations, deploys, or pushes in F0.

---

## Security Review (F0, read-only)

- No new dependencies; build/test run locally; no secrets touched.
- Existing client keeps `credentials: "include"`; no auth changes.
- No external asset URLs introduced (icons remain local inline SVG).
- Noted: `NODE_ENV=production` present in frontend env file triggers a Vite
  build warning — cosmetic, non-blocking, out of F0 scope.

---

## Performance Review (F0, read-only)

- Bundle: `dist/assets/index-*.js` 348.43 kB raw / 103.64 kB gzip; CSS 35 kB /
  6.93 kB. Acceptable for Demo V1; no code-splitting today (single route chunk).
- Calendar/dashboard derive maps with `useMemo` on query data — no N+1 concern
  (single list endpoints).
- DnD grouping uses refs + timers, no per-frame state churn beyond drop targets.
- No action needed in F0.

---

## Baseline Test Report (captured for F0)

- Frontend typecheck (`tsc --noEmit`): **PASS** (no output, exit 0).
- Frontend unit tests (`vitest run`): **32 passed** (3 files) — apiClient 20,
  workspace 7, format 5.
- Frontend build (`vite build`): **PASS** (109 modules; js 103.64 kB gzip; CSS
  6.93 kB gzip). Warning: `NODE_ENV=production` in `.env` (cosmetic).
- Backend: **not run** in F0 (no backend changes; prior baseline 271 passing).

---

## Definition of Ready for F1

- [x] F0 audit report committed (this file).
- [x] Baseline HEAD recorded: `979c423f213cacba3193209f4b951276dea4a86c`.
- [x] Token/component/page gap matrices documented (above).
- [x] Functional preservation contracts documented (above).
- [x] Dirty-file protection verified (no F0 changes to app code).
- [x] Migration battery (F1–F16) + dependency order defined.
- [x] Visual validation + test gates defined.
- [ ] **F1 starts only on an explicit user request** (restyle execution is out
  of F0 scope).

---

## Final Status

`F0 FIGMA FRONTEND AUDIT — PASS`