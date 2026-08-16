# FR1-R1D — Runtime Visual Review

## Baseline
- Branch: `feature/demo-v1-polish`
- Test baseline: 154 PASS (Auth & Onboarding suites 100% PASS)
- Target: Full browser/runtime visual QA against final canonical Figma (`8JDixNLJNe1f3KVPRwEFBi`).

## Runtime Environment
- Framework: React 19 + TypeScript + Vite 6 + Tailwind CSS
- Node: v24.18.0
- Build: `dist/assets/index-BTgkR3ES.js` (392.49 kB), `dist/assets/index-Cr0eS64M.css` (46.10 kB)
- App runtime: Single-page application with React Router 7.

## Viewports Reviewed
- **Desktop (1440 × 960)**: Canonical 52/48 split composition, left dark aubergine Product Story + interactive preview + floating signals, right light Auth panel.
- **Mobile (390 × 844)**: Compact 358×184 Product Story card + single-column form below, zero desktop preview leak.
- **Tablet (768px sanity check)**: Compact story card + centered form column, no broken split, no horizontal overflow.

## Desktop Login
- Canonical node: `339:6`
- Composition: 52/48 split layout (`w-[52%] max-w-[760px]` aside + centered 440px form column).
- Brand: Canonical Human Relay Logo (48px inverse) with `#F06D55`, `#F3B84B`, `#2A171F`.
- Kicker: `TUDO EM UM SÓ FLUXO` (pill with `border-white/15 text-inverse-secondary`).
- Headline: `Seu trabalho continua sem perder o contexto.` (text-[38px] font-extrabold leading-[46px] text-inverse).
- Supporting copy: `Clientes, jobs, agenda e aprovações conectados no mesmo fluxo.` (text-[15px] leading-6 text-inverse-secondary).
- Right panel:
  - Kicker: `ACESSO AO LOOPLY`
  - Title: `Bem-vindo de volta.`
  - Body: `Entre para continuar o trabalho da sua equipe.`
  - Fields: `E-mail`, `Senha` with autocomplete attributes and 48px input height.
  - Secondary action: `Esqueci minha senha` with honest notice.
  - Primary CTA: `Entrar` (`btn-primary` 48px).
  - Help card: `Precisa de ajuda para entrar?` / `Se ainda não recebeu seu acesso, fale com quem administra o Looply na sua empresa.`
  - Security footer: `Acesso seguro para sua equipe`.
- Status: `FIGMA_MATCH`.

## Interactive Product Preview
- Canonical node: `365:66` / `365:296`
- Container: ~650 × 398 max-w-[650px] with `rounded-[22px] border bg-surface p-5 shadow-looply-lg`.
- Top header bar: Active view name (`Visão geral`, `Clientes`, `Jobs`, `Agenda`) + dynamic status pill (`HOJE`, `OPERAÇÃO EM DIA`).
- Mini sidebar: `Agência Aurora` header + 4 semantic `<button>` navigation items with `aria-pressed` and `aria-current`.
- 4 interactive views (zero route navigation, purely local React state):
  1. **Visão geral (`overview`)**:
     - Headline: `O que precisa da sua atenção hoje.`
     - Status pill: `HOJE`
     - Metrics: `18 Jobs ativos`, `4 Em aprovação`, `3 Vencem hoje`
     - Attention card: `Campanha de lançamento · Aurora` (Entrega final · revisão pendente)
     - Schedule item: `14:00 · Revisão · Aurora` (`hoje`)
  2. **Clientes (`clients`)**:
     - Headline: `Quem precisa de atenção agora.`
     - Status pill: `HOJE`
     - Rows: `Aurora Clínica` (Ana Martins · 3 jobs), `Mova Studio` (Lucas Costa · 2 jobs), `Nexo Educação` (Natan Massuia · 1 job)
     - Summary footer: `12 clientes ativos · 3 precisam de atenção`
  3. **Jobs (`jobs`)**:
     - Headline: `Hoje, sem perder o contexto.`
     - Status pill: `OPERAÇÃO EM DIA`
     - Rows: `Peças de agosto` (Mova Studio · Lucas), `Landing institucional` (Atlas · Natan), `Kit de anúncios` (Lume · Ana)
     - Summary footer: `12 clientes · 8 jobs ativos · 3 aprovações`
  4. **Agenda (`calendar`)**:
     - Headline: `Compromissos ligados ao trabalho.`
     - Status pill: `HOJE`
     - Rows: `09:30` (Kickoff · Nexo), `14:00` (Revisão · Aurora), `17:30` (Planejamento interno)
     - Summary footer: `Próximo compromisso em 1 h 20 min`
- Status: `FIGMA_MATCH`.

## Floating Signals
- Top floating card: `APROVAÇÃO` / `Kit de anúncios aprovado` (`absolute -top-4 -right-2`).
- Bottom floating card: `14:30` / `Reunião · Mova Studio` (`absolute -bottom-3 -left-2`).
- Properties: `aria-hidden="true"`, pointer-events-none, `hidden xl:flex` (zero collision or viewport overflow).
- Status: `FIGMA_MATCH`.

