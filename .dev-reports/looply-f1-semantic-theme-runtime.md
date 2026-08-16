# F1 — Semantic + Theme Runtime

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **Baseline HEAD:** `57644b2e2dd95ba43ba46a562810c77b25d5de7c` (`feat(v1): add semantic theme runtime`)
- **Worktree:** intentionally dirty (pre-existing demo-v1-polish redesign of feature components).
- **Key discovery:** the baseline HEAD **already contains** the F1 semantic theme runtime (committed as `57644b2`). This session's role was verification against the F1 contract, closing the one genuine gap (required token *names* not declared), validation, mandatory reviews, and this report. No re-implementation — the worktree state was preserved exactly.

## MCP / Tooling Evidence

- **AI Memory MCP:** queried at session start for Looply decisions on F1 / appearance runtime / frontend migration / dirty-worktree preservation. Recovered the BP1 → F1 chain (commit `00da9b8 feat(v1): persist workspace appearance`, `57644b2 feat(v1): add semantic theme runtime`), the F1 runtime requirements prompt text, and the dirty-worktree-preservation rule (`FRONTEND_DIRTY_STAGED=NO`, pre-existing unstaged files untouched). **Repository evidence (the committed baseline) wins** where memory snippets were partial.
- **Serena MCP:** used for all pre-edit inspection — `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/src/theme/*` (types, presets, resolveTheme, applyTheme, react, color, typography), `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, `frontend/src/tests/theme.test.tsx`, `frontend/src/test/utils.tsx`. No subagent named Serena was created.
- **Context7 MCP:** not needed — React / TanStack Query / Tailwind / Vite behavior in use (provider effect, shared `["me"]` query, `var()` aliasing, CSS-in-`@layer`) is standard and was verified directly against the committed code.
- **RTK:** all Git/shell commands routed through `rtk`.

## Skills Used

- **caveman** — loaded and applied: no new abstractions, minimal diff, explicit over DRY where clarity wins.
- **code-review** — not present in the installed skill registry; performed as a manual code review of the theme module (see Code Review).
- **security-audit** — loaded and applied to the theme runtime (see Security Audit). Findings: none.
- **kore-\*** — inspected `kore-fix`, `kore-validate`, `kore-report`. They mandate Kore-specific tooling (`node scripts/agent-*.mjs`) and tiers — not product-agnostic. Per the task rule, **not used**; no Kore paths/rules affected Looply.
- **ponytail (lite)** — active throughout; lite-mode review at the end (see Ponytail Lite Review).
- **performance-audit** — not needed: theme application is O(19) `setProperty` calls on a memoized effect; no real runtime performance concern.
- **Forbidden skills** (ui-polish, ui-ux-pro-max, design-motion-principles, ux-writing-skill) — not used.

## Existing Theme Architecture (as committed at baseline)

The baseline already shipped a complete, tested theme runtime:

- **`frontend/src/theme/types.ts`** — single vocabulary: 19 `SEMANTIC_TOKEN_IDS`, `TOKEN_CSS_VARS` (the only CSS var map the applier may write), `BRAND_TOKEN_CSS_VARS`, `ResolvedTheme`.
- **`frontend/src/theme/color.ts`** — pure hex/WCAG math (`isHexColor`, `hexToRgb`, `mix`, `lighten`/`darken`, `relativeLuminance`, `contrastRatio`, bounded `ensureContrast`).
- **`frontend/src/theme/presets.ts`** — brand base (figma 19:2), mode-dependent status tokens, AURA/FLUX/PULSE light+dark token sets, `resolvePresetTokens`.
- **`frontend/src/theme/resolveTheme.ts`** — `normalizeAppearance` (defensive coercion → AURA/LIGHT), `resolveTheme`, `resolveCustomTheme` (six colors → 19 roles with contrast correction).
- **`frontend/src/theme/applyTheme.ts`** — `applyTheme` sets `data-looply-theme`/`data-looply-mode` + only allowlisted vars; `resetTheme` restores the static startup state.
- **`frontend/src/theme/react.tsx`** — `ThemeProvider` (apply effect + unmount reset), `useTheme`, `useWorkspaceAppearance` (from shared `["me"]` query — no extra request).
- **`frontend/src/theme/typography.ts`** — Manrope type ramp as JS contract (pre-existing at baseline; committed test references it).
- **`frontend/src/index.css`** — static AURA/LIGHT `:root`, AURA-dark override, legacy `--looply-*` aliases, shape/shadow/spacing/elevation foundation tokens, `.typo-*` utilities, Manrope body font, `color-scheme`.
- **`frontend/tailwind.config.js`** — `canvas`/`foreground`/`muted`/`primary` mapped to semantic vars; Manrope-first `fontFamily.sans`.
- **`frontend/src/App.tsx`** — `ThemeProvider` mounted inside `ProtectedRoute` (public pages keep static AURA/LIGHT).
- **`frontend/src/tests/theme.test.tsx`** — 53 resolver/apply/hydration/contract tests (85 total frontend at baseline).

## Implemented Architecture

The task contract required exact token *names* the committed runtime did not declare:

- `--looply-color-bg-elevated`
- `--looply-color-accent`
- `--looply-color-success`
- `--looply-color-warning`
- `--looply-color-danger`
- `--looply-color-focus`

The runtime covered these **concepts** under canonical names (`bg-surface`, `action-secondary`, `status-*`, `focus-ring`). The fix (this session, minimal):

- **`frontend/src/index.css`** (+11 lines): declared the six required names as `var()` aliases to their canonical roles inside `:root`. Because custom-property aliases resolve at *computed-value* time per element, the inline overrides `applyTheme` writes on `<html>` propagate through the alias chain automatically — no runtime code change needed, and `resetTheme` restores the static aliases with it.
- **`frontend/src/tests/theme.test.tsx`** (+34 lines): two tests locking the required contract names — (1) every required token name is declared in `index.css`; (2) each alias resolves to its canonical role.

Everything else in the runtime, resolver, provider, legacy bridge, and tailwind config was already correct and was **left untouched**.

## Semantic Token Contract

Canonical runtime tokens (`TOKEN_CSS_VARS`, the only vars the applier writes):

`--looply-color-bg-canvas`, `--looply-color-bg-surface`, `--looply-color-bg-subtle`, `--looply-color-text-primary`, `--looply-color-text-secondary`, `--looply-color-text-muted`, `--looply-color-text-inverse`, `--looply-color-text-brand`, `--looply-color-border-default`, `--looply-color-border-brand`, `--looply-color-action-primary`, `--looply-color-action-primary-hover`, `--looply-color-action-primary-active`, `--looply-color-action-secondary`, `--looply-color-focus-ring`, `--looply-color-status-success`, `--looply-color-status-warning`, `--looply-color-status-danger`, `--looply-color-status-info`.

Required contract names now declared as aliases (this session):

`--looply-color-bg-elevated` → `var(--looply-color-bg-surface)`, `--looply-color-accent` → `var(--looply-color-action-secondary)`, `--looply-color-success` → `var(--looply-color-status-success)`, `--looply-color-warning` → `var(--looply-color-status-warning)`, `--looply-color-danger` → `var(--looply-color-status-danger)`, `--looply-color-focus` → `var(--looply-color-focus-ring)`.

The task's required set (bg-canvas, bg-surface, bg-elevated, text-primary/secondary/muted, border-default, action-primary/secondary, accent, success, warning, danger, focus) is fully covered.

## Preset Matrix

| Preset | LIGHT | DARK |
|---|---|---|
| AURA | canonical cream canvas `#FFF7F1`, coral primary | profundidade aubergine `#2A171F` canvas |
| FLUX | warm amber-forward derivation | warm dark derivation |
| PULSE | aubergine-forward high-contrast | aubergine-forward dark |
| CUSTOM | six-color derivation, mode-adjusted | six-color derivation, mode-adjusted |

