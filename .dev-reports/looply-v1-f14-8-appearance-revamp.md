# Looply — V1-F14.8 Appearance Revamp

Date: 2026-08-18 · Branch: `main` · Worktree left dirty (no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          24c794020fd3371ac0f38ec153829905b8242634 (matches expected base)
RAM:                 ~1.6 Gi available (no RESOURCE_PRESSURE)
WORKTREE:            clean at start
KORE_TOUCHED:        NO
```

## Theme architecture discovered

- `src/theme/` is a complete, non-duplicated theme system:
  - `presets.ts` — AURA / FLUX / PULSE light+dark token sets + brand base (`BRAND`: aubergine `#2A171F`, coral `#F06D55`, amber `#F3B84B`, coral100/blush `#FFE3D7`, cream `#FFF7F1`).
  - `resolveTheme.ts` — `normalizeAppearance` + `resolveCustomTheme` (six-color derivation with deterministic WCAG contrast correction).
  - `types.ts` / `applyTheme.ts` — allowlisted semantic CSS variables written to `<html>` only; `resetTheme` on unmount.
  - `color.ts` — hex/contrast math.
  - `react.tsx` — `ThemeProvider` + `useWorkspaceAppearance` sourced from the authenticated session.
- Persistence is backend workspace-scoped (six canonical `#RRGGBB` keys on `Company`, `backend/src/domain/appearance.ts`); the frontend never invents a second theme system.
- `Settings.tsx` appearance tab already had live preview, preset grid, mode toggle, a six-field Customizado editor, and save.

## Root cause

- **Light mode**: the canonical AURA/FLUX/PULSE light tokens were already warm and deliberately tinted (cream canvas `#FFF7F1`, aubergine text, warm borders, near-white surfaces) — NOT a dark inversion. The custom light derivation also warms surfaces (canvas mixes surface with cream). The "looks like plain white / dark inversion" perception largely came from the **Customizado default palette** (pure white surface on plain canvas) and the editor lacking validation/normalization/restore.
- **Customizado "not functionally complete"**: the text HEX inputs accepted any string (no validation — `resolveTheme` silently fell back to AURA for invalid input, so edits could appear to do nothing or corrupt preview intent); there was no **Restaurar** (reset) action and no **Cancelar** (restore-persisted) action.

## Canonical token mapping (unchanged)

- App/page background → `--looply-color-bg-canvas` (cream, warm)
- Primary surface → `--looply-color-bg-surface` (near-white warm)
- Muted surface → `--looply-color-bg-subtle` (tinted)
- Elevated surface → `--looply-color-bg-elevated` (alias of surface)
- Border → `--looply-color-border-default` (warm aubergine-tinted)
- Primary text → `--looply-color-text-primary` (aubergine, never pure black)
- Accent → `--looply-color-action-secondary` (Amber), primary action → Coral
- Focus ring → `--looply-color-focus-ring`

No token names renamed; the existing system is preserved.

## Light-mode changes

- Confirmed the canonical presets already satisfy Human Relay light intent (warm tinted hierarchy, no pure-white monoculture at the canvas, no dark inversion). No token value changes were required — the presets are already correct by design.
- Custom light derivation is verified warm (canvas ≠ surface; surface can be white but canvas stays cream-tinted).

## Customizado behavior (implemented)

- **Editor**: selecting Customizado shows the six-field editor (already present).
- **HEX validation**: each text input now uses a per-field draft; only valid `#RRGGBB` commits to `customColors` (on blur/Enter) and is normalized uppercase. Invalid input is rejected with a clear error and never mutates the applied theme (prevents CSS corruption / silent AURA fallback).
- **Color picker**: retained native `<input type="color">` (no new dependency) per field, with accessible labels.
- **Live preview**: the existing `useEffect` applies `resolveTheme` on every `preset/mode/customColors` change — a valid picker/hex change previews immediately; nothing is persisted until Save.
- **Save**: reuses the existing `useUpdateSettingsAppearance` (PATCH `/api/settings/appearance`) with the six-color payload only for CUSTOM; runtime theme + `["me"]` cache update via the existing hook.
- **Cancelar** (new): restores `preset`, `mode`, and `customColors` to the last persisted `currentAppearance` values; discards drafts/errors.
- **Restaurar** (new): resets the six custom fields to the canonical AURA-derived `DEFAULT_CUSTOM` baseline without switching the preset.
- **Preset switching**: existing behavior preserved (custom colors omitted for non-CUSTOM; switching back to CUSTOM restores the persisted custom palette if one exists).

## Persistence / onboarding / isolation

- Workspace-scoped persistence is untouched (backend authority). One workspace cannot leak into another (existing server contract).
- Onboarding appearance writes through the same `updateAppearance` path; a Customizado config created in onboarding appears identically in Settings.
- Aura remains the default preset.

## Mobile / desktop

- Editor uses a responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; swatch + text input are inline with adequate touch targets; Save/Cancelar/Restaurar are reachable on the Settings sheet. No overflow introduced.
- Desktop keeps the compact Settings composition.

## Accessibility / contrast

- The theme runtime enforces deterministic contrast correction for custom palettes (primary text ≥4.5 on canvas+surface, etc. — already covered by existing theme tests).
- New controls are labeled buttons/inputs with visible focus states; the color picker and hex input each have accessible labels.
- Status colors retain their semantic meaning (success/warning/danger/info untouched).

## Files changed

```
frontend/src/features/Settings.tsx     HEX validation + normalization, Restaurar, Cancelar, labeled picker/hex
frontend/src/tests/settings.test.tsx   +5 Customizado functional tests (editor, validate, restore, cancel, normalized)
```

## Tests

- Focused: `settings` (10), `theme` (…), `onboarding` → **94 passed** across the affected set.
- Full frontend suite → **305 passed** (20 files; +5 new Customizado tests).
- Runtime spot-check (throwaway): warm light hierarchy + custom surface→warm canvas confirmed; temp file removed.

## Typecheck / build

- Frontend `tsc --noEmit`: PASS · build: PASS (pre-existing chunk-size warning only).
- `git diff --check`: PASS.

## Backend / schema / migration

```
BACKEND_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
```

The six-color Customizado contract already exists and persists — no backend/schema change was needed.

## Remaining limitations

- The Settings Customizado editor validates on blur/Enter; while a field is mid-edit (partial), the applied theme uses the last valid committed value (no CSS corruption). This is a safe, deliberate interaction.
- `type="color"` pickers and text inputs stay in sync only on valid commit (pickers always produce valid hex immediately).
- The broader appearance component audit (Buttons/Inputs/Sidebar/etc.) already consume the central tokens; no screen-specific overrides were needed for this battery.
- No Figma edits were made (documentation only).

## Git state

```
HEAD:               24c794020fd3371ac0f38ec153829905b8242634 (unchanged)
Dirty files:        2 modified (Settings.tsx, settings.test.tsx)
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman` (minimal-change discipline). `kore-validate` tiering honored (focused tests → typecheck/build → full suite).
- No external MCP required; theme/source/tests inspected via Read/Grep.
