# 22. Semantic Foundations + Theme Runtime (F1)

Status: **IMPLEMENTED — F1 SEMANTIC FOUNDATIONS + THEME RUNTIME — PASS WITH LEGACY UI REMAINING** (frontend only).

Part of the Frontend Migration Final Plan (`docs/engineering/20`, §F1) and built on the persisted appearance contract from `docs/engineering/21` (BP1). F1 replaces the legacy zinc/blue/Inter foundation with the canonical **Looply Human Relay** foundation: Manrope, brand base tokens, 19 semantic color roles, Light/Dark runtime, presets AURA/FLUX/PULSE/CUSTOM, and the six-color CUSTOM derivation. It does **not** migrate screens/components (F2+), nor does it add Settings UI (F11B) or onboarding UI (F4B).

## 1. Scope and non-goals

| In scope | Out of scope (later batteries) |
|---|---|
| Semantic token vocabulary + CSS custom-property contract | Screen/component migration onto semantic roles (F2+) |
| Theme runtime: resolve → apply → reset, DOM `<html data-looply-*>` contract | Settings UI theme selector (F11B) |
| Presets AURA/FLUX/PULSE + six-color CUSTOM derivation | Onboarding appearance step (F4B) |
| Manrope type ramp (JS contract + CSS utility classes + Tailwind `font-sans`) | Client brand-color features on surfaces |
| Hydration from `WorkspaceContext.appearance` (via `GET /api/auth/me`) | Figma variable reconciliation for FLUX/PULSE exact values (F12) |
| Static AURA/LIGHT startup state → no FOUC | Backend changes (none — BP1 owns the contract) |

## 2. Architecture

New `frontend/src/theme/` module, single-responsibility, no runtime dependencies:

| File | Responsibility |
|---|---|
| `types.ts` | `SEMANTIC_TOKEN_IDS` (19 roles), `TOKEN_CSS_VARS`, `BRAND_TOKEN_CSS_VARS`, `ResolvedTheme` |
| `color.ts` | Pure hex math: `mix/lighten/darken`, WCAG `relativeLuminance/contrastRatio`, bounded `ensureContrast` |
| `presets.ts` | Brand base tokens, AURA/FLUX/PULSE light/dark token sets, status tokens, `resolvePresetTokens` |
| `resolveTheme.ts` | `normalizeAppearance` (defensive), `resolveTheme`, `resolveCustomTheme` (six→19 derivation) |
| `applyTheme.ts` | Allowlisted DOM application + `resetTheme` |
| `react.tsx` | `ThemeProvider`, `useTheme`, `useWorkspaceAppearance` (hydration) |
| `typography.ts` | Manrope type ramp as a JS contract (mirrored by `.typo-*` CSS classes) |

Data flow: `GET /api/auth/me → workspace.appearance → useWorkspaceAppearance() → resolveTheme() → applyTheme(<html>)`. The server value is the **single authority**; `localStorage` is never read or written. TanStack Query shares the existing `["me"]` query, so mounting the provider fires **no extra request**.

## 3. DOM contract

```
<html data-looply-theme="aura|flux|pulse|custom" data-looply-mode="light|dark">
```

- Runtime writes only the 19 allowlisted `--looply-color-*` custom properties plus the two attributes. Unknown keys in a payload are ignored **by construction** (the applier iterates the allowlist, never the payload), so a stale/malicious payload cannot create arbitrary CSS properties.
- `resetTheme` removes attributes + runtime variables, returning the document to the static startup state.

## 4. Semantic token vocabulary (19 roles)

`bg-canvas, bg-surface, bg-subtle, text-primary, text-secondary, text-muted, text-inverse, text-brand, border-default, border-brand, action-primary, action-primary-hover, action-primary-active, action-secondary, focus-ring, status-success, status-warning, status-danger, status-info` → CSS vars `--looply-color-<role>`.

- Status roles are **preset-independent**; only the mode shifts them (dark uses brighter values).
- Brand base tokens are static in `index.css` (`--looply-color-aubergine-950` … `--looply-color-cream-100`) and never overridden at runtime.

## 5. Presets

| Preset | Light | Dark |
|---|---|---|
| **AURA** | Canonical Looply Human Relay (Figma 19:2): cream canvas `#FFF7F1`, white surface, aubergine ink `#2A171F`, coral action `#F06D55` | "Profundidade aubergine": canvas `#2A171F`, surface `#34202A`, coral text-brand `#F58A75` |
| **FLUX** | Warm/amber-forward provisional derivation | Warm dark provisional derivation |
| **PULSE** | Aubergine-forward high-contrast provisional (action `#2A171F` on light) | Amber-on-aubergine high-contrast provisional |

AURA literal values are the static `:root` default **and** the runtime values, so pre-auth and post-auth render identically. FLUX/PULSE have **no exact values in the repo docs** — they are deterministic brand-derived configs marked provisional; **F12** reconciles them against the Figma variable set. `resolvePresetTokens` derives hover/active for FLUX/PULSE from the action primary via the color helpers.

## 6. CUSTOM six-color mapping

Inputs: `primary, secondary, accent, surface, text, border` (validated `#RRGGBB`, uppercased; the input object is never mutated).