FLUX/PULSE are documented provisional derivations (F12 reconciles against the Figma variable set). Status roles are preset-independent; only mode shifts their luminance.

## Custom Resolution

- Six inputs (`primary`, `secondary`, `accent`, `surface`, `text`, `border`) → 19 semantic roles via `resolveCustomTheme`.
- Validation: `normalizeAppearance` accepts CUSTOM **only** when the full six-color set is valid `#RRGGBB`; otherwise it collapses deterministically to AURA/LIGHT. **Partial CUSTOM configuration cannot break runtime.**
- `surface` trusted verbatim; `canvas`/`subtle` derived by mixing toward brand; text/action/border roles contrast-corrected against both canvas and surface with a bounded (≤12 steps) deterministic loop and hard fallback — invalid/pathological palettes resolve safely and never throw.
- Input never mutated; outputs always uppercase hex; pure and unit-tested.

## React Runtime

- `ThemeProvider` reads `useMe()` (shared `["me"]` TanStack Query — no extra request) → `workspace.appearance` → `normalizeAppearance` → `resolveTheme` → `applyTheme(document.documentElement, …)` on a memoized effect.
- Sets `data-looply-theme` + `data-looply-mode` (lowercase enum values) and the 19 allowlisted CSS vars on `<html>`.
- Reacts to appearance changes (query data change → effect re-run).
- Cleans up on unmount via `resetTheme` (logout/route-away → static AURA/LIGHT restored; no stale custom theme).
- Public routes (Login, PublicApproval) render outside the provider → safe AURA/LIGHT default.
- No boot-time settings request, no `useAppearanceSettings`, no `useUpdateAppearance`, no appearance-settings UI, no F11 work.

