# F4C — Auth + Onboarding Visual Alignment

## Baseline

HEAD `58f170d` (F4B) on `feature/demo-v1-polish`. Worktree carried the same 10
modified + 7 untracked pre-existing entries; none were touched (verified via
`git status` + targeted `git diff --stat` after implementation).

## Figma Source Resolution

Previous blocker ("FIGMA SOURCE UNAVAILABLE") resolved: the canonical contract
was extracted externally and supplied with the task. Figma MCP not used (not
required this run). AI Memory queried once (F4A/F4B decisions: recovery blocked,
AccessGate canonical, no signup). Serena inspected Login/Onboarding/App/common/
index.css/theme/tests before editing.

## Canonical Node References

File `Looply — Brand + Product` (key `8JDixNLJNe1f3KVPRwEFBi`):
`05 — Access & Onboarding` (node 1:6, functional authority) and
`05.1 — Auth Experience` (node 339:2, visual authority).

## Repository vs Figma Matrix

| Screen | Current (pre-F4C) | Figma | Class | Action |
|---|---|---|---|---|
| LOGIN | centered max-w-sm card | 760/680 split, story+panel, 48px fields, provisioned card, recovery link | MISMATCH | rebuilt on AuthShell |
| CHANGE_PASSWORD | centered card | same shell + requirements block | MISMATCH | reskinned |
| WELCOME | none | welcome screen | MISSING | added (presentational) |
| COMPANY | name/tz/locale | Nome da empresa + Site (+ tz/locale) | PARTIAL | Site added (backend field existed), reskinned |
| PROFILE | template radios (step 2 of 2) | profile cards, own step | MISMATCH | split into own step |
| TEMPLATE_CONFIRMATION | none | explanation of what profile prepares | MISSING | added (presentational) |
| META_CONNECTION | none | Meta status card | **BLOCKED** | deferred status card, zero API |
| APPEARANCE | none pre-activation | 2×2 preset cards, AURA default | SUPPORTED* | added step + minimal backend route |
| READY | none | summary + CTA | SUPPORTED | added (complete contract) |
| RECOVERY | none | link + full screens | **BLOCKED** | honest note, no fake flow |
| RESET_PASSWORD | none | screens | **BLOCKED** | omitted, documented |

*Supported by the domain model (schema + `workspaceAppearanceService`, whose
header comment already anticipated "the onboarding appearance step (F4B)"),
but the only HTTP route was `requireWorkspaceActive`-gated. Minimal additive
fix: `PATCH /api/onboarding/appearance` (same zod schema, same service).

## Login

Desktop split via `AuthShell` (story 53%/760 max + auth panel, 440px form
column). Eyebrow `ACESSO AO WORKSPACE`, title `Bem-vindo de volta.`, Verbum
body copy, 48px `.input-lg` fields, 48px primary button, provisioned
informational card, no-signup footer. Behavior identical to F4A (payload,
neutral network error, no enumeration leak, `getPostLoginDestination`).

## Change Password

Same shell; eyebrow `PRIMEIRO ACESSO`, requirements block (length 10–200,
match, session revocation notice). Backend contract untouched (assertNewPasswordOk,
session rotation). All F4B tests kept passing.

## Welcome

Presentational step 1: greeting from real session (`useMe` first name),
provisioned-access copy, "Sem blank canvas" note. No API calls (tested).

## Company

Nome da empresa + Site + Fuso + Idioma, prefilled from
`GET /api/onboarding/status` (which now returns `website` + `appearance`).
PATCH contract unchanged apart from optional `website` (field existed in zod
since B4). Team size/segmento from Figma 05 are NOT in the backend contract —
documented, not faked.

## Profile

Three operational profiles (Negócio Local, High-Ticket, Agência de Marketing)
mapping 1:1 to the existing `workspaceTemplate` enum — no second profile
model. Persists via existing `POST /api/onboarding/template`.

## Template Confirmation

