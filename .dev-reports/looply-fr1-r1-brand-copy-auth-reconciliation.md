# FR1-R1 — Brand + Copy + Auth Reconciliation

## Baseline

HEAD `58f170d` (F4B) + unfinalized F4C/F4C-R1 + FR1-A audit report.
Read-only baseline before this batch: 139 tests / typecheck / build green.
AI Memory queried once (brand/palette context: Human Relay, coral #F06D55,
amber #F3B84B, aubergine #2A171F — colors exist as CSS tokens only).

## FR1-A Findings Addressed

- R5 (auth + onboarding client-facing copy): DONE — all ~16 strings.
- R6 (tests affected by R5): DONE — same batch.
- R1 (docs contract): DONE — historical banners on the 4 demo-v1 docs with
  the 6 standing rules recorded.
- Sidebar hardcoded identity ("Natan Massuia · Administrador · Demo"): DONE —
  real session data via props.
- R2 (branding): **BLOCKED — see below.**

## Human Relay Asset Resolution

Searched `Logo.tsx`, all SVG paths, `relay/coral/amber/human` tokens,
`frontend/public`, `frontend/src/assets` (absent), docs/design assets:

- `frontend/public/favicon.svg` = old generic blue mark (pre-brand, `#3b82f6`).
- `Logo.tsx` = generic stacked-layers symbol (`M12 2L2 7…`); its comment
  claims "Human Relay" but the geometry is not the canonical two-path relay.
- No coral/amber SVG geometry anywhere (coral/amber exist only as CSS custom
  properties and test assertions).

**Conclusion: HUMAN_RELAY_ASSET_REQUIRED.** No canonical vector evidence from
F4C work exists in the repository. Per contract, brand implementation was
STOPPED; no substitute invented, nothing downloaded, nothing redrawn.

## Logo Architecture

Deferred with the asset. Current state (unchanged this batch): one `Logo.tsx`
component (generic mark) reused by AuthShell/Login/Onboarding; Sidebar still
carries its duplicated inline generic SVG. Both collapse into the single
canonical implementation the moment the Figma 02 (`72:2`) export lands.

## Generic Logo Removal

NOT performed — removing the generic mark would leave a text-only substitute
where the brand mark is expected, which the contract also forbids. Removal
happens only together with the canonical replacement (same future change).

## Sidebar Identity

`Sidebar.tsx` now receives `user` / `role` props from `AppLayout` (which
already holds the `useMe` cache — zero duplicate requests, no new store).
Renders real name + PT-BR role label (OWNER→Proprietário, ADMIN→Administrador,
CONTENT_MANAGER→Gerente de conteúdo, EDITOR, SOCIAL_MEDIA, DESIGNER; fallback
"Equipe"). While the session loads: neutral "·" placeholder — never invented
identity, never "Demo". Initials derived from the real name. Layout preserved;
no mobile architecture change (that is FR1-R2).

## Client-Friendly Copy Changes

### Auth (Login.tsx — 5 blocks)

| Before | After |
|---|---|
| `ACESSO AO WORKSPACE` | `Acesso ao Looply` |
| "Entre com o acesso enviado pela Verbum Lab…" | "Entre com seu e-mail e senha." |
| recovery: "…não está disponível na V1 … pelo seu workspace." | "…ainda não está disponível. Fale com a equipe Verbum Lab responsável pela sua conta." |
| card: "Acesso provisionado / Não possui acesso? … seu workspace." | "Precisa de ajuda para entrar? / Seu acesso é exclusivo para a sua equipe. Fale com a Verbum Lab…" |
| footer: "O Looply não possui cadastro público na V1." | "O Looply é um produto Verbum Lab." |

### AuthShell.tsx (Product Story — 4 strings)

| Before | After |
|---|---|
| pill "Operação organizada · Sem blank canvas" | "Tudo em um só fluxo" |
| "— com a complexidade técnica escondida." | "— do briefing à publicação." |
| footer "Acesso provisionado pela Verbum Lab — …V1." | "Looply — um produto Verbum Lab." |
| mobile eyebrow "Operação organizada" | "Tudo em um só fluxo" |

### Onboarding (Onboarding.tsx — 10 strings)

workspace→empresa/sua empresa/Looply (welcome body, company hint, profile
intro, confirmation intro), "capacidades…resolvidas pelo servidor"→"As etapas
certas do seu fluxo já vêm preparadas para o perfil escolhido.",
"Aparência do workspace"→"Aparência do Looply", "Configurável após ativar o
workspace"→"Disponível depois da configuração inicial", "Seu workspace está
pronto"→"Sua empresa está no ar", "Entrar no workspace"→"Entrar no Looply",
"O acesso foi provisionado pela Verbum Lab."→"Seu acesso foi criado pela
equipe Verbum Lab."

Remaining `workspace` occurrences in Onboarding.tsx: type imports, comments,
and radio `name` attributes only (ENGINEERING_ONLY per FR1-A).

### Meta

Copy unchanged apart from passing review: "Em breve" badge, "ainda não está
disponível nesta versão… configurada depois, pela equipe Verbum Lab". No
provider/OAuth language, no fake connection. Kept honest.

### Appearance

Copy-only reconciliation ("Aparência do Looply", CUSTOM deferred note).
Contract untouched: AURA default, presets, persistence, no second theme model.

## Documentation Contract Update

All four `.dev-reports/demo-v1-*.md` now open with a HISTORICAL banner
recording the six standing rules (product frames = UI source; annotations ≠
UI; static frames ≠ full runtime contract; motion validated at runtime;
Human Relay = canonical symbol; client-friendly copy). Future prompts can no
longer mistake them for design authority.

## Files Modified

`frontend/src/features/Login.tsx`, `frontend/src/features/Onboarding.tsx`,
`frontend/src/components/AuthShell.tsx`, `frontend/src/components/Sidebar.tsx`,
`frontend/src/components/AppLayout.tsx`,
`frontend/src/tests/login.test.tsx`, `frontend/src/tests/onboarding.test.tsx`,
`frontend/src/tests/shell.test.tsx` (+2 identity tests), 4×
`.dev-reports/demo-v1-*.md` (banner), this report.

## Pre-existing Dirty Preservation

All pre-existing modified/untracked entries intact; backend files untouched
by this batch (their diff remains exactly the F4C work); no
reset/stash/clean/checkout; nothing staged or committed.

## Tests

**141 passed / 8 files** (was 139; +2 Sidebar identity tests). Updated
assertions: signup-card copy, recovery note, story pill/eyebrow/footer
(including duplicate-text handling — desktop pill + mobile eyebrow, story
footer + login footer), Ready summary + CTA. AccessGate, auth payload,
routing, appearance, Meta-deferred tests all unchanged and green.

## Typecheck

PASS.

## Build

PASS — 45.03 kB CSS / 383.87 kB JS (gzip 8.54 / 111.20).

## Remaining FR1 Findings (not this batch)

- R2 branding — asset-blocked (below).
- R3 PublicApproval semantic migration, AppLayout mobile composition (FR1-R2),
  ContentDetail grid verification.
- R7 runtime visual QA.

## R2 — Human Relay Brand Resolution

### Canonical Figma Source

Asset supplied with FR1-R1B, extracted from Figma `8JDixNLJNe1f3KVPRwEFBi`
· page `02 — Logo & Symbol` · component `Logo/Symbol/Human Relay` (node 72:2,
natural 168×168). Geometry used verbatim — no reinterpretation.

### Asset Geometry

Coral path (node 27:4, #F06D55, stroke 18, round cap) + amber path (node
27:5, #F3B84B) + two aubergine relay nodes (#2A171F), viewBox `0 0 168 168`.
Fixed brand identity colors — deliberately NOT theme tokens; the logo does
not recolor across Aura/Flux/Pulse (only the wordmark honors `inverse`).

### Asset Location

Repo convention is inline React SVG components (Icons.tsx, etc.); no
`src/assets` directory exists. Per "no new asset architecture for one SVG",
the canonical geometry lives IN `Logo.tsx` — the single runtime authority.
`public/favicon.svg` replaced with the same geometry (it was already an SVG
file; no build tooling added).

### Logo Component

`Logo({ size, inverse?, wordmark? })` — one component, symbol always 1:1
(`width=height=size`, viewBox 168), wordmark optional (default true),
`inverse` affects the wordmark color only. No per-size hardcoding; canonical
sizes (48/42/34.6/32/28/20/16) flow through the `size` prop.

### Sidebar

Generic stacked-layer tile removed; Sidebar renders `<Logo size={42}
wordmark={false} />` beside its existing visible "Looply" text (symbol
decorative — text carries the name). Collapse behavior, navigation, real
FR1-R1 session identity, active states: untouched.

### AuthShell

Already consumed `Logo` (desktop 48 lockup, mobile 32 lockup, both
`inverse`) — now renders canonical geometry automatically. FR1-R1 copy
preserved (tests green).

### Onboarding

Renders inside AuthShell only — no separate brand moment; no functional/
profile icons touched (Meta icon is not the Looply logo and was left alone).

### Legacy Brand Removal

`M12 2L2 7` (stacked-layers) grep across frontend src: zero runtime
occurrences — only the guard constant inside `shell.test.tsx` (intentional).
No unrelated "layers" feature icons were affected.

### Favicon Status

Replaced `frontend/public/favicon.svg` (was a pre-brand blue `#3b82f6` mark)
with the exact canonical symbol — safe because the favicon was already an
SVG asset; no raster conversion, no new tooling, no dependency.

### Accessibility

Lockup (`wordmark` true): wrapper `role="img" aria-label="Looply"`, inner
SVG + text `aria-hidden` — announced exactly once. Symbol-only
(`wordmark={false}`): fully `aria-hidden` (decorative; Sidebar text carries
the name). No double announcement anywhere.

### Tests

+4 in `shell.test.tsx` (canonical brand describe): Logo source carries the
canonical colors/viewBox and no stacked-layer path; Sidebar + AuthShell
consume `./Logo` with no duplicated brand SVG; lockup announces once /
symbol-only decorative; 1:1 aspect at 48/42/32. No SVG byte snapshots.

### Validation

**145 tests / 8 files PASS** (was 141) · typecheck PASS · build PASS
(45.27 kB CSS / 383.56 kB JS). `git diff -- backend` unchanged from F4C
(zero changes this batch). No F5, no mobile shell redesign, no
PublicApproval work, no new dependencies.

### Remaining Findings

FR1 leftovers after this batch: R3 (PublicApproval tokens, AppLayout mobile
= FR1-R2, ContentDetail grid check) and R7 (runtime visual QA). Brand is no
longer blocked.

## Blockers (superseded)

**HUMAN_RELAY_ASSET_REQUIRED — RESOLVED by FR1-R1B** (canonical geometry
supplied and implemented; see R2 section above).

## Ponytail Lite Review

- Identity via 2 props instead of a second query/store — smallest possible.
- Copy changes are string-level; no component/API churn.
- Docs fix is a prepended comment banner, not a rewrite.
- No new abstractions, no dependencies, no motion work (marquee untouched).

## Git Status

Nothing staged/committed/pushed. Worktree: 24 modified (was 21: +Sidebar,
+AppLayout, +shell.test joined the dirty set) + 11 untracked (+2 FR1 reports).

## Final Status

FR1-R1 COMPLETE — READY FOR FINAL REVIEW
