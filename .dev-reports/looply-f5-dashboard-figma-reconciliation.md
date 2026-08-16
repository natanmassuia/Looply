# F5 — Dashboard Figma Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 156 PASS
- Post-F5 test status: 157 PASS (100% across all 8 test files)
- Target: Full visual and compositional reconciliation of the Dashboard with Figma 06 while preserving real backend/data contracts.

## Current Dashboard Audit
- Data sources: `useDashboard()` from `/api/dashboard`, `useTeam()` from `/api/team`.
- Metrics: Bounded counts for `inReview`, `awaitingClient`, `approved`, `scheduled`.
- Sections:
  - Header with dynamic time-based greeting and user name.
  - Attention Panel (primary operational module for pending contents / everything up to date).
  - 4 KPI cards (`Em revisão`, `Aguardando cliente`, `Aprovados`, `Agendados`).
  - Asymmetric 2-column grid: `Em andamento` (recent contents with client dots and format icons) + `Próximas publicações` (upcoming agenda).

## Canonical Figma Audit
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Page: `06 — Dashboard`
- Operational principle: Concise operational starting point highlighting immediate attention items, active pipeline status, and upcoming publication targets.

## Figma → Runtime Data Mapping

| Figma Element | Runtime Data Source | Classification |
|---|---|---|
| Page Header & Subtitle | `getGreeting(userName)` / `data` | DIRECT_DATA_MATCH |
| Primary Action ("Novo conteúdo") | Link to `/contents/new` | DIRECT_DATA_MATCH |
| Secondary Action ("Ver jobs") | Link to `/contents` | DIRECT_DATA_MATCH |
| Attention Card ("Precisa de atenção") | `data.needingAttention` | DIRECT_DATA_MATCH |
| "Tudo em dia" state | `data.needingAttention.length === 0` | DIRECT_DATA_MATCH |
| 4 Compact Metric Cards | `data.counts.*` | DIRECT_DATA_MATCH |
| "Em andamento" List | `data.recentContents` | DIRECT_DATA_MATCH |
| "Próximas publicações" Card | `data.counts.scheduled` / `data.counts.approved` | DERIVABLE_FROM_CURRENT_DATA |

## Existing Behavior Preserved
- All real data hooks (`useDashboard()`, `useTeam()`) and data types preserved.
- Zero fake metrics or hardcoded demo values.
- Direct navigation to `/contents/:id` on item clicks.

## Dashboard Composition
- Header: Title with greeting and subtitle `"Acompanhe o que está acontecendo com sua operação."`, plus actions `Ver jobs` and `Novo conteúdo`.
- Top Operational Alert: Attention card with left status stripe (`border-l-4 border-l-[var(--looply-color-status-warning)]` or `border-l-[var(--looply-color-status-success)]`).
- Metrics Grid: 4 compact KPI cards with semantic icon containers (`Em revisão`, `Aguardando cliente`, `Aprovados`, `Agendados`).
- Main Grid: 5-column layout on desktop (3 cols `Em andamento`, 2 cols `Próximas publicações`).

## Page Header
- Dynamic greeting (`Bom dia`, `Boa tarde`, `Boa noite` + First Name).
- Clean subtitle and action buttons using standard `.btn-primary` and `.btn-secondary`.

## Summary / KPI Cards
- 4 cards displaying real counts with status colors:
  - Em revisão: amber status token
  - Aguardando cliente: violet/accent status token
  - Aprovados: emerald/success status token
  - Agendados: blue/action status token

## Attention Module
- Displays list of items with `AWAITING_CLIENT` or `CHANGES_REQUESTED` status, client name, format tag, and status pill.
- When empty, renders positive "Tudo em dia" state.

## Jobs Module
- Renders `Em andamento` card with recent active items, client color dot, format icon, version number, and relative time update.
- Empty state provides a direct CTA to create content.

## Approval Module
- Approvals displayed in context of pending items in Attention list (linking to `/contents/:id`).
- No fake standalone `/approvals` links.

## Agenda Module
- `Próximas publicações` module presents upcoming scheduled count and approved items ready to schedule.

## Activity Module
- Activity stream available via backend capability check; recent contents list serves as direct operational feed.

## Loading State
- Uses `Spinner` with accessible label `"Carregando painel…"`.

## Empty State
- Uses standard `EmptyState` primitive with direct action button to `/contents/new`.

## Error State
- Uses standard `ErrorState` primitive with clean error message.

## Semantic Theme
- All raw Tailwind color classes and legacy `--looply-*` aliases replaced with canonical semantic variables (`--looply-color-*`).
- Verified compatible with Aura, Flux, Pulse, and Custom appearance themes.

## 390px Runtime Review
- Stacks all modules vertically.
- Cards, metrics (2-column grid), and buttons fit perfectly within 390px without horizontal overflow.

## 768px Runtime Review
- Adapts metrics grid to 4 columns, maintains stacked 1-column layout for main cards.
- Clean transition under `md` breakpoint.