Explanation screen for the chosen profile (static pt-BR rows describing the
V1 product surface). No capability toggles — capabilities remain
server-resolved (`capabilitiesForTemplate`), stated in the screen copy.

## Meta Connection

**META_CONNECTION_BLOCKED.** Status card with "Em breve" badge + copy that
says the connection will be configured later by Verbum Lab. No OAuth, no
Embedded Signup, no WABA, no external calls, no fake "connected" state
(tested: advancing performs no write). Does not block onboarding completion.

## Appearance

Step 6, 2×2 cards (Aura/Flux/Pulse/Customizado), AURA preselected from
server-resolved status default. Persists via the new
`PATCH /api/onboarding/appearance` → existing `updateAppearance` service →
same columns as post-activation Settings. CUSTOM is visible but disabled
("Configurável após ativar o workspace") because the backend requires a
complete six-color set for CUSTOM and the onboarding frame has no color
inputs — no fake partial state. Single theme model (F1 runtime) reused.

## Ready

Summary built from the values actually chosen in the flow (empresa, perfil,
aparência, fuso, "Meta: conexão futura") + `Entrar no workspace` →
`POST /api/onboarding/complete` → `["me"]` invalidated → AccessGate routes to
the app. No hardcoded fake business data.

## Recovery / Reset Gap

Figma has full Recovery/Reset screens; backend remains RECOVERY_BLOCKED (no
request endpoint, no reset-token persistence, no email runtime). The login
"Esqueceu a senha?" entry point exists per 05.1 but is honest: clicking shows
a `role=status` note pointing to Verbum Lab — it never pretends to send an
e-mail (tested). Reset screens not implemented.

## Desktop Alignment

1440-frame proportions approximated with `w-[53%] max-w-[760px]` story +
fluid auth panel; story: 48px logo, pill, 44/52 H1, benefit pills, static
product preview (650-class card, r≈22, "Hoje no Looply" + OPERAÇÃO EM DIA +
mini sidebar + example jobs), provisioned footer. Form column `max-w-[440px]`.
Preview is `aria-hidden` illustrative markup — no reusable dashboard system
built for it.

## Mobile Alignment

390 composition (not a scaled split): compact inverse preview card
(358-class, 32px logo, eyebrow, short headline, status chip) above the form;
form column 342-class (`px-6` gutters, `max-w-[440px]` caps desktop). No
fixed viewport heights (`min-h-screen` only), no horizontal overflow
(single-column stacking), 48px touch-safe controls. Profile = stacked cards,
confirmation = vertical rows, appearance = 2×2 grid, Meta = compact card,
Ready = compact `dl` — structural patterns per 05, not shrunk desktop.

## Branding

Canonical Human Relay mark extracted from the app Sidebar lockup into
`components/Logo.tsx` (same SVG paths, brand tile, wordmark) at 48px desktop /
32px mobile. No CSS-redrawn logo, no second variant. Sidebar itself untouched
(no App Shell changes); the one duplication (Sidebar inline SVG vs Logo.tsx)
is documented here.

## Accessibility

Preserved throughout: `htmlFor`+real labels, `autocomplete`
(email/current-password/new-password), keyboard submit, `role=alert` form
errors, `role=status` informational note, semantic `h1` per screen, fieldset/
legend (`sr-only`) for radio groups, disabled semantics (CUSTOM card, pending
buttons), `aria-hidden` decorative preview, focus-visible via F2 primitives.
Step progress is text ("Etapa X de 7") + decorative dots.

## Security

Diff reviewed against OWASP checklist: no auth bypass (AccessGate byte-identical
to F4B; route order unchanged); no tenant confusion (appearance route takes
`req.auth!.companyId`, never client input); no privilege escalation (route
inherits `requireAuth` only — same as sibling onboarding routes; post-activation
mutations stay behind `requireWorkspaceActive` in settings); no sensitive
logging; no open redirects (`Navigate` with internal constants only); onboarding
completion stays server-gated (`readyToComplete`); no password/token exposure
(story/preview are static markup). New response fields (`website`,
`appearance`) are non-sensitive workspace columns already exposed via
`/api/auth/me`.

