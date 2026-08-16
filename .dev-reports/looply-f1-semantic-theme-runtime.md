# F1 — Semantic Foundations + Theme Runtime (Execution Report)

- **Date:** 2026-08-15
- **Branch:** `feature/demo-v1-polish`
- **Initial HEAD:** `32b0e737a1253ec1ba343a488df53d421766679a`
- **Final HEAD (feat):** `feat(v1): add semantic theme runtime`
- **Status:** `F1 SEMANTIC FOUNDATIONS + THEME RUNTIME — PASS WITH LEGACY UI REMAINING`

## Mandatory rules compliance

| Rule | Result |
|---|---|
| PREEXISTING_DIRTY_STATE_PRESERVED | YES (14 modified + 7 untracked preserved; staged only exact F1 files/hunks) |
| UNRELATED_FILES_MODIFIED | NO |
| BACKEND_SOURCE_MODIFIED | NO |
| DEPLOY / PUSH / RUNTIME_RESTART | NO |
| git reset/restore/clean/stash/add . /add -A | NEVER executed |

## Tasks executed

- **Task 1 — Contract types:** `lib/types.ts` gains `AppearancePreset`, `AppearanceMode`, `CustomColors`, `WorkspaceAppearance` (mirroring the BP1 backend contract) and optional `WorkspaceContext.appearance` (kept optional → `workspace.test.ts` unaffected).
- **Task 2 — `src/theme/types.ts`:** single vocabulary — 19 `SEMANTIC_TOKEN_IDS`, `TOKEN_CSS_VARS`, `BRAND_TOKEN_CSS_VARS`, `ResolvedTheme`. The allowlist is the sole source of truth for DOM writes.
- **Task 3 — `src/theme/color.ts`:** pure helpers `isHexColor/hexToRgb/rgbToHex/mix/lighten/darken`, WCAG `relativeLuminance/contrastRatio`, bounded deterministic `ensureContrast`.
- **Task 4 — `src/theme/presets.ts`:** brand base tokens, status tokens (mode-dependent, preset-independent), AURA/FLUX/PULSE light+dark token sets, `resolvePresetTokens`. AURA values are literals matching `index.css`; FLUX/PULSE hover/active derived from action primary (documented provisional, F12 reconciles against Figma variables).
- **Task 5 — `src/theme/resolveTheme.ts`:** defensive `normalizeAppearance` (unknown/malformed → AURA/LIGHT, CUSTOM requires a complete valid six-color set), `resolveTheme`, and `resolveCustomTheme` (six→19 with contrast correction, bounded path, never mutates input, never throws).
- **Task 6 — `src/theme/applyTheme.ts`:** `applyTheme` sets `data-looply-theme`/`data-looply-mode` + only allowlisted `--looply-color-*` vars; `resetTheme` restores the static startup state.
- **Task 7 — `src/theme/typography.ts` + CSS:** Manrope ramp as JS contract; `.typo-*` utility classes added to `index.css`.
- **Task 8 — `src/theme/react.tsx`:** `ThemeProvider` (effect apply + unmount reset), `useTheme`, `useWorkspaceAppearance` (normalized, memoized on `["me"]` data — no extra request).
- **Task 9 — `src/index.css`:** brand + 19 semantic tokens as static AURA/LIGHT `:root`; AURA dark override `html[data-looply-theme="aura"][data-looply-mode="dark"]`; legacy `--looply-*` aliases → semantic roles; spacing/radius/elevation foundation tokens; Manrope body font; `color-scheme`. Pre-existing component classes and legacy radii/shadows preserved.
- **Task 10 — `index.html`:** Manrope Google Fonts `<link>` (preconnect + stylesheet).
- **Task 11 — `tailwind.config.js`:** added `canvas`/`foreground`/`muted`/`primary` → `var(--looply-color-*)` mappings and Manrope-first `fontFamily.sans`; `brand`/`sidebar`/`surface` palettes untouched.
- **Task 12 — `src/App.tsx`:** `ThemeProvider` mounted inside `ProtectedRoute` around `AppLayout` (public pages keep static AURA/LIGHT).
- **Task 13 — Tests:** `src/tests/theme.test.tsx` — **53 tests** (85 total frontend). Includes DOM application tests (allowlist enforcement, no arbitrary property creation, no accumulation), hydration tests (apply from session, unmount reset, no network call via mocked `useMe`), and `index.css` static-token presence via `node:fs` (minimal ambient types in `src/test/node-modules.d.ts`; no `@types/node` added).
- **Task 14 — Docs:** `docs/engineering/22-semantic-theme-runtime.md` + this report.

