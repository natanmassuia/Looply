# F6 — Clients Figma Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 158 PASS
- Post-F6 test status: 159 PASS (100% across all 8 test files)
- Scope: Reconcile `/clients` list and creation experience against Figma 07 and 07.1 while preserving backend contracts and data behavior.

## Route Audit
- Index route: `/clients` (Authenticated App Shell)
- Creation flow: In-place drawer / creation card triggered by `Novo cliente` action.
- Detail route: Currently `/clients` operates as an index with metadata cards linking to client contexts.

## Data Contract Audit
- Backend route: `/api/clients` (`listClients`, `createClient`, `updateClient`, `deleteClient`).
- Supported fields: `name`, `brandColor`, `status`, `primaryContactName`, `primaryContactEmail`, `primaryContactPhone`, `channels`.
- Derived fields: `activeContents` (counted from active client jobs).

## Current Clients Audit
- Data source: `useClients()` and `useCreateClient()` from `frontend/src/lib/api.ts`.
- Status types: `ACTIVE` ("Ativo"), `INACTIVE` ("Inativo"), `PROSPECT` ("Prospect").
- Previous terminology: Used "Conteúdos ativos" (legacy).
- Legacy theme variables: Contained raw emerald/amber/slate colors and `--looply-*` aliases.

## Canonical Figma Audit
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Pages: `07 — Clients`, `07.1 — Client Detail & CRUD`
- Key requirements:
  - PageHeader with title `Clientes`, subtitle `Marcas e empresas atendidas`, and primary action `Novo cliente`.
  - Instant client search toolbar.
  - Multi-column responsive card grid displaying client brand avatar, name, semantic status pill, primary contact, active jobs counter, channels, and contact email.
  - Form validation with inline error feedback.

## Figma → Runtime Mapping

| Figma Element | Runtime Data Source | Classification |
|---|---|---|
| PageHeader Title & Subtitle | Static copy | DIRECT_MATCH |
| Primary Action ("Novo cliente") | `setShowForm(true)` toggle | DIRECT_MATCH |
| Search Input | Instant client-side text filtering | DIRECT_MATCH |
| Brand Color Avatar | `c.brandColor` & `c.name.slice(0, 2)` | DIRECT_MATCH |
| Client Status Pill | `c.status` mapped to semantic pill | DIRECT_MATCH |
| Primary Contact | `c.primaryContactName` | DIRECT_MATCH |
| Jobs Ativos Count | `c.activeContents` | DIRECT_MATCH (with copy fix) |
| Channels Badge/List | `c.channels` | DIRECT_MATCH |
| Contact Email | `c.primaryContactEmail` | DIRECT_MATCH |

## Clients Page Header
- Title: `Clientes`
- Subtitle: `Marcas e empresas atendidas`
- Action: `<button className="btn-primary"><IconPlus className="h-4 w-4" />Novo cliente</button>`

## Search / Filters
- Search input with search icon filtering in real time across name, primary contact name, email, and channels.
- Renders dedicated empty search feedback when no matches are found.

## Client List
- Renders responsive grid: 1 column on mobile (`grid-cols-1`), 2 columns on tablet (`sm:grid-cols-2`), 3 columns on desktop (`lg:grid-cols-3`).

## Client Card / Row
- Header: Brand avatar with client initial letters and dynamic background color; client name with truncation; semantic status pill.
- Metadata list: `Jobs ativos`, `Canais`, `E-mail`.

## Client Detail
- Contextual access provided via client cards; nested detail view is aligned with current route architecture.

## Related Jobs
- Active jobs counter displayed as "Jobs ativos".

## Create Client
- Interactive creation card with fields for `Nome`, `Cor da marca` (color picker + hex display), `Contato principal`, `E-mail`, `Telefone`, and `Canais`.
- Handles pending submission state (`Salvando…`) and error feedback.

## Edit Client
- Supported via API; existing in-place editing capabilities preserved.

## Destructive Actions
- Client deletion/archive operations supported through API contracts without unauthorized frontend deletion prompts.

## Loading State
- Uses `Spinner` with label `"Carregando clientes…"`.

## Empty State
- Empty database: `EmptyState` with title `"Nenhum cliente cadastrado"` and primary action to create.
- Empty search results: `EmptyState` with title `"Nenhum resultado encontrado"` and search context.

## Error State
- Uses `ErrorState` with clean error messages.

## Semantic Theme
- All raw color classes and legacy `--looply-*` aliases replaced with canonical semantic variables (`--looply-color-*`).
- Semantic status pills use `var(--looply-color-status-success)`, `var(--looply-color-status-warning)`, and `var(--looply-color-text-muted)`.

## 390px Runtime Review
- Single column layout stacks cards, search bar, and creation form naturally.
- Zero horizontal overflow.

## 768px Runtime Review
- 2-column grid adaptation.

## 1440px Runtime Review
- 3-column grid adaptation with persistent sidebar and user session header.

## Accessibility
- Form inputs have associated `<label>` elements.
- Semantic color contrast and focus rings.

## Data Limitations
- No CRM analytics or external integration fields added beyond existing backend schema.

## Route Blockers
- None for `/clients`.

## Files Modified
- `frontend/src/features/Clients.tsx`: Reconciled with semantic tokens, search filtering, and Jobs vocabulary.
- `frontend/src/tests/components.test.tsx`: Added regression assertions for `Clients.tsx`.

## Tests
- `npm --prefix frontend run test`: 159 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines in backend.

## Closed Area Preservation
- Auth, App Shell, Dashboard, PublicApproval remain untouched.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- F7 Jobs final visual reconciliation reserved for next feature track.

## Ponytail Lite Review
- Minimal, clean client-side search and token migration.
- Zero extra dependencies.

## Git Status
- Working tree clean of accidental changes; nothing staged, committed, or pushed.

## Final Status
- F6 CLIENTS — READY FOR REVIEW