## Files Modified

New: `frontend/src/components/AuthShell.tsx`, `frontend/src/components/Logo.tsx`.
Modified: `frontend/src/features/Login.tsx`, `frontend/src/features/Onboarding.tsx`,
`frontend/src/lib/api.ts` (+`useUpdateOnboardingAppearance`, website param),
`frontend/src/lib/types.ts` (+website, +appearance on OnboardingStatus),
`frontend/src/index.css` (+`--looply-color-bg-inverse`, +`--looply-color-bg-brand-soft`,
+`.input-lg` 48px), `frontend/src/tests/onboarding.test.tsx` (rewritten for 7 steps),
`frontend/src/tests/login.test.tsx` (+2 contracts),
`backend/src/routes/onboarding.ts` (+PATCH /appearance),
`backend/src/services/onboardingService.ts` (status: website + appearance),
`backend/tests/onboardingMembers.test.ts` (+1 test), this report.

## Pre-existing Dirty Preservation

`git status` before/after identical for all pre-existing entries; targeted
diff-stat shows F4C touched only the files above. No reset/stash/clean/checkout;
nothing staged or committed.

## Tests

Frontend: 135 passed / 8 files (was 129; onboarding suite rewritten around the
7-step contract: welcome-no-API, company prefill+payload+required-name, profile
required-choice+persistence, confirmation-no-write, Meta-deferred, AURA-default
+CUSTOM-disabled+FLUX-persistence, ready-summary+complete, neutral network
error; AccessGate 6 tests unchanged; ChangePassword 6 kept; login +no-signup
+recovery-honest).
Backend: 380 passed / 32 files (+1: status website/appearance resolution).

## Typecheck

Frontend PASS · Backend PASS.

## Build

Frontend PASS — 44.40 kB CSS / 382.97 kB JS (gzip 8.37 / 110.97).

## Ponytail Lite Review