| Trusted verbatim | Derived |
|---|---|
| `surface → bg-surface` | `bg-canvas` = mix(surface, cream) LIGHT / mix(surface, aubergine) DARK |
| — | `bg-subtle` = mix(canvas, surface, 0.5) |
| — | `text-primary` = contrast-corrected ≥4.5 vs canvas **and** surface |
| — | `text-secondary/` `-muted` = tinted then contrast-corrected (4.5 / 3.0) |
| — | `text-brand` = primary corrected ≥4.5 |
| — | `border-default` = border corrected ≥1.5; `border-brand` = primary |
| — | `action-primary` ≥3.0; hover/active = darken/lighten 0.12/0.22 by mode, corrected |
| — | `action-secondary` + `focus-ring` = accent corrected ≥3.0 |
| — | `text-inverse` = best of white/aubergine on action-primary (≥4.5, min 3.0) |

Pathological palettes (e.g. all-black) hit the bounded `ensureContrast` loop (12 steps toward black/white by canvas luminance, then a hard anchor) so the runtime **never throws and stays deterministic**.

## 7. Manrope type ramp

- Delivered via Google Fonts `<link>` (preconnect + stylesheet) in `index.html` — zero npm dependencies, no committed binaries.
- `theme/typography.ts` exposes the ramp (Eyebrow 11/16 Bold, Display 56/64 XBold, H2 36/44 Bold, Title 22/28 Bold, Body 18/28 · 16/24 · 14/20, Label 14/20 · 12/16 SB, Caption 12/16) as a JS contract.
- The same specs ship as `.typo-*` utility classes in `index.css`.
- `body` and Tailwind `fontFamily.sans` are Manrope-first; Inter is no longer the primary face.

## 8. Spacing / radius / elevation (Figma foundation)

Exposed centrally in `index.css`: `--looply-space-16/24/32/48/64`, `--looply-radius-10/16/full`, `--looply-elevation-1/2/3` (aubergine-tinted shadows). Existing legacy technical radii (`--looply-radius-*`, `--looply-btn-radius`) are preserved for current components.

## 9. Hydration / FOUC

- Static `:root` CSS **is** AURA/LIGHT → the first paint (including public pages) is already the canonical light state; there is never a blue/zinc flash.
- `ThemeProvider` mounts **inside** `ProtectedRoute` (wrapping `AppLayout`), so unauth surfaces (`/login`, `/approve/:token`) stay on the static default.
- On login the provider reads `useMe()` (cached `["me"]`, no extra request), applies via `useEffect`, and re-applies when the appearance changes.
- On unmount/logout `resetTheme` returns the document to the static default. Theme authority remains the **server**; `localStorage` is unused.

## 10. Tailwind additions

`tailwind.config.js` gains `canvas`, `foreground`, `muted`, `primary` color mappings (→ `var(--looply-color-*)`) and a Manrope-first `fontFamily.sans`. The pre-existing `brand`, `sidebar`, `surface` palettes are untouched (no key clash).

## 11. Legacy aliasing (migration path)

All legacy `--looply-*` variables used by current screens (`--looply-background`, `--looply-surface*`, `--looply-border*`, `--looply-foreground`, `--looply-muted-foreground`, `--looply-primary*`, `--looply-success/warning/danger/information*`) now alias semantic roles. Every existing screen therefore renders the new foundation **without a single component edit**, and dark mode works app-wide immediately. F2+ migrates screens onto the semantic roles directly.

## 12. Testing (53 new tests → 85 frontend)

`src/tests/theme.test.tsx` covers: preset/mode determinism (10), defensive fallbacks (5), CUSTOM six→19 derivation incl. no-arbitrary-keys and input immutability (8), contrast guarantees incl. pathological palettes (5), DOM application incl. allowlist enforcement and no-accumulation (6), provider hydration incl. "no network request" and unmount reset (6), type ramp (3), index.css token presence incl. the AURA dark block (7), runtime integrity (3).

## 13. Validation gates

| Gate | Result |
|---|---|
| Frontend typecheck | PASS |
| Frontend test | **85 passing** (32 baseline + 53 new) |
| Frontend build (`tsc && vite build`) | PASS |
| Backend typecheck / test / build / `prisma:validate` | PASS / 378 / PASS / PASS (regression only, no DB mutation) |

## 14. Security (CRITICAL=0, HIGH=0)

No `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `document.write`, `localStorage`, or arbitrary custom-property writes. Runtime values are validated `#RRGGBB` hex or derived pure outputs; attributes are fixed enum strings. The applier writes only the allowlist. A raw/untrusted appearance object collapses to AURA/LIGHT via `normalizeAppearance` and cannot reach the DOM. No secrets, no tenant confusion after logout (reset on unmount; public pages stay static).

## 15. Accessibility

- All text roles are contrast-corrected to WCAG AA against canvas+surface; CUSTOM text-inverse and actions meet ≥3.0.
- Dark mode is hue-appropriate (aubergine "profundidade", not hue-inverted grays).
- `--looply-color-focus-ring` token exists; no global `outline: none` introduced.

## 16. F2 contract

Screens currently use legacy aliases + a few hardcoded hex/tailwind classes. F2 replaces those with semantic roles and the `.typo-*` / spacing / elevation tokens. The legacy hardcoded-color inventory (37 hex matches, 66 tailwind color-class matches across features) is documented in `.dev-reports/looply-f1-semantic-theme-runtime.md`.

## 17. References

- `docs/engineering/20-frontend-migration-final-plan.md` (F1 definition)
- `docs/engineering/21-workspace-appearance-persistence.md` (appearance contract; BP1)
- `.dev-reports/looply-bp1-workspace-appearance-persistence.md`
- `.dev-reports/looply-f1-semantic-theme-runtime.md` (execution report)