## Validation gates

| Gate | Result |
|---|---|
| Frontend typecheck | PASS |
| Frontend test | **85 passing** (32 baseline + 53 new) |
| Frontend build (`tsc && vite build`) | PASS |
| Backend typecheck | PASS |
| Backend test | **378 passing** (regression) |
| Backend build | PASS |
| Backend `prisma:validate` | PASS |
| DB mutation | NONE (frontend-only battery) |

## Legacy hardcoded-color inventory (F2 input)

Grepped across `frontend/src`:

| Category | Count | Locations (examples) |
|---|---|---|
| Hardcoded hex | 37 | `index.css` legacy `:root` (now aliased), `Calendar.tsx:128` `#475569`, `PublicApproval.tsx:57` `#f8f9fb` / `:62` `#0f172a`, `Clients.tsx:14` `#2563eb` (default client brand color), `index.css:144/249` `#fff`, `index.css:252` `#b91c1c` |
| Tailwind color classes (`blue/zinc/neutral/emerald/rose/amber/slate`) | 66 | `Login.tsx` `text-neutral-*`, `bg-white`; `PublicApproval.tsx` `bg-emerald-*`/`text-rose-*`; `ContentDetail.tsx` `blue-50/700`; `ContentsList.tsx` `bg-white/80`; `Sidebar.tsx` `hover:text-slate-*` |

**Classification:** `LEGACY_SCREEN` (surface/foreground hex + white), `LEGACY_COMPONENT` (button/pill colors), `STRUCTURAL_NEUTRAL` (slate/zinc text that now reads via aliases), `STATUS_COLOR` (emerald/rose/amber pills), `BRAND_COLOR` (`blue`→migrates to coral/aubergine roles, `Clients.tsx` brandColor default `#2563eb`). **No mass replacement in F1** — legacy aliases already route every screen through the new foundation; F2 migrates per-screen onto semantic roles.

## Security audit (CRITICAL=0, HIGH=0)

| Finding | Verdict |
|---|---|
| Custom-property injection via arbitrary payload keys | NOT POSSIBLE — applier iterates the allowlist only (verified by test "ignores unknown keys") |
| `innerHTML` / `dangerouslySetInnerHTML` / `eval` / `document.write` | Absent in the theme module |
| `localStorage` theme authority | Not used — server is the single authority |
| Unvalidated server object → CSS | `normalizeAppearance` coerces unknown/malformed → AURA/LIGHT; values are validated `#RRGGBB` or pure-derived hex |
| Prototype pollution | No spread of user objects into shared state; fixed-key reads only |
| DOM attribute injection | Attributes are fixed enum strings (`preset.toLowerCase()`) |
| Tenant/theme confusion after logout | Reset on unmount; provider lives inside `ProtectedRoute`; public pages static |
| Secrets | None touched/added |

## Performance / a11y notes

- Runtime is O(19) `setProperty` calls per apply; `resolveTheme` is pure (cacheable), provider effect deps memoized → no render storms; zero new bundle dependencies (Manrope via fonts CDN).
- Text roles AA-corrected; CUSTOM action/inverse ≥3.0; dark mode hue-appropriate; `--looply-color-focus-ring` token; no global `outline: none`.

## NOTION payload

```
F1 SEMANTIC FOUNDATIONS + THEME RUNTIME — PASS WITH LEGACY UI REMAINING
Commit: feat(v1): add semantic theme runtime
Runtime: frontend/src/theme/* (types, color, presets, resolveTheme, applyTheme, react, typography)
Presets: AURA (canonical) / FLUX / PULSE (provisional, F12) / CUSTOM (six-color derivation)
Modes: LIGHT / DARK (AURA dark = "profundidade aubergine")
Typeface: Manrope (Google Fonts <link>; CSS .typo-* ramp; Tailwind font-sans)
Hydration: GET /api/auth/me → workspace.appearance → <html data-looply-theme/mode>; no extra request; no FOUC
Tests: 53 new (85 frontend); backend 378 regression
Security: CRITICAL=0, HIGH=0
Next: F2 screen/component migration onto semantic roles
```

## References

- `docs/engineering/22-semantic-theme-runtime.md`
- `docs/engineering/20-frontend-migration-final-plan.md` · `docs/engineering/21-workspace-appearance-persistence.md`
- `.dev-reports/looply-bp1-workspace-appearance-persistence.md`
- `/tmp/bp1-f1/index.css.pre` · `/tmp/bp1-f1/tailwind.pre` (pre-existing dirty hunks preserved)