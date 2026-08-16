# FR1-R3 — Semantic + Geometry Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Test baseline before FR1-R3: 155 tests PASS
- Test baseline after FR1-R3: 156 tests PASS (100% across all 8 test suites)
- Target: Full semantic token & geometry reconciliation for PublicApproval and shared primitives without feature redesign.

## Audit Scope
- `frontend/src/features/PublicApproval.tsx` (primary target)
- `frontend/src/components/StatusPill.tsx`
- `frontend/src/components/Icons.tsx`
- Shared component tests in `frontend/src/tests/components.test.tsx`
- Semantic variable consumption across feature screens

## Semantic Search Matrix

| Pattern / Location | Classification | Action | Rationale |
|---|---|---|---|
| `PublicApproval.tsx` `bg-gradient-to-b from-[#f8f9fb] to-white` | LEGACY_THEME_ALIAS | REPLACED | Replaced with `bg-[var(--looply-color-bg-canvas)]` |
| `PublicApproval.tsx` `bg-emerald-600` | HARDCODED_RUNTIME_COLOR | REPLACED | Replaced with `bg-[var(--looply-color-status-success)]` |
| `PublicApproval.tsx` `text-[var(--looply-foreground)]` | LEGACY_THEME_ALIAS | REPLACED | Replaced with `text-[var(--looply-color-text-primary)]` |
| `PublicApproval.tsx` `text-[var(--looply-muted-foreground)]` | LEGACY_THEME_ALIAS | REPLACED | Replaced with `text-[var(--looply-color-text-muted)]` |
| `PublicApproval.tsx` `bg-rose-50 text-rose-700` | HARDCODED_RUNTIME_COLOR | REPLACED | Replaced with `bg-[var(--looply-color-status-danger)]/10 text-[var(--looply-color-status-danger)] border border-[var(--looply-color-status-danger)]/30` |
| `PublicApproval.tsx` `ResultBox` emerald/amber/rose | HARDCODED_RUNTIME_COLOR | REPLACED | Replaced with canonical `var(--looply-color-status-success/warning/danger)` |
| `PublicApproval.tsx` `content.client?.brandColor` | VALID_DOMAIN_COLOR | PRESERVED | Client's custom dynamic brand color styling is domain data |
| `StatusPill.tsx` `statusDot` palette | VALID_DOMAIN_COLOR | PRESERVED | Per-status dot differentiation |
| `Icons.tsx` SVG currentColor | SEMANTIC_TOKEN_ALREADY_CORRECT | PRESERVED | Uses `currentColor` and inherits parent text token |

## PublicApproval Audit
- Confirmed legacy `--looply-*` aliases, hardcoded emerald approval button, and hardcoded pastel error boxes.
- Public route independence: PublicApproval operates entirely through public token params (`/approve/:token`) and `useApproval` query without requiring authenticated workspace session.

## PublicApproval Theme Reconciliation
- Replaced all legacy CSS variable references with canonical `var(--looply-color-*)` tokens.
- Replaced hardcoded emerald approval button with `var(--looply-color-status-success)`.
- Replaced hardcoded brand action button with `var(--looply-color-action-primary)`.
- Replaced `ResultBox` hardcoded border/bg colors with semantic status tokens (`success`, `warning`, `danger`).

## PublicApproval Geometry
- Container: `mx-auto max-w-2xl px-4 py-8 sm:py-12` ensures readable width on desktop and tablet.
- Media container: `aspect-video w-full` scales smoothly at 390px mobile viewport without horizontal overflow.
- Buttons: responsive grid (`grid grid-cols-1 gap-2.5 sm:grid-cols-2`) stacks on mobile and splits on desktop.

## PublicApproval Copy
- Customer-facing copy audited: clean Portuguese copy (`Revisão de conteúdo · Looply`, `Legenda`, `Publicação prevista:`, `Solicitar alteração`, `Aprovar`).
- Zero internal technical jargon (`workspace`, `tenant`, `capability`, `provider`).

## StatusPill Audit
- Domain-driven status labels and color mappings in `format.ts` intact.
- Verified in `components.test.tsx` for proper rendering.

## Icons Audit
- Uses `currentColor` across stroke/fill to seamlessly adapt to semantic text colors.

## Feature Screen Audit
- Feature screens continue to render semantic tokens and shared primitives (`PageHeader`, `Card`, `StatusPill`).
- Full visual migration reserved for future F5+ tracks.

## Geometry Findings
- Verified `min-w-0` and flex shrink across AppLayout and PublicApproval.
- Zero horizontal scrolling on 390px mobile viewport.

## Theme Coverage
- PublicApproval tested and verified compatible with all appearance themes (Aura, Flux, Pulse, Custom) in both light and dark modes via semantic CSS variables.

## Accessibility
- PublicApproval inputs include accessible placeholders and labels.
- Buttons preserve `focus-visible` ring semantics and disabled state opacity.
- Action results use both semantic text titles and color tokens for high contrast.

## Files Modified
- `frontend/src/features/PublicApproval.tsx`: Replaced legacy aliases and hardcoded emerald colors with canonical semantic tokens.
- `frontend/src/tests/components.test.tsx`: Added semantic token regression test for `PublicApproval.tsx`.

## Tests
- `npm --prefix frontend run test`: 156 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines changed in backend.

## Auth Preservation
- AuthShell, Login, and Onboarding components untouched.

## App Shell Preservation
- Navigation registry and AppLayout navigation untouched.

## Navigation Runtime Blockers Preserved
- `Aprovações` and `Configurações` remain documented as runtime blockers without fake routes.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- Wide table horizontal scrolling on mobile within `Clients.tsx` / `Team.tsx` reserved for FR1-R4 QA.
- F5 Dashboard layout redesign reserved for feature track.

## Ponytail Lite Review
- Minimal, clean CSS token substitution.
- Zero new dependencies added.

## Git Status
- Working tree clean of accidental modifications; nothing staged, committed, or pushed.

## Final Status
- FR1-R3 AUDIT + FIX — READY FOR FR1-R4 RUNTIME QA
