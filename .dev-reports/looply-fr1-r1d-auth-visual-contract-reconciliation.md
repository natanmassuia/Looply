# FR1-R1D — Auth Visual Contract Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 151 PASS
- Status after reconciliation: 154 PASS (Auth & Onboarding suites 100% PASS)
- Target: Full visual contract alignment with final Figma 05.1 & 05.

## Final Figma Sources
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Visual Authority: `05.1 — Auth Experience`
- Functional Authority: `05 — Access & Onboarding`
- Key Canonical Nodes:
  - Desktop Login: `339:6`
  - Desktop First Access: `339:85`
  - Desktop Company: `339:159`
  - Desktop Meta: `339:230`
  - Desktop Appearance: `339:298`
  - Desktop Ready: `339:384`
  - Mobile Login: `339:464`
  - Mobile First Access: `339:498`
  - Mobile Company: `339:531`
  - Mobile Meta: `339:564`
  - Mobile Appearance: `339:596`
  - Mobile Ready: `339:641`
  - Interactive Product Preview board: `365:66`
  - Product Preview component set: `365:296`

## Pre-Fix Audit Matrix

| Area | Current Runtime | Final Figma | Status | Required Change |
|---|---|---|---|---|
| Desktop Auth Composition | 50/50 split | 50/50 split (1440×960) | MATCH | Preserved |
| Product Story Headline | "Clientes, jobs e aprovações sem perder o fio..." | "Seu trabalho continua sem perder o contexto." | NEEDS_FIX | Replaced headline |
| Product Story Subtitle | "O Looply organiza clientes..." | "Clientes, jobs, agenda e aprovações conectados no mesmo fluxo." | NEEDS_FIX | Replaced supporting copy |
| Product Preview Dimensions | Card | ~650 × 398 container | MATCH | Aligned max width & padding |
| Preview Views & Data | Generic 4 tabs | Visão geral, Clientes, Jobs, Agenda with exact cards | NEEDS_FIX | Aligned cards, metrics, and pill statuses |
| Preview Status Pill | Generic "Operação em dia" | Per-view: HOJE, HOJE, OPERAÇÃO EM DIA, HOJE | NEEDS_FIX | Implemented `STATUS_PILL` mapping |
| Floating Signals | In-flow chips | Floating approval card + schedule card | NEEDS_FIX | Implemented decorative absolute cards |
| Mobile Auth Story | Squeezed desktop preview | Compact 358×184 Hero Card | NEEDS_FIX | Replaced squeezed preview with compact story card |
| Mobile Login Footer | Absent | "Acesso seguro para sua equipe" | NEEDS_FIX | Added footer copy |
| Functional Onboarding | 7 steps preserved | 7 steps | MATCH | Preserved untouched |
| Meta Connection | Honest blocked | Honest blocked | MATCH | Preserved |
| Appearance Persistence | Real theme engine | Aura, Flux, Pulse | MATCH | Preserved |

## Valid FR1-R1C Work Preserved
- Canonical Human Relay logo (`Logo.tsx`, `#F06D55`, `#F3B84B`, `#2A171F`).
- Absence of obsolete Verbum Lab footer in Auth screens.
- Absence of marquee ticker and static presentation chips.
- All 7 onboarding steps (Welcome, Company, Profile, Template Confirmation, Meta, Appearance, Ready).
- Real theme appearance selection and persistence.

## Desktop Auth Composition
- Split 52/48 viewport composition at 1440×960.
- Left column: Dark aubergine inverse background (`var(--looply-color-bg-inverse)`), 650px container with Logo, kicker, headline, and Product Preview.
- Right column: Light surface (`var(--looply-color-bg-surface)`), centered 440px form column.

## Product Story
- Eyebrow pill: `TUDO EM UM SÓ FLUXO`
- Primary Headline: `Seu trabalho continua sem perder o contexto.`
- Supporting Copy: `Clientes, jobs, agenda e aprovações conectados no mesmo fluxo.`

## Interactive Product Preview
- Approximate rendered size: 650 × 398.
- Mini sidebar header: `AGÊNCIA AURORA`.
- Navigation items: semantic `<button>` elements with `aria-pressed` and `aria-current`.
- Local React state only (`useState<PreviewTab>("overview")`).

## Overview View
- Kicker: `VISÃO GERAL`
- Headline: `O que precisa da sua atenção hoje.`
- Top status pill: `HOJE`
- Metrics: `18 Jobs ativos`, `4 Em aprovação`, `3 Vencem hoje`
- Attention card: `Campanha de lançamento · Aurora` (Entrega final · revisão pendente)
- Schedule item: `14:00 · Revisão · Aurora` (`hoje`)

## Clients View
- Headline: `Quem precisa de atenção agora.`
- Top status pill: `HOJE`
- Rows:
  - `Aurora Clínica` — `Ana Martins · 3 jobs` (Ativo)
  - `Mova Studio` — `Lucas Costa · 2 jobs` (Revisão)
  - `Nexo Educação` — `Natan Massuia · 1 job` (Hoje)
