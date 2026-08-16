# FR1-A — Retroactive Frontend Reconciliation Audit

## Baseline

- HEAD `58f170d` (F4B) + unfinalized F4C/F4C-R1 worktree work.
- Worktree: 22 modified (3 backend F4C, 19 frontend) + 10 untracked — all pre-existing, untouched by this audit.
- Read-only validation baseline: **139 frontend tests PASS · typecheck PASS · build PASS** (45.03 kB CSS / 383.59 kB JS). Backend untouched (380 last known green).

## Reason for Reconciliation

The canonical Figma (`8JDixNLJNe1f3KVPRwEFBi`) was materially corrected AFTER F4C:
branding normalized (Human Relay), client-friendly product language enforced
(`Empresa` over `Workspace`, no engineering vocabulary in runtime UI), geometry
defects corrected (overlaps, overflow, mobile collisions), and design authority
clarified (product frames = intent; annotations ≠ UI; motion = runtime
responsibility, now deferred). All shipped phases were implemented against the
pre-correction contract.

## Canonical Figma Contract

Pages 00–13 + 90 as listed in the task. This audit used the corrected-contract
summary supplied with the task (Figma MCP unavailable; per instructions, not a
blocker) plus repository evidence.

## Figma vs Runtime Responsibility

Static layout/content intent comes from product frames; responsive behavior,
real content, overflow, states, motion and a11y are runtime responsibilities.
Consequence for findings: copy/terminology and brand identity are contract
issues (NEEDS_CHANGE); pixel-perfect statics are NOT demanded; no new motion.

## F0/F0R Audit

`.dev-reports/demo-v1-{visual-redesign,polish,features,final-acceptance}.md`
(2026-08-13, pre-F1). Reviewed for poisoned assumptions: no "copy Figma 1:1",
no literal-annotation-as-UI, no motion-from-static-frames claims found.
However they describe the PRE-semantic visual language (old palette/component
decisions superseded by F1/F2) and reference the old generic brand treatment.
**OBSOLETE_DOC_ONLY** — must be marked historical so future execution prompts
don't treat them as design authority. `looply-contents-card-grouping.md` =
in-progress engineering doc, fine. AGENTS.md constraints still valid.

## F1 Audit

**MATCH.** Semantic token architecture, contrast guarantees (tested), public
AURA/LIGHT default, theme runtime — all still valid. `bg-inverse` justified
(Product Story surface), `bg-brand-soft` justified (selection treatment). No
token exists only to reproduce an old Figma defect. Noted debt: the legacy
alias layer (`--looply-foreground`, `--looply-muted-foreground`,
`--looply-border-subtle`, …) still has one consumer — PublicApproval.tsx
(pre-existing dirty, never migrated) which ALSO hardcodes `bg-emerald-600`/
`emerald-700` action colors. → R3.

## F2 Audit

**MATCH.** `.input`/`.label`/`.btn-*`/`.card`/`.status-pill` primitives hold;
`.input-lg` (48px) correct per 05.1; focus-visible + disabled states present;
Spinner/EmptyState/ErrorState clean. No primitive recreates overflow/overlap
patterns (no unsafe fixed widths or nowrap in primitives). StatusPill dirty
change (semantic class swap) is consistent. KpiCard uses raw `<a href>` (SPA
nav nit, LOW, not contract-breaking).

## F3 Audit

**NEEDS_CHANGE (branding + data + mobile gap).** No "WORKSPACE"/"Workspace"
strings rendered anywhere in the shell or feature screens (grep-verified) —
terminology itself is clean. Findings:

1. Sidebar brand mark = generic stacked-layers symbol (`M12 2L2 7…`) — not
   Human Relay (see Global Branding).
2. Sidebar user area renders hardcoded `Natan Massuia` / `Administrador ·
   Demo` (Sidebar.tsx:106-107) while `useMe()` exists — fake data in runtime UI.
3. AppLayout has NO mobile composition: `flex h-screen` + always-visible
   Sidebar (w-60 = 240px ≈ 62% of a 390px viewport), no top bar. Figma 04/90
   expect a mobile top bar. Bounded fix: collapse-to-icons or top-bar pattern;
   full responsive pass is a separate concern (do not broad-scope here).

