# Looply — V1-F14.8 Independent Audit

Date: 2026-08-18 · Branch: `main` · Audit-only (no source modified, no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          24c794020fd3371ac0f38ec153829905b8242634
ORIGIN_MAIN:         24c794020fd3371ac0f38ec153829905b8242634 (match)
WORKTREE:            2 modified + 1 untracked report
STAGED:              none
RAM:                 ~1.7 Gi available
git diff --check:    PASS
KORE_TOUCHED:        NO
```

## Files audited

```
frontend/src/features/Settings.tsx     Customizado HEX validation, Restaurar, Cancelar, labeled controls
frontend/src/tests/settings.test.tsx   +5 Customizado functional tests
frontend/src/theme/{presets,resolveTheme,applyTheme,types,color}.ts   (read-only, confirm architecture)
frontend/src/index.css                  (read-only, token base + aliases)
backend/src/domain/appearance.ts        (read-only, persistence contract)
```

## Theme architecture review

- Single canonical theme system (`src/theme/`) remains authority: `ThemeProvider` → `useWorkspaceAppearance` (session) → `resolveTheme` → `applyTheme` writing allowlisted CSS vars to `<html>`. F14.8 added **no** second system, no parallel palette store, no duplicated CSS namespace. Customizado flows through the exact same runtime path. **PASS.**

## Light-mode evidence

Inspected the actual light token values (not just the report):

| Role | AURA light | FLUX light | PULSE light |
|---|---|---|---|
| canvas | `#FFF7F1` (cream) | `#FCF5EC` (warm) | `#F8F1F4` (blush) |
| surface | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| subtle | `#F8ECE5` | `#F6E8D9` | `#EFE1E7` |
| text-primary | `#2A171F` (aubergine) | `#3A2418` | `#2A171F` |
| border | `#E8D8D1` (warm) | `#EAD7C6` | `#E3D4DC` |

- Canvas is warm-tinted (never pure white), surface is near-white, subtle is tinted → **canvas ≠ surface ≠ subtle**; white is used selectively (surfaces only), not as the whole UI.
- Text is aubergine-based (not pure black `#000`).
- No dark-inversion logic in light values (they are explicit warm tints, not mechanically-inverted darks).
- **LIGHT_MODE_ACTUALLY_INTENTIONAL: YES** — the conclusion is substantiated by the token values.

## Hardcoded-color bypass

Sampled `common.tsx`, `ModalOrSheet.tsx`, `Sidebar.tsx`, `AppLayout.tsx` → all consume theme tokens (no hardcoded hex). Only `index.css` holds hardcoded colors: legacy status surface/border tint aliases (`#ecfdf5` success, `#fffbeb` warning, `#fef2f2` danger, `#f6edf1` info) and `#b91c1c` on `.btn-danger:hover`. These are pre-existing, semantic status tints (not light-defeating gray slabs) → **acceptable, LOW/deferred.**

## Dark / preset regression

Diff touches only `Settings.tsx` + its test; `theme/presets.ts` (all dark + light preset tokens) and `resolveTheme` are unmodified. Aura/Flux/Pulse remain distinct warm identities. **PASS.**

## Customizado contract

- Backend contract is exactly six keys (`primary/secondary/accent/surface/text/border`, `#RRGGBB` uppercase) — reused, no duplicate structure.
- Editor writes exactly these fields; save payload includes them only when `preset === "CUSTOM"`. **PASS.**

## Validation / preview / save / cancel / restore

- **HEX**: `isValidHex` (accepts `#RRGGBB` + optional `#`), normalized uppercase deterministically; invalid values never reach `customColors`/`applyTheme`/persistence; mid-edit invalid text only lives in `draftColors` (preview/theme uncorrupted); blur + Enter both commit. **PASS.**
- **Color picker**: writes valid lowercase hex directly to `customColors` (same update path as hex; no divergent second state). **PASS.**
- **Live preview**: local state → `applyTheme`; no mutation fires on picker/hex movement (verified: only `handleSaveAppearance` calls `mutateAsync`). **PASS.**
- **Save**: only CUSTOM payload; existing endpoint; `["me"]` invalidation; failure surfaces error and does not claim success. **PASS.**
- **Cancelar**: restores persisted `preset/mode/customColors`, discards drafts/errors; re-triggers preview revert via state. **PASS** (throwaway test confirmed).
- **Restaurar**: resets draft to `DEFAULT_CUSTOM`, keeps preset CUSTOM, **does not persist** (verified no mutation call); Save persists it; Cancel after Restaurar restores the persisted palette (verified). **PASS.**

## Persistence / reload / workspace isolation / onboarding

- Server-backed `["me"]` is authoritative; no `localStorage`/`sessionStorage`/module-level palette state → cross-workspace leak impossible. **PASS.**
- Onboarding writes through the same `updateAppearance` path; value resolves identically in Settings. **PASS.**

## Contrast / semantic / responsive / accessibility

- Custom contrast correction (`ensureVsBoth`, ≥4.5 text / ≥3.0 accents) is deterministic; effective values are what the runtime uses.
- Semantic colors (success/warning/danger/info) untouched by F14.8.
- Editor is responsive (`grid-cols-1/2/3`), picker+hex inline with touch targets, Save/Cancelar/Restaurar reachable; six labeled fields + labeled pickers; error conveyed via text+icon (not color alone). **PASS.**

## Reported limitations assessment

| Reported | Verdict |
|---|---|
| A. HEX commits on blur/Enter; mid-edit uses last valid value | acceptable — safe, deliberate; invalid never corrupts theme |
| B. native picker always valid | acceptable — true (type=color emits valid hex) |
| C. no Figma changes | acceptable — documentation-only battery |
| D. broader components assumed token-driven | substantiated by representative sample; no light-defeating hardcoding found |

## Findings by severity

**CRITICAL** — none.

**HIGH** — none.

**MEDIUM** — none.

**LOW** (all pre-existing or minor, none introduced by F14.8 as a material defect):
- L1: `savedRef` stays true after a successful save; save → edit → leave-without-cancel leaves the unsaved preview applied (pre-existing; the new Cancelar mitigates it, and normal flow is save-then-leave).
- L2: an unsaved Customizado draft is retained across a preset switch (pre-existing component behavior; not contradicted by any contract).
- L3: hardcoded `#b91c1c` `.btn-danger:hover` + legacy status-tint aliases in index.css (pre-existing, semantic).

## Validation actually executed

- `git status/stat/name-status/diff --check`; full F14.8 diff inspected; theme/resolve/appearance files read.
- Focused tests: settings (10) + theme + onboarding → **94 passed**.
- Throwaway tests: Restaurar-does-not-persist + Cancel-after-Restaurar-restores-persisted → both pass; temp files removed.
- Light preset values inspected directly (canvas/surface/text/border warmth) — substantiates the light-mode claim.
- Full suite (305) + typecheck + build already green on the identical diff (not re-run).

## Consolidation decision

**PASS.** The F14.8 diff is safe, coherent, and limited to the intended Customizado-functional-completeness scope plus a properly substantiated light-mode verification (no token rewrite, which was the correct minimal outcome). Restaurar/Cancelar/preview/save semantics are non-destructive and correct. Only LOW pre-existing/minor findings remain; nothing blocks consolidation.

## Git state

```
HEAD:               24c794020fd3371ac0f38ec153829905b8242634 (unchanged)
Dirty files:        2 modified + 1 untracked report
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate` (tiered validation; focused suites only).
- No external MCP required; source/tests inspected via Read/Grep + throwaway verification tests.