- No wizard framework: seven steps are one `useState` + inline conditionals.
- One new shell component (AuthShell) + one Logo; no generic auth UI kit.
- Zero new dependencies; zero hardcoded palette colors (new tokens carry the
  canonical Figma values #2a171f/#fff7f1; brand-soft via color-mix).
- Preview card is plain markup — no dashboard system speculatively extracted.
- Lazy alternative noted: `PROFILE_PREP` rows are identical for all three
  profiles today; collapse to one list if copy never diverges.

## R1 — Visual QA Remediation

### Inverse Contrast Defect

Story pill, supporting copy, mobile preview eyebrow and the provisioned footer
rendered effectively invisible on the dark Product Story panel.

### Root Cause

Tailwind **v3.4** does not generate `text-[var(--token)]/70`-style classes —
the opacity modifier on an arbitrary `var()` color silently compiles to
nothing. The affected elements fell back to the inherited body color
(`--looply-color-text-primary`, #2a171f) on the #2a171f inverse background:
dark on dark. Full-strength classes (headline, wordmark, chips) were always
valid and unaffected.

### Corrected Semantic Roles

Three explicit utilities in `@layer components` over the semantic token
(rung 4 — no Tailwind modifier reliance, no raw `#fff`):

- `.text-inverse` — `var(--looply-color-text-inverse)` (headline, mobile
  headline, wordmark-class uses)
- `.text-inverse-secondary` — color-mix 80% (pill, story copy, eyebrows)
- `.text-inverse-muted` — color-mix 65% (footer note, captions)

Audited and remapped in `AuthShell.tsx`: wordmark (via Logo `inverse`),
story pill, H1, supporting copy, benefit chips (full strength, unchanged),
footer note, mobile preview eyebrow/headline/status chip. `Eyebrow inverse`
now uses `.text-inverse-secondary`.

### Contrast Validation

New test in `theme.test.tsx` parses the actual token values from
`index.css` (light `:root` + AURA dark override) and asserts, for both modes,
using the existing `mix`/`contrastRatio` helpers:

- full: ≥ 3:1 (large headline; actually ~13:1)
- secondary (80% over bg): ≥ 4.5:1 (≈ 8.6:1 dark mode, ≈ 10+:1 light mode)
- muted (65% over bg): ≥ 4.5:1 (≈ 5.2:1 dark mode, ≈ 7.6:1 light mode)

### Benefit Carousel

Mobile-only marquee under the compact product preview:
`overflow-hidden` container → `.marquee-track` (flex, `width: max-content`)
holding two identical `.marquee-seq` lists, animated by a pure-CSS
`@keyframes looply-marquee` translating `0 → -50%` (exactly one sequence
width; each sequence carries `padding-right` equal to the gap so the loop
seam has consistent spacing). Cycle: 16s linear infinite — within the
12–18s restrained band. Chips: surface bg + border + `text-secondary`,
readable on the canvas; `whitespace-nowrap`. Only presentation is
duplicated — `BENEFITS` remains a single module-level constant, no state, no
API data.

### Desktop Behavior

Desktop keeps the approved static three-chip row inside the Product Story
(`hidden lg:flex` aside) — no marquee motion at ≥lg, per 05.1 composition.
The marquee lives only in the `lg:hidden` mobile block.

### Mobile Behavior

390px: preview card + marquee strip (358-class, clipped by `overflow-hidden`;
page never scrolls horizontally), then the 342-class form. Touch does not
attach handlers (CSS-only motion). 768px: same single-column composition
between the breakpoints. 1440px: 760/680 split untouched.

### Reduced Motion

`@media (prefers-reduced-motion: reduce)` sets `.marquee-track
{ animation: none }` — chips render as a static clipped row; nothing is
hidden. The duplicated sequence is `aria-hidden="true"`, so screen readers
expose each capability exactly once per composition (desktop row + mobile
semantic list); no capability is hidden.

### Files Modified

`frontend/src/components/AuthShell.tsx` (roles + marquee markup),
`frontend/src/index.css` (inverse utilities + marquee CSS + keyframes +
reduced-motion), `frontend/src/tests/login.test.tsx` (+AuthShell contract
describe), `frontend/src/tests/theme.test.tsx` (+inverse contrast test),
this report.

### Tests

Frontend 139 passed / 8 files (was 135; +4: inverse roles, capability
aria-exactly-once with hidden duplicate, CSS-ships-keyframes+reduced-motion,
inverse contrast math). All existing login/auth/onboarding contracts
unchanged and green. No animation-timing tests.

### Typecheck

PASS (frontend). Backend untouched — zero backend changes.

### Build

PASS — 45.03 kB CSS / 383.59 kB JS (gzip 8.54 / 111.08).

### Final Visual QA

Structural validation at 390/768/1440: single source `BENEFITS` constant;
overflow only inside the clipping container; inverse foreground now resolves
through generated utilities (class present on elements, tokens verified by
test); no white hardcodes; no JS animation runtime; AccessGate, login
payload, change-password, onboarding persistence/routing, appearance API,
Meta and recovery blocked states untouched.

## Remaining Product/Backend Gaps

1. RECOVERY/RESET: backend blocked (endpoints, tokens, email runtime) — Figma
   screens unmatched; entry point honest-deferred.
2. META CONNECTION: no runtime integration — deferred card only.
3. COMPANY fields "Tamanho da equipe"/"Segmento" (05) have no backend contract.
4. CUSTOM appearance during onboarding requires a color set the onboarding
   frame doesn't collect — deferred to post-activation Settings.
5. `TEAM_SIZE`/segment and any F5+ concerns are out of scope by task contract.

## Git Status

Not staged, not committed, not pushed. 11 pre-existing modified + 7 pre-existing
untracked preserved; F4C adds 2 untracked components + this report on top of
its 11 modified files.

## Final Status

**F4C IMPLEMENTATION — READY FOR REVIEW**