## Legacy Bridge

- `index.css` maps legacy `--looply-*` variables → semantic roles (`--looply-background` → `--looply-color-bg-canvas`, `--looply-surface` → `--looply-color-bg-surface`, `--looply-primary*`, `--looply-success/warning/danger*`, etc.), so all existing dirty feature screens keep rendering without edits.
- No feature/component files were edited to consume semantic tokens (F2 scope). Old aliases preserved verbatim.

## Files Created

None. All runtime files already existed at baseline HEAD. The two modified files are listed below.

## Files Modified

- `frontend/src/index.css` (+11) — declared the six required contract token names as `var()` aliases to canonical roles.
- `frontend/src/tests/theme.test.tsx` (+34) — contract-name tests (declaration + alias resolution).

## Pre-existing Dirty Files Preserved

Unchanged (verified identical pre/post via baseline `git status --short` + `git diff -- frontend`):

- `.dev-reports/looply-contents-card-grouping.md`
- `frontend/src/components/Icons.tsx`, `Sidebar.tsx`, `StatusPill.tsx`, `common.tsx`
- `frontend/src/features/Calendar.tsx`, `Clients.tsx`, `ContentDetail.tsx`, `Dashboard.tsx`, `NewContent.tsx`, `PublicApproval.tsx`, `Team.tsx`

Untracked pre-existing files also untouched: `.dev-reports/demo-v1-{features,final-acceptance,polish,visual-redesign}.md`, `.env.backup.20260813-132904`, `Use`, `ecosystem.config.cjs`, `package-lock.json`.

No `git reset` / `stash` / `clean` / `checkout -- .` / `restore` / branch switch / `git add .` / `-A` was ever run. Nothing staged or committed.

## Tests

`npm --prefix frontend run test` → **87 passing** (4 files; baseline 85 + 2 new). Required resolver cases covered:

- AURA LIGHT / AURA DARK (canonical canvas/aubergine)
- FLUX LIGHT / FLUX DARK (determinism)
- PULSE LIGHT / PULSE DARK (aubergine-forward determinism)
- CUSTOM LIGHT / CUSTOM DARK (six-color derivation, mode-adjusted status)
- partial CUSTOM (collapses to AURA)
- invalid custom colors (collapses to AURA; malformed payloads)
- deterministic fallback (non-object/unknown preset/bad mode → AURA/LIGHT; pathological palette resolves deterministically)

DOM application tested: allowlist-only writes, no arbitrary properties, no accumulation, lowercase attributes, reset on unmount, hydration from session appearance, no extra network request.

## Typecheck

`npm --prefix frontend run typecheck` → **PASS** (`tsc --noEmit`).

## Build

`npm --prefix frontend run build` (`tsc --noEmit && vite build`) → **PASS** (115 modules, dist assets emitted).

## Code Review

Manual review of the theme module (no `code-review` skill installed):

- **Correctness:** resolver pure and deterministic; applier iterates the allowlist only; provider effect deps memoized; unmount resets. `var()` aliases resolve at computed-value time, so runtime overrides propagate — verified by tests.
- **Ponytail-lite concerns on the committed baseline:** `typography.ts` and `color.ts` are pre-existing baseline files referenced by committed tests; removing them would break the baseline and is out of scope. No new abstractions added this session.
- **Scope:** diff is exactly `index.css` (+11) and `theme.test.tsx` (+34). No F2+ leakage, no feature-screen edits, no dead API hooks.
- **Duplicate concepts:** the six new aliases deliberately *reference* canonical roles rather than duplicating color values — no divergent second source of truth.

## Security Audit

