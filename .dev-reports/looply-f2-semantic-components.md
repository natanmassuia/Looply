# F2 — Semantic Component Foundation

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **Baseline HEAD:** `6c5e1ecf30928959fb0d8714c6fd2725ae5fb7a7` (`feat(v1): finalize semantic theme contract`)
- **Worktree:** intentionally dirty (pre-existing demo-v1-polish redesign of feature components + `Icons.tsx`, `Sidebar.tsx`, `StatusPill.tsx`, `common.tsx`).
- **F1 state:** `frontend/src/index.css` and `frontend/src/tests/theme.test.tsx` are committed at baseline. The six required contract aliases and the 19-role semantic runtime are intact.
- **Pre-existing dirty files** (from session-start `git status --short`, unchanged set): `.dev-reports/looply-contents-card-grouping.md`, `frontend/src/components/Icons.tsx`, `Sidebar.tsx`, `StatusPill.tsx`, `common.tsx`, all `frontend/src/features/*.tsx` (Calendar, Clients, ContentDetail, Dashboard, NewContent, PublicApproval, Team), plus untracked `.dev-reports/demo-v1-*.md`, `.env.backup.*`, `ecosystem.config.cjs`, `package-lock.json`.

## Tooling Evidence

- **AI Memory MCP:** queried at start for Looply frontend/theme migration decisions. Recovered the F1 → F2 chain (F1 runtime contract committed at `6c5e1ec`), the legacy-bridge design (index.css maps `--looply-*` → semantic roles for dirty screens), and the dirty-worktree-preservation rule. Repository evidence (committed code) is authoritative; memory snippets only guided.
- **Serena MCP:** inspected the shared component layer before editing — `common.tsx`, `StatusPill.tsx`, `Breadcrumb.tsx`, `Icons.tsx`, `Sidebar.tsx`, `AppLayout.tsx`, `index.css`, `tailwind.config.js`, `theme/types.ts`, `lib/format.ts`, `test/utils.tsx`, `tests/theme.test.tsx`, `tests/format.test.tsx`, `package.json`, `vitest.config.ts`, `vite.config.ts`.
- **Context7 MCP:** not needed — Tailwind arbitrary `var()`/`color-mix()` classes, `@testing-library/react` rendering, and Vitest patterns used are standard and verified against committed code.
- **RTK:** all Git/shell commands routed through `rtk`.
- **Skills:** caveman (loaded, applied — minimal diff, no new abstractions); security-audit (reasoned — no user input reaches CSS classes here; no injection surface; see Code Review). Ponytail **lite** active throughout.
- **Forbidden skills** (ui-polish, ui-ux-pro-max, design-motion-principles, ux-writing-skill): not used. Kore-specific skills: not used (not product-agnostic).

## Existing Component Architecture

Shared primitives with real reuse across screens:

- **`common.tsx`** (React): `PageHeader`, `Card`, `CardCompact`, `CardFlush`, `Spinner`, `EmptyState`, `ErrorState`, `MediaPreview`, `KpiCard`. Consumed by Calendar, Clients, ContentDetail, ContentsList, Dashboard, NewContent, PublicApproval, Team.
- **`Breadcrumb.tsx`** (React): rendered by `PageHeader` crumbs on every screen.
- **`StatusPill.tsx`** (React): workflow status pill; colors are **data-driven** per status (`STATUS_STYLE`/`statusDot` in `lib/format.ts`) — intentionally not converted (task rule: "Do not convert intentional data-driven colors").
- **`Icons.tsx`** (React): stroke icons, `currentColor` only — no color tokens to migrate.
- **`Sidebar.tsx`** / **`AppLayout.tsx`**: App Shell / navigation — **out of scope** ("Do NOT redesign App Shell, change navigation").
- **`index.css`** component classes: `.card`, `.card-elevated`, `.btn*` (variants/sizes), `.input` (input/textarea/select), `.label`, `.section-title`, `.section-label`, `.status-pill`. These are the CSS-side primitives; before F2 they consumed legacy `--looply-*` aliases.

F1 semantic roles available (canonical `--looply-color-*`): bg-canvas/surface/subtle/elevated, text-primary/secondary/muted/inverse/brand, border-default/brand, action-primary(+hover/active)/secondary, focus-ring, status-success/warning/danger/info, plus contract aliases `--looply-color-accent/success/warning/danger/focus` and `--looply-color-bg-elevated`.

## Dirty Collision Map