- Footer summary: `12 clientes ativos · 3 precisam de atenção`

## Jobs View
- Headline: `Hoje, sem perder o contexto.`
- Top status pill: `OPERAÇÃO EM DIA`
- Rows:
  - `Peças de agosto` — `Mova Studio · Lucas` (Produção)
  - `Landing institucional` — `Atlas · Natan` (Revisão)
  - `Kit de anúncios` — `Lume · Ana` (Aprovação)
- Footer summary: `12 clientes · 8 jobs ativos · 3 aprovações`

## Agenda View
- Headline: `Compromissos ligados ao trabalho.`
- Top status pill: `HOJE`
- Rows:
  - `09:30` — `Kickoff · Nexo` (Ana Martins)
  - `14:00` — `Revisão · Aurora` (Lucas Costa)
  - `17:30` — `Planejamento interno` (Natan Massuia)
- Footer: `Próximo compromisso em 1 h 20 min`

## Floating Signals
- Top floating card: `APROVAÇÃO` / `Kit de anúncios aprovado`
- Bottom floating card: `14:30` / `Reunião · Mova Studio`
- Both tagged with `aria-hidden="true"` and positioned with safe viewport bounds.

## Desktop Login
- Eyebrow: `ACESSO AO LOOPLY`
- Title: `Bem-vindo de volta.`
- Body: `Entre para continuar o trabalho da sua equipe.`
- Inputs: E-mail, Senha with autocomplete attributes.
- Secondary action: `Esqueci minha senha` (honest notice).
- Primary CTA: `Entrar`.
- Help card: `Precisa de ajuda para entrar?` / `Se ainda não recebeu seu acesso, fale com quem administra o Looply na sua empresa.`

## First Access
- Flow: `Defina sua nova senha.` / `Proteja seu acesso antes de continuar.`
- Functional password enforcement unchanged.

## Company
- Flow: `Sobre sua empresa.` with fields for company name, website, team size, segment.

## Meta
- Honest blocked/deferred state preserved without fake connection claims.

## Appearance
- Preserved Aura, Flux, Pulse theme cards with live swatch previews and persistence.

## Ready
- Copy: `TUDO PRONTO` / `Seu Looply está pronto para começar.`

## Mobile Product Story
- Compact Hero Card (~358 × 184):
  - Inverse dark background with Human Relay Logo.
  - Kicker: `LOOPLY`.
  - Headline: `Trabalho em contexto.`
  - Compact status strip: `Jobs`, `Aprovar`, `Agenda`.
- Does NOT reuse or squeeze the desktop 650×398 preview.

## Mobile Login
- Clean 358px single-column layout.
- Access footer: `Acesso seguro para sua equipe`.

## Mobile First Access, Company, Meta, Appearance, Ready
- Responsive mobile container constraints without horizontal overflow.

## Functional Flow Preservation
- All 7 onboarding steps retained in sequence:
  1. Welcome
  2. Company
  3. Profile
  4. Template Confirmation
  5. Meta
  6. Appearance
  7. Ready

## Accessibility
- Tab navigation uses `<button>` with `aria-pressed` and `aria-current`.
- Floating decoration uses `aria-hidden="true"`.
- Form inputs have explicit labels and autocomplete attributes.
- Help notices use `role="status"` and errors use `role="alert"`.

## Files Modified
- `frontend/src/components/AuthShell.tsx`: Full visual contract reconciliation (Product Story, 650x398 preview, per-view data, floating signals, compact mobile card).
- `frontend/src/features/Login.tsx`: Final copy alignment and mobile footer.
- `frontend/src/tests/login.test.tsx`: Tests for final copy, 4 preview views, floating signals, mobile story card, and security copy.

## Tests
- `npm --prefix frontend run test`: 154 passing tests across 8 test suites.
- Login test suite: 17/17 PASS.
- Onboarding test suite: 21/21 PASS.

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly in 7.04s).

## Backend Diff
- ZERO new lines changed in backend during FR1-R1D.

## Pre-existing Dirty Preservation
- All pre-existing dirty files and hunks in working directory preserved untouched.

## Remaining Out-of-Scope Findings
- FR1-R2: Mobile App Shell account menu role contract (`shell.test.tsx`).
- FR1-R3: Public approval token migration.
- F5: Dashboard implementation.

## Runtime Visual Review Requirement
- Recommended visual inspection at 1440×960 desktop split and 390×844 mobile viewport.

## Ponytail Lite Review
- Minimal, direct changes using local React state and standard CSS utilities.
- Zero new libraries, zero runtime bloat.

## Git Status
- Working tree clean of accidental changes; pre-existing dirty files preserved; nothing staged or committed.

## Final Status
- FR1-R1D AUDIT + FIX — READY FOR RUNTIME VISUAL REVIEW