Scope: theme runtime (`theme/*`, `index.css` runtime block, `react.tsx`). OWASP-aligned checklist:

| Finding | Verdict |
|---|---|
| CSS custom-property injection via payload keys | Not possible — applier iterates the allowlist only (test "ignores unknown keys") |
| Attribute injection (`data-looply-*`) | Not possible — values are enum-derived lowercase (preset/mode validated before apply) |
| Unvalidated server object → CSS | `normalizeAppearance` coerces unknown/malformed → AURA/LIGHT; custom colors hex-gated |
| XSS / `innerHTML` / `eval` / `dangerouslySetInnerHTML` | Absent in theme module |
| Prototype pollution | Fixed-key reads only; no spread of user objects into shared state |
| Secrets / credentials | None touched or added |
| Tenant/theme confusion after logout | Reset on unmount; provider inside `ProtectedRoute`; public pages static |

**Findings: CRITICAL 0, HIGH 0, MEDIUM 0, LOW 0.**

## Ponytail Lite Review

- Overengineering: none introduced — the diff is 45 lines (aliases + contract tests). The committed runtime is already lean (19 tokens, one applier, one provider).
- Unnecessary files: none created; the two pre-existing helper files (`color.ts`, `typography.ts`) are baseline, referenced by tests, and were left alone.
- Speculative abstractions: none added; no future-use API hooks.
- Dead API code: none (`useAppearanceSettings`/`useUpdateAppearance` absent).
- F2+ scope leakage: none — no feature/component files touched.
- Duplicate theme concepts: the aliases reference canonical vars instead of duplicating values.
- Deliberate simplification kept: `var()`-alias approach means the required names are declared once in CSS rather than as runtime-written tokens — correct, smaller, and safe because aliases resolve at computed-value time.

## Runtime Validation

- LIGHT / DARK: verified by AURA static + AURA-dark override tests and per-preset resolver tests.
- AURA / FLUX / PULSE / CUSTOM: all preset×mode combinations resolve to a stable, complete 19-role set (tested).
- Persistence after reload: appearance flows from `GET /api/auth/me` → shared `["me"]` query; reload re-hydrates from server. No localStorage authority.
- Safe public/default fallback: public pages + null/malformed appearance → static AURA/LIGHT.
- Live DOM check: not run against a running server (no DB/deploy needed); DOM behavior covered by jsdom tests including hydration and reset.

## Remaining Limitations

- FLUX/PULSE preset values are provisional derivations — F12 reconciles them against the Figma variable set.
- Existing screens still use legacy `--looply-*` aliases / hardcoded colors; migration onto semantic roles is F2.
- No appearance-settings UI (out of scope by contract).

## Git Status

Final (vs baseline captured at session start — identical for all pre-existing entries):

```
 M .dev-reports/looply-contents-card-grouping.md      PRE_EXISTING_DIRTY
 M frontend/src/components/Icons.tsx                  PRE_EXISTING_DIRTY
 M frontend/src/components/Sidebar.tsx                PRE_EXISTING_DIRTY
 M frontend/src/components/StatusPill.tsx             PRE_EXISTING_DIRTY
 M frontend/src/components/common.tsx                 PRE_EXISTING_DIRTY
 M frontend/src/features/Calendar.tsx                 PRE_EXISTING_DIRTY
 M frontend/src/features/Clients.tsx                  PRE_EXISTING_DIRTY
 M frontend/src/features/ContentDetail.tsx            PRE_EXISTING_DIRTY
 M frontend/src/features/Dashboard.tsx                PRE_EXISTING_DIRTY
 M frontend/src/features/NewContent.tsx               PRE_EXISTING_DIRTY
 M frontend/src/features/PublicApproval.tsx           PRE_EXISTING_DIRTY
 M frontend/src/features/Team.tsx                     PRE_EXISTING_DIRTY
 M frontend/src/index.css                             F1_CHANGED
 M frontend/src/tests/theme.test.tsx                  F1_CHANGED
?? .dev-reports/demo-v1-*.md, .env.backup.*, Use, ecosystem.config.cjs, package-lock.json   PRE_EXISTING_UNTRACKED
```

Classification: `PRE_EXISTING_DIRTY` = all 12 pre-existing modified files (untouched, byte-identical). `F1_CHANGED` = the 2 files above. No pre-existing dirty file was modified by F1.

## Final Status

F1 IMPLEMENTATION — READY FOR REVIEW