## F4A Audit

**NEEDS_CHANGE (copy).** Form behavior, split geometry, inverse contrast
(R1-fixed), labels/autocomplete, no signup — all valid. Runtime copy defects
against the corrected contract (Login.tsx + AuthShell.tsx):

| Location | Current | Issue |
|---|---|---|
| Login.tsx:31 | `ACESSO AO WORKSPACE` | internal term → `ACESSO À SUA CONTA` (or `ACESSO`) |
| Login.tsx:68 | `…não está disponível na V1. … responsável pelo seu workspace.` | `V1` + `workspace` → `…ainda não está disponível. Fale com a equipe Verbum Lab responsável pela sua conta.` |
| Login.tsx:88-90 | card `Acesso provisionado` + `O Looply não possui cadastro público na V1.` | provisioning-implementation framing → support framing: title `Primeiro acesso?`, body `Não possui conta? Fale com a Verbum Lab.` |
| AuthShell.tsx:80 | pill `Operação organizada · Sem blank canvas` | flagged undesirable → `Operação organizada · Fluxo sempre no lugar` (or drop suffix) |
| AuthShell.tsx:103 | footer `Acesso provisionado pela Verbum Lab — …cadastro público na V1.` | → `Acesso criado pela equipe Verbum Lab · Sem auto-cadastro` |
| Login.tsx:36 | `Entre com o acesso enviado pela Verbum Lab…` | borderline-acceptable support framing — KEEP (Verbum Lab as support contact is allowed); optional simplification |

Login logo uses Logo.tsx → branding batch R2.

## F4B Audit

Functional architecture: **MATCH** (server-authoritative, AccessGate,
persisted gates — untouched, verified). Presentation copy: **NEEDS_CHANGE**.
Runtime occurrences in Onboarding.tsx (engineering terms in client UI):

| Line | Current | Proposed |
|---|---|---|
| 320 | `seu workspace fica no ar` | `sua empresa fica no ar` |
| 321 | `O acesso foi provisionado pela Verbum Lab.` | `Seu acesso foi criado pela equipe Verbum Lab.` |
| 344 | `identificam o workspace da sua equipe` | `identificam a sua empresa` |
| 404 | `fluxo de trabalho do workspace` | `o trabalho da sua empresa` |
| 458 | `prepara o workspace assim` | `prepara o seu Looply assim` |
| 473 | `As capacidades do workspace são resolvidas pelo servidor conforme o perfil.` | double violation (capability + servidor) → `As etapas certas do seu fluxo já vêm preparadas para o perfil escolhido.` |
| 534 | `Aparência do workspace` | `Aparência do Looply` |
| 566 | `Configurável após ativar o workspace` | `Disponível depois da configuração inicial` |
| 589 | `Seu workspace está pronto` | `Sua empresa está no ar` |
| 620 | `Entrar no workspace` | `Entrar no Looply` |

Meta blocked treatment, appearance contract (AURA default, CUSTOM deferred),
7-step mapping: valid, no fake capability. Radio `name="workspace-profile"` /
`workspace-appearance` = internal attrs, not rendered UI — fine.

## F4C Audit

**NEEDS_CHANGE (copy + brand), geometry MATCH.** AuthShell split 760/680,
440px column, mobile 390 composition, inverse roles (R1), no invisible text —
valid. Carousel exists from F4C-R1 → classified **MOTION_DEFERRED** (static
correctness unaffected: reduced-motion fallback, aria-hidden duplicate,
overflow clipped; do NOT remove). Copy defects as in F4A table above.
Onboarding presentation per F4B table. No overlap-prone fixed values found
(`w-[53%] max-w-[760px]` + `lg:` breakpoints are guarded).

## Global Branding Audit