| File | HEAD state | Existing dirty concern | F2 change | Classification |
|---|---|---|---|---|
| `frontend/src/index.css` | F1 contract committed | — (clean at baseline) | Component primitives (`body`, `*`, `.card`, `.card-elevated`, `.btn*`, `.input`, `.label`, `.section-*`) switched from legacy `--looply-*` aliases / raw `#fff` / blue `rgba()` shadows to canonical semantic tokens; focus rings now `--looply-color-focus` | `F2_CHANGED` |
| `frontend/src/components/common.tsx` | legacy aliases | Redesign hunks (sizes, `CardFlush`, EmptyState icon, `MediaPreview` format, gradient) | Legacy aliases inside those primitives replaced with semantic tokens; Spinner `text-brand-600` → `--looply-color-action-primary`; ErrorState `--looply-danger-bg` → `color-mix` of `--looply-color-status-danger` over `--looply-color-bg-surface` | `F2_CHANGED_ON_PRE_EXISTING_DIRTY` |
| `frontend/src/components/Breadcrumb.tsx` | legacy aliases | — (clean at baseline) | Legacy aliases + `hover:text-brand-600` → semantic tokens | `F2_CHANGED` |
| `frontend/src/components/StatusPill.tsx` | `.status-pill` class | Data-driven status colors | None (data-driven, explicitly preserved) | `UNTOUCHED_PRE_EXISTING_DIRTY` |
| `frontend/src/components/Icons.tsx` | currentColor icons | Added icons + size tweak | None | `UNTOUCHED_PRE_EXISTING_DIRTY` |
| `frontend/src/components/Sidebar.tsx` | sidebar palette | Collapse + nav polish | None (App Shell — out of scope) | `UNTOUCHED_PRE_EXISTING_DIRTY` |
| All `frontend/src/features/*.tsx` | — | Redesign hunks | None (zero screen edits) | `UNTOUCHED_PRE_EXISTING_DIRTY` |

Preservation strategy: no `git reset/stash/clean/checkout/restore`, no branch switch, no `git add .`/`-A`. F2 edits applied surgically on the current worktree; pre-existing hunks preserved byte-for-byte.

## Components Migrated

- **CSS primitives** (`index.css`): `body` (canvas/text), universal `border-color` (border-default), `.card` (bg-surface/border-default), `.card-elevated` (bg-elevated/border-default), `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`/`.btn-danger` (action/status tokens + `--looply-color-focus` rings + `--looply-color-text-inverse` for primary/danger text), `.input`/`.input:focus`/`.input:disabled`/`::placeholder` (surface/border/action/focus/text), `.label` (text-primary), `.section-title`/`.section-label` (text-primary/text-muted).
- **React primitives** (`common.tsx`): `PageHeader`, `Spinner`, `EmptyState`, `ErrorState`, `MediaPreview` placeholder, `KpiCard` — all legacy aliases → semantic tokens. Component APIs unchanged (same props, same exports).
- **`Breadcrumb.tsx`**: legacy aliases → semantic tokens; link hover `text-brand-600` → `--looply-color-text-brand`.

## Semantic Token Usage

- **Background:** `--looply-color-bg-canvas`, `--looply-color-bg-surface`, `--looply-color-bg-subtle`, `--looply-color-bg-elevated`.
- **Text:** `--looply-color-text-primary`, `--looply-color-text-muted`, `--looply-color-text-inverse`, `--looply-color-text-brand`.
- **Actions:** `--looply-color-action-primary` (+`-hover`/`-active`).
- **State:** `--looply-color-status-danger`.
- **Structure:** `--looply-color-border-default`, `--looply-color-focus`.

No raw palette colors introduced. One intentional data-driven exception preserved: StatusPill per-status colors. One deliberate kept value: `.btn-danger:hover` background `#b91c1c` (no semantic danger-hover role exists; F1 runtime has no danger-hover token — noted, not churned).

## API Compatibility

All shared component props and exports preserved: `PageHeader` (title/subtitle/crumbs/actions), `Card`/`CardCompact`/`CardFlush` (children/className), `Spinner` (label), `EmptyState` (title/description/action/icon), `ErrorState` (message), `MediaPreview` (url/alt/className/format), `KpiCard` (label/value/accent/href), `StatusPill` (status), `Breadcrumb` (items). CSS class names (`.btn-*`, `.input`, `.card`, etc.) unchanged. Zero feature-screen edits required.

## Files Modified

- `frontend/src/index.css` — component primitives → semantic tokens (+test-locked contract block untouched).
- `frontend/src/components/common.tsx` — legacy aliases → semantic tokens (on pre-existing dirty).
- `frontend/src/components/Breadcrumb.tsx` — legacy aliases → semantic tokens.
- `frontend/src/tests/components.test.tsx` — **new** focused component-contract tests.

## Pre-existing Dirty Preservation