## First Access
- Canonical node: `339:85`
- Eyebrow: `Primeiro acesso`
- Title: `Defina sua nova senha`
- Body: `Proteja seu acesso antes de continuar.`
- Requirements card: 10-200 characters, confirmation match, session termination notice.
- Form contract: `newPassword` submitted cleanly.
- Status: `FIGMA_MATCH`.

## Company
- Canonical node: `339:159`
- Step: `Etapa 2 de 7`
- Title: `Sobre a empresa`
- Body: `Esses dados identificam a sua empresa no Looply.`
- Fields: `Nome da empresa`, `Site`, `Fuso horário`, `Idioma`.
- Status: `FIGMA_MATCH`.

## Profile
- Canonical node: `05 Functional Sequence`
- Step: `Etapa 3 de 7`
- Title: `Escolha seu perfil`
- Body: `O perfil organiza o fluxo de trabalho da sua empresa.`
- Profiles: `Negócio Local`, `High-Ticket`, `Agência de Marketing`.
- Status: `FIGMA_MATCH`.

## Template Confirmation
- Canonical node: `05 Functional Sequence`
- Step: `Etapa 4 de 7`
- Title: `Tudo pronto para [Perfil]`
- Body: Checklist of organized areas (Clientes e jobs, Aprovação pública, Agenda, Painel).
- Copy: `As áreas certas do seu fluxo já vêm organizadas para o perfil escolhido.`
- Status: `FIGMA_MATCH`.

## Meta
- Canonical node: `339:230`
- Step: `Etapa 5 de 7`
- Title: `Conexão Meta`
- Status card: WhatsApp / Instagram Meta Business with `Em breve` badge.
- Honesty: No fake connection claims, no dummy OAuth, allows `Continuar sem conectar`.
- Status: `FIGMA_MATCH`.

## Appearance
- Canonical node: `339:298`
- Step: `Etapa 6 de 7`
- Title: `Aparência do Looply`
- Presets: `Aura` (default), `Flux`, `Pulse`, `Customizado` (deferred).
- Persistence: Saved via `/api/onboarding/appearance` endpoint.
- Status: `FIGMA_MATCH`.

## Ready
- Canonical node: `339:384`
- Step: `Etapa 7 de 7`
- Eyebrow: `Tudo pronto`
- Title: `Seu Looply está pronto para começar.`
- Summary dl: Empresa, Perfil, Aparência, Fuso, Meta (`conexão futura`).
- CTA: `Entrar no Looply`.
- Status: `FIGMA_MATCH`.

## Mobile Login
- Canonical node: `339:464`
- Viewport: 390 × 844
- Top Story Card (~358 × 184):
  - Inverse dark background with Human Relay Logo.
  - Kicker: `Looply`.
  - Headline: `Trabalho em contexto.`
  - Status strip: `Jobs`, `Aprovar`, `Agenda`.
- Form container: Centered 358px single-column layout.
- Footer: `Acesso seguro para sua equipe`.
- Status: `FIGMA_MATCH`.

## Mobile First Access, Company, Meta, Appearance, Ready
- Canonical nodes: `339:498`, `339:531`, `339:564`, `339:596`, `339:641`
- Layout: Compact Product Story remains top anchor, forms scroll naturally within 390px width.
- No horizontal scrollbars or clipped interactive buttons.
- Status: `FIGMA_MATCH`.

## 768px Sanity Check
- Breakpoint behavior: Desktop aside hidden on `< lg`, mobile hero card displayed centered at `max-w-[358px]`, form column rendered cleanly below.
- Zero horizontal overflow, zero layout collision.
- Status: `FIGMA_MATCH`.

## Findings Matrix

| Finding | Classification | Resolution |
|---|---|---|
| Desktop 1440 split composition | FIGMA_MATCH | Validated |
| Desktop copy (headline & subtitle) | FIGMA_MATCH | Validated |
| Interactive preview 4 views | FIGMA_MATCH | Validated |
| Preview status pills per view | FIGMA_MATCH | Validated |
| Floating approval & schedule signals | FIGMA_MATCH | Validated |
| Mobile 390 compact story card | FIGMA_MATCH | Validated |
| Mobile single column form & footer | FIGMA_MATCH | Validated |
| 7 Onboarding functional stages | FIGMA_MATCH | Validated |
| Honest Meta blocked state | FIGMA_MATCH | Validated |
| Theme appearance persistence | FIGMA_MATCH | Validated |
| 768px tablet layout stability | FIGMA_MATCH | Validated |

## Fixes Applied
- All visual and copy alignments verified against canonical nodes.
- No additional fixes needed during runtime visual QA.

## Deferred Motion
- Instant state switching on interactive preview tabs maintained.
- Zero CSS marquee, carousels, or transition choreography added (deferred per contract).

## Tests
- `npm --prefix frontend run test`: 154 PASS across test suites.
- Login suite: 17/17 PASS.
- Onboarding suite: 21/21 PASS.

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines changed in backend during this task.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- FR1-R2: Mobile App Shell account menu role contract (`shell.test.tsx`).
- FR1-R3: Public approval token migration.
- F5: Dashboard implementation.

## Git Status
- Working tree clean of accidental modifications; nothing staged, committed, or pushed.

## Final Status
- FR1-R1D RUNTIME VISUAL REVIEW — READY FOR FR1-R2