| File | Symbol | Class |
|---|---|---|
| frontend/src/components/Logo.tsx | stacked-layers mark (`M12 2L2 7…`) + text wordmark | **LEGACY_GENERIC / NEEDS_REPLACEMENT** |
| frontend/src/components/Sidebar.tsx:29-38 | same stacked-layers mark (inline SVG, duplicated paths) + wordmark | **LEGACY_GENERIC / DUPLICATE / NEEDS_REPLACEMENT** |
| Sidebar.tsx:40 / Logo.tsx wordmark | `Looply` text | SAFE_TEXT_WORDMARK |
| PublicApproval.tsx | no brand at all on a client-facing page | MISSING (LOW — Figma 11 defines treatment) |

No CSS-drawn logos, no text-only substitutes where the mark is expected, no
wrong-aspect-ratio instances. **Blocker for remediation: the repo contains NO
Human Relay asset** — R2 requires the canonical symbol export from Figma 02
(SVG) before code can change; do not improvise.

## Client-Friendly Copy Audit

grep over rendered strings (`workspace|provider|backend|tenant|default|
capability|V1|blank canvas|provisionad*|domínio|canônico|workflow`):
all hits are either comments/type identifiers (ENGINEERING_ONLY — incl.
`lib/types.ts` `WorkspaceContext`, `isWorkspaceActive`, test fixtures) or the
RUNTIME_CLIENT_UI occurrences itemized in F4A/F4B tables (~20 strings, 3
files). No `workflow/provider/tenant/domínio/canônico` rendered. Feature
screens (Dashboard/Clients/Calendar/Team/Contents*) are clean.

## Geometry Risk Audit

Concrete patterns only:

1. `AppLayout.tsx` `h-screen overflow-hidden` + always-visible 240px sidebar →
   real mobile collision (the Figma "mobile input collisions" class). Bounded
   fix in R3.
2. `ContentDetail.tsx:112` `grid-cols-2 sm:grid-cols-3` metadata row —
   potential Jobs-metadata overflow at 390 if labels nowrap; verify at R7.
3. `ContentsList.tsx:200` `min-w-[200px]` select — fits 342px mobile column; OK.
4. AuthShell marquee chips `whitespace-nowrap` — intentional, clipped by
   `overflow-hidden` container; OK.
5. No unguarded absolute positioning in auth/onboarding (drag-overlays in
   ContentsList are pointer-events-none upload states — OK).

## Motion Audit

| Item | Class |
|---|---|
| AuthShell benefit marquee + keyframes (F4C-R1) | MOTION_DEFERRED (keep; static-safe w/ reduced-motion fallback) |
| `animate-spin` loaders (ContentsList, Spinner) | KEEP_STATIC_SAFE |
| `transition-*` micro-interactions (buttons/inputs) | KEEP_STATIC_SAFE |

No animation dependencies installed. None required.

## Test Audit

| Test | Status |
|---|---|
| login.test.tsx:103-104,112,130,136 | **NEEDS_UPDATE** — asserts `Acesso provisionado`, `cadastro público na V1`, `V1` recovery note, `Operação organizada · Sem blank canvas` class, Verbum footer class (breaks with R5 copy; must ride along) |
| onboarding.test.tsx:422,427 | **NEEDS_UPDATE** — `Seu workspace está pronto`, `Entrar no workspace` |
| workspace.test.ts / theme.test.tsx (incl. R1 inverse contrast) | VALID |
| apiClient/components/shell/format | VALID |
| MISSING_COVERAGE | Sidebar session-name rendering (trivial; add with R3 item 2) |

No TOO_BRITTLE pixel tests exist (by design of F1–F4C suites).

## Phase Matrix