Verified identical pre/post for all untouched dirty files (feature screens, `Icons.tsx`, `Sidebar.tsx`, `StatusPill.tsx`, `.dev-reports/looply-contents-card-grouping.md`, untracked files). The two files F2 touched that were already dirty (`common.tsx`) had their pre-existing hunks preserved and only the alias strings swapped inside them.

## Tests

`npm --prefix frontend run test` → **95 passing** (5 files; baseline 87 + 8 new).

New `components.test.tsx` locks the F2 contract:
- `common.tsx` and `Breadcrumb.tsx` never reference a legacy `--looply-*` alias.
- Rendered shared primitives emit only semantic tokens (`--looply-color-*`) and no legacy alias.
- `.card`/`.card-elevated`/`.btn-*`/`.input`/`.label` in `index.css` read semantic tokens.
- focus (`--looply-color-focus`) and disabled (`opacity: 0.5`) states remain defined.
- StatusPill keeps its data-driven per-status colors and renders its label.

## Typecheck

`npm --prefix frontend run typecheck` → **PASS** (`tsc --noEmit`).

## Build

`npm --prefix frontend run build` (`tsc --noEmit && vite build`) → **PASS** (115 modules, dist emitted).

## Code Review

- **Correctness:** F1 contract block (six aliases, 19-role runtime, AURA dark override) untouched; verified via `git diff` and by the 55 committed theme tests still passing against the same `index.css`.
- **Semantic correctness:** `--looply-color-focus` now drives all focus rings (was `--looply-primary-subtle`), matching the F1 focus role. Primary/danger button text uses `--looply-color-text-inverse` instead of raw `#fff`. ErrorState background derives from `--looply-color-status-danger` via `color-mix` over `--looply-color-bg-surface`, so it stays adaptive in DARK instead of the light-only `--looply-danger-bg`.
- **LIGHT/DARK compatibility:** all migrated primitives read runtime CSS variables, so both modes (and all presets) resolve through the same tokens; the theme runtime tests continue to pass.
- **Security:** no user-controlled strings flow into `className` here; StatusPill status comes from a typed enum; `color-mix`/`var()` are inert CSS. No injection, no secrets.
- **Scope:** no page redesign, no backend, no new dependency, no App Shell/navigation change, no speculative abstraction.

## Ponytail Lite Review

- **Speculative abstractions:** none — no new wrapper, no Button/Input React components fabricated; migrated existing CSS + React primitives in place.
- **Duplicated primitives:** none introduced; `Card`/`CardCompact`/`CardFlush` share `.card` (pre-existing).
- **Avoidable API changes:** none — all props/classes preserved.
- **Raw colors that should be semantic:** fixed — Spinner `text-brand-600`, button `#fff`, blue `rgba(37,99,235,…)` shadows, legacy text/surface aliases. Remaining raw `#b91c1c` (danger hover) and StatusPill per-status palette are intentional/data-driven with no F1 semantic equivalent.
- **F3+ scope leakage:** none — no feature files touched.
- **Deliberate simplification kept:** ErrorState danger tint expressed as a one-line `color-mix` instead of a new semantic token; the F1 runtime is untouched so no runtime change was needed.

## Remaining Legacy Component Work

- `Sidebar.tsx` / `AppLayout.tsx` (App Shell) still use the legacy `sidebar-*` palette and raw `neutral-*`/`slate-*` classes — intentionally out of F2 scope (F3+ app-shell pass).
- `Icons.tsx` is color-neutral (`currentColor`) — nothing to migrate.
- StatusPill per-status palette remains data-driven by design.
- `.btn-danger:hover` uses raw `#b91c1c` because no danger-hover semantic token exists (would need an F12/contract addition).
- Feature screens still reference legacy `--looply-*` aliases inline (their F3+ migration builds on the migrated shared primitives).

## Git Status

```
 M .dev-reports/looply-contents-card-grouping.md            PRE_EXISTING_DIRTY
 M frontend/src/components/Breadcrumb.tsx                   F2_CHANGED
 M frontend/src/components/Icons.tsx                        UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/components/Sidebar.tsx                      UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/components/StatusPill.tsx                   UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/components/common.tsx                       F2_CHANGED_ON_PRE_EXISTING_DIRTY
 M frontend/src/features/*.tsx (7 files)                    UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/index.css                                   F2_CHANGED
?? frontend/src/tests/components.test.tsx                   F2_ADDED (new test file)
?? .dev-reports/demo-v1-*.md, .env.backup.*, ecosystem.config.cjs, package-lock.json   PRE_EXISTING_UNTRACKED
```

Nothing staged. Nothing committed.

## Final Status

F2 IMPLEMENTATION — READY FOR REVIEW