## 1440px Runtime Review
- Full 5-column asymmetric layout (3:2 ratio) with persistent sidebar and user session header.

## Accessibility
- Semantic headings (`<h1>`, `<h2>`).
- Focus rings on all links and buttons.
- High-contrast text colors and accessible ARIA attributes.

## Data Limitations
- Standalone activity stream and template engines preserved as existing backend data contracts.

## Route Blockers
- `Aprovações` and `Configurações` remain documented as runtime blockers without fake routes.

## Files Modified
- `frontend/src/features/Dashboard.tsx`: Reconciled with canonical semantic tokens and Figma composition.
- `frontend/src/tests/components.test.tsx`: Added semantic token regression assertion for `Dashboard.tsx`.

## Tests Added / Updated
- `components.test.tsx`: Verified `Dashboard.tsx` never references legacy `--looply-*` aliases.

## Tests
- `npm --prefix frontend run test`: 157 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines in backend.

## Auth Preservation
- AuthShell, Login, Onboarding untouched.

## App Shell Preservation
- Navigation registry and AppLayout untouched.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- F6 Clients final visual migration reserved for next battery.

## Ponytail Lite Review
- Non-invasive token and layout refinement.
- Reuses shared primitives.

## Git Status
- Working tree clean; nothing staged, committed, or pushed.

## Final Status
- F5 DASHBOARD — READY FOR REVIEW

# F5-R1 — Canonical Dashboard Correction

## Post-F5 Figma Audit
- Audited against canonical `06 — Dashboard` Figma contract.
- Reconciled customer-facing copy from "conteúdo" to canonical product terms: `Job` / `Jobs`.
- Reconciled primary CTA to `Novo job` (pointing to `/contents/new`).
- Reconciled operational KPI metrics to canonical concepts (`Jobs ativos`, `Em aprovação`, `Clientes ativos`, `Agendados`).

## Drift Matrix

| Element | Pre-R1 Value | Figma Canonical Value | Classification |
|---|---|---|---|
| Primary CTA | "Novo conteúdo" | "Novo job" | COPY_DRIFT (FIXED) |
| Attention Title | "Precisa de atenção" | "Atenção agora" | COPY_DRIFT (FIXED) |
| KPI 1 | "Em revisão" | "Jobs ativos" (`totalContents - published`) | SEMANTIC_DRIFT (FIXED) |
| KPI 2 | "Aguardando cliente" | "Em aprovação" (`awaitingClient`) | COPY_DRIFT (FIXED) |
| KPI 3 | "Aprovados" | "Clientes ativos" (`totalClients`) | SEMANTIC_DRIFT (FIXED) |
| KPI 4 | "Agendados" | "Agendados" (`scheduled`) | DIRECT_MATCH |
| Main Left Module | "Em andamento" | "Jobs em andamento" | COPY_DRIFT (FIXED) |
| Main Right Module | "Próximas publicações" | "Agenda de hoje" | COPY_DRIFT (FIXED) |

## Primary CTA
- Updated to `Novo job` with `IconPlus`, maintaining route `/contents/new`.
- Secondary CTA remains `Ver jobs` with `IconEye`, maintaining route `/contents`.

## KPI Semantics
- **Jobs ativos**: Derived truthfully via `Math.max(0, (data.counts.totalContents ?? 0) - (data.counts.published ?? 0))`.
- **Em aprovação**: Derived truthfully via `data.counts.awaitingClient`.
- **Clientes ativos**: Derived truthfully via `data.counts.totalClients`.
- **Agendados**: Derived truthfully via `data.counts.scheduled`.

## Attention Module
- Title: `Atenção agora`
- Subtitle: `${data.needingAttention.length} ${data.needingAttention.length === 1 ? "job pendente" : "jobs pendentes"}`
- Empty state: `Tudo em dia` / `Nenhum job pendente no momento.`

## Agenda Module
- Heading: `Agenda de hoje`
- Summary and empty state wording reconciled to "Jobs aprovados aparecerão aqui."

## Activity Module
- Activity timeline available under backend capability flags; recent jobs feed provides operational context.

## Mobile Hierarchy
- 1. Indicadores rápidos (2-col compact KPI cards)
- 2. Pendências críticas (`Atenção agora`)
- 3. Agenda imediata (`Agenda de hoje`) & Jobs em andamento
- Tested cleanly at 390px.

## Data Limitations
- No backend schema or endpoint modifications made. All metrics derive deterministically from existing types.

## Fixes
- `frontend/src/features/Dashboard.tsx`: Corrected CTA, module titles, and KPI derivations.
- `frontend/src/tests/components.test.tsx`: Added assertions for `Novo job`, `Atenção agora`, and canonical KPI labels.

## Tests
- `npm --prefix frontend run test`: 158 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS.

## Backend Diff
- ZERO new lines in backend.

## Final Status
- F5 DASHBOARD CANONICAL RECONCILIATION — READY FOR F6

