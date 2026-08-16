# F7 — Jobs Figma Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 159 PASS
- Post-F7 test status: 160 PASS (100% across all 8 test files)
- Scope: Full reconciliation of Jobs list/Kanban, New Job, Job Detail, Version History, and contextual Approvals against Figma 08 & 08.1.

## Route Audit
- Jobs List: `/contents`
- New Job: `/contents/new`
- Job Detail: `/contents/:id`
- Public Approval: `/approve/:token` (retains independent public route identity)

## Domain/Data Contract Audit
- Routes communicate with `/api/contents` and `/api/contents/:id`.
- Real statuses: `DRAFT`, `IN_REVIEW`, `AWAITING_CLIENT`, `CHANGES_REQUESTED`, `APPROVED`, `SCHEDULED`, `PUBLISHED`.
- Workflow actions: `/review`, `/send-approval`, `/publish`, `/schedule`, `/versions`, `/group`, `/ungroup`.

## Current Jobs Audit
- Reconciled customer-facing copy from "conteúdo" to canonical product terms: `Job` / `Jobs`.
- Replaced all legacy `--looply-*` aliases with canonical semantic tokens (`--looply-color-*`).
- Maintained Kanban 7-column drag-and-drop workflow and card grouping.

## Canonical Figma Audit
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Pages: `08 — Jobs`, `08.1 — Job Detail & Files`
- Key requirements:
  - Header with title `Jobs`, subtitle `Fluxo operacional de jobs e aprovações`, and primary CTA `Novo job`.
  - Client filter dropdown ("Todos os clientes").
  - 7-column Kanban board with responsive horizontal scrolling on mobile/tablet.
  - Job Detail with preview, caption, version notes, client dot, format, assignee, publication target, version history, and contextual workflow actions.
  - Approval link box with copy/open actions and feedback display on changes requested.

## Figma → Runtime Mapping

| Figma Element | Runtime Data Source | Classification |
|---|---|---|
| PageHeader Title & Subtitle | Static copy | DIRECT_MATCH |
| Primary Action ("Novo job") | Link to `/contents/new` | DIRECT_MATCH |
| Client Filter | `clients` query | DIRECT_MATCH |
| 7-Column Kanban Grid | `useContents()` grouped by status | DIRECT_MATCH |
| Job Card | `c.title`, `c.client`, `c.format`, `v{version}`, `relativeTime` | DIRECT_MATCH |
| Job Detail Header | `content.title`, format, client, version | DIRECT_MATCH |
| Preview & Caption | `currentVersion.mediaUrl` & `currentVersion.caption` | DIRECT_MATCH |
| Metadata & Assignee | `content.responsible`, `content.publicationTarget` | DIRECT_MATCH |
| Approval Link Box | `activeApprovalUrl` via `latestApproval.token` | DIRECT_MATCH |
| Workflow Actions | Transition POST endpoints | DIRECT_MATCH |

## Jobs Page Header
- Title: `Jobs`
- Subtitle: `Fluxo operacional de jobs e aprovações`
- Action: `<Link to="/contents/new" className="btn-primary"><IconPlus className="h-4 w-4" />Novo job</Link>`

## Search / Filters
- Filter by client: `<select aria-label="Filtrar por cliente"><option value="">Todos os clientes</option>...</select>`

## View Modes
- Kanban board representation supported as default operational view.

## Kanban
- Preserves 7 status columns with semantic color indicators and badge counts.
- Preserves horizontal scroll containment (`overflow-x-auto min-w-0 pb-4` with `min-w-[980px] xl:min-w-0`) to prevent viewport blowout on narrow screens.

## Job Card
- Header: Job title (with truncation and hover state).
- Metadata row: Client brand color dot, client name, format label, version tag, and relative update timestamp.
- Grouped cards: Nested container with count tag and sub-card links.

## New Job
- Title: `Novo job`
- Subtitle: `Crie um job e envie para revisão interna`
- Breadcrumbs: `Jobs` → `Novo job`
- Form fields: `Título do job`, `Cliente`, `Formato`, `Legenda`, `URL da mídia (demo)`, `Rede / Canal`, `Responsável`, `Data prevista de publicação`.
- Actions: `Criar e ir para revisão` / `Cancelar`.

## Job Detail
- Breadcrumbs: `Jobs` → `Job Title`
- Metadata: `Cliente`, `Formato`, `Canal`, `Responsável`, `Versão`, `Publicação prevista`.
- Media preview and version note display.

## Client Relation
- Displayed with brand color dot and client name across cards and detail.

## Responsible / Team
- Displays assigned member and operational role.

## Dates / Deadlines
- Uses formatted dates (`formatDate`, `formatDateTime`).

## Files
- Media previews for image/video links in version history and detail cards.

## File States
- Supported through version-tied media attachments and fallback media icons.

## Approval Context
- Approval link box generates direct `/approve/:token` links with single-click copy and preview.
- Displays feedback with client name and review timestamp when changes are requested.

## Public Approval Relation
- Public approval operates independently on `/approve/:token` without session requirement.

## Loading State
- Uses `Spinner` with accessible label (`Carregando jobs…`, `Carregando job…`).

## Empty State
- Uses `EmptyState` with title `"Nenhum job cadastrado"` and primary action to create.

## Error State
- Uses `ErrorState` with clean user-facing error messages.

## Semantic Theme
- Replaced all legacy aliases with canonical `var(--looply-color-*)` tokens across list, card stack, detail, new job form, and version history.

## 390px Runtime Review
- Safe internal horizontal scrolling on Kanban columns without whole-page scroll.
- New Job and Job Detail stack columns vertically cleanly.

## 768px Runtime Review
- Smooth tablet transition.

## 1440px Runtime Review
- Multi-column asymmetric detail grid and full Kanban view on desktop.

## Accessibility
- Form inputs have associated labels, ARIA landmarks, and focus-visible outlines.

## Data Limitations
- No file storage backend changes or standalone approvals list routes created.

## Route Blockers
- No `/approvals` standalone route; approval management contextualized inside jobs.

## Files Modified
- `frontend/src/features/ContentsList.tsx`: Reconciled with semantic tokens and Jobs vocabulary.
- `frontend/src/features/ContentDetail.tsx`: Reconciled with semantic tokens and Jobs vocabulary.
- `frontend/src/features/NewContent.tsx`: Reconciled with semantic tokens and Jobs vocabulary.
- `frontend/src/tests/components.test.tsx`: Added regression assertions for Jobs features.

## Tests
- `npm --prefix frontend run test`: 160 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines in backend.

## Closed Area Preservation
- Auth, App Shell, Dashboard, Clients, PublicApproval remain untouched.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- F8 Calendar final reconciliation reserved for next feature track.

## Ponytail Lite Review
- Minimal, clean token migration and customer-facing vocabulary harmonization.
- Zero extra dependencies.

## Git Status
- Working tree clean of accidental changes; nothing staged, committed, or pushed.

## Final Status
- F7 JOBS — READY FOR REVIEW