| Phase | Status | File | Current | Canonical | Required Change | Risk | Batch |
|---|---|---|---|---|---|---|---|
| F0 | OBSOLETE_DOC_ONLY | demo-v1-*.md (4) | pre-semantic design docs | historical only | mark historical | LOW | R1 |
| F1 | MATCH | theme/*, index.css | semantic runtime | unchanged | none | NONE | — |
| F2 | MATCH | common.tsx, index.css primitives | shared primitives | unchanged | none | NONE | — |
| F3 | NEEDS_CHANGE | Sidebar.tsx | generic mark, hardcoded user, no mobile bar | Human Relay, real session, mobile top bar | brand (R2) + session + mobile pattern | MEDIUM | R2/R3 |
| F4A | NEEDS_CHANGE | Login.tsx, AuthShell.tsx | 6 copy defects | client-friendly copy | copy only | LOW | R5 |
| F4B | NEEDS_CHANGE | Onboarding.tsx | 10 copy defects | client-friendly copy | copy only | LOW | R5 |
| F4C | NEEDS_CHANGE | AuthShell.tsx, Logo.tsx | story copy, generic mark | corrected copy, Human Relay | copy (R5) + brand (R2) | MEDIUM | R2/R5 |
| F4C-R1 | MOTION_DEFERRED | AuthShell marquee, index.css | 16s marquee | motion deferred | none (static-safe) | LOW | — |

## Exact Files Requiring Change

1. `frontend/src/features/Login.tsx` — 4 copy blocks
2. `frontend/src/features/Onboarding.tsx` — 10 copy strings
3. `frontend/src/components/AuthShell.tsx` — 2 story copy strings (+ brand swap)
4. `frontend/src/components/Logo.tsx` — Human Relay mark (asset-gated)
5. `frontend/src/components/Sidebar.tsx` — mark swap + real session name (+ optional mobile bar)
6. `frontend/src/components/AppLayout.tsx` — mobile composition (bounded)
7. `frontend/src/features/PublicApproval.tsx` — legacy aliases + emerald hardcodes → semantic tokens (+ optional brand)
8. `frontend/src/tests/login.test.tsx`, `frontend/src/tests/onboarding.test.tsx` — copy assertions
9. `.dev-reports/demo-v1-*.md` — historical annotations

## Safe Files / No Change Required

`lib/types.ts`, `lib/api.ts`, `lib/workspace.ts`, `theme/*` (all),
`common.tsx`, `Breadcrumb.tsx`, `StatusPill.tsx`, `Icons.tsx`,
`App.tsx`/routes, `ContentsList/NewContent/ContentDetail/Dashboard/Clients/
Calendar/Team` (clean copy; only R7 verification), backend (zero changes),
`workspace.test.ts`, `theme.test.tsx`.

## Proposed Remediation Batches

| Batch | Scope | Estimate | Notes |
|---|---|---|---|
| R1 | Docs marked historical + contract note for future prompts | LOW | anytime, no code |
| R2 | Human Relay swap in Logo.tsx + Sidebar.tsx (+ favicon check) | MEDIUM | **BLOCKED until canonical SVG asset supplied from Figma 02** |
| R3 | PublicApproval semantic migration; Sidebar session name; AppLayout mobile pattern; (verify ContentDetail grid) | MEDIUM | AppLayout mobile can be deferred to the global responsive pass if scoped tight |
| R4 | App Shell language | LOW | no workspace strings exist — absorbed into R3 (session) + R2 (brand) |
| R5 | Auth + Onboarding copy (~16 strings, 3 files) | LOW | mechanical |
| R6 | Test copy assertions | LOW | must ride with R5 (same PR) |
| R7 | Runtime visual QA 390/768/1440 | LOW | after R2–R6 |

Combinable: R5+R6 (mandatory pair); R4 folds into R2/R3. R2 is asset-gated
and independent. R3 + R5+R6 can run as one execution if kept surgical.

## Risk Classification

Copy batches: LOW risk (string-level, test-guarded). Branding: MEDIUM
(asset dependency + touches both app shell and auth). AppLayout mobile:
MEDIUM (layout behavior) — defer if it grows. PublicApproval tokens: LOW.
No HIGH-risk findings; no security implications; no backend impact.

## Recommended Execution Order

1. R1 (docs) — immediately, zero code risk.
2. Supply Human Relay asset → R2 (brand).
3. R5+R6 (copy + tests) — independent of R2, can run in parallel with asset wait.
4. R3 (components/geometry, PublicApproval first; AppLayout mobile bounded or deferred).
5. R7 (visual QA) last.

## Git Status

Unchanged by this audit except this report (new untracked file).
Verified: same 22 modified + 10 untracked entries as baseline; no source
file edited, nothing staged/committed/pushed.

## Final Status

**FR1-A AUDIT — READY FOR REMEDIATION PLANNING**
