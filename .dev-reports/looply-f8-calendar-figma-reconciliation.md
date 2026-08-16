# F8 — Calendar Figma Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 160 PASS
- Post-F8 test status: 161 PASS (100% across all 8 test files)
- Scope: Reconciliation of Calendar/Agenda experience against Figma 09 (`09 — Calendar`).

## Route Audit
- Calendar Route: `/calendar`
- Derived from existing `Sidebar.tsx` navigation contract with label `Agenda` and icon `IconCalendar`.

## Appointment Domain Audit
- Publication / scheduled appointments projection over `/api/publications` and contents data contracts.
- Preserved existing domain authority without introducing new stores or third-party integrations.

## Current Calendar Audit
- Reconciled page header title to `Agenda` and subtitle to `Planejamento e publicações agendadas`.
- Reconciled customer-facing copy from "conteúdo" to canonical product terms: `Job` / `Jobs` ("Jobs aprovados podem ser agendados e aparecerão aqui.").
- Replaced all legacy `--looply-*` aliases with canonical `var(--looply-color-*)` semantic tokens.

## Canonical Figma Audit
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Page: `09 — Calendar`
- Key requirements:
  - Clean page header with title `Agenda`.
  - Accessible month navigation with Month Year label and previous/next month controls.
  - 7-column calendar grid with weekday labels (`Dom`, `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb`).
  - Day cells with today indicator, in-month vs outside-month visual distinction.
  - Appointment chips linking directly to `/contents/:id` with client brand color styling.
  - Client color legend and empty state.

## Figma → Runtime Mapping

| Figma Element | Runtime Data Source | Classification |
|---|---|---|
| PageHeader Title & Subtitle | Static copy | DIRECT_MATCH |
| Month Navigation | Local cursor state (`cursor.y`, `cursor.m`) | DIRECT_MATCH |
| Month Grid | `buildMonthGrid(year, month)` | DIRECT_MATCH |
| Weekday Headers | `WEEKDAYS` array | DIRECT_MATCH |
| Appointment Item | `p.client`, `p.title`, `p.format`, `p.id` via `usePublications()` | DIRECT_MATCH |
| Today Pill | Derived from `Date()` | DIRECT_MATCH |
| Client Legend | Unique client colors from fetched publications | DIRECT_MATCH |

## Page Header
- Title: `Agenda`
- Subtitle: `Planejamento e publicações agendadas`

## Date Navigation
- Previous Month button: `<button aria-label="Mês anterior">`
- Next Month button: `<button aria-label="Próximo mês">`
- Label: `Mês AAAA`

## View Modes
- Monthly calendar projection with responsive daily cell containers.

## Calendar / Agenda Composition
- Card container with subtle border.
- Clean header, weekday bar, and 7-column date grid.

## Appointment Card
- Truncated badge linking to `/contents/:id` styled with `p.client.brandColor`.
- Shows `${p.client.name} · ${FORMAT_LABEL[p.format]}`.
- "+N mais" overflow indicator for days with > 3 publications.

## Create Appointment
- Scheduled from Job detail workflow (`/contents/:id` schedule modal) into publication pipeline.

## Edit Appointment
- Handled through Job detail scheduling workflow.

## Cancel / Delete Semantics
- Governed by Job status lifecycle.

## Client Relation
- Displayed with client name and brand color dot/chip.

## Job Relation
- Directly references Jobs and links to `/contents/:id`.

## Responsible / Team
- Preserved in Job detail metadata context.

## Date / Time Safety
- Uses deterministic local date keying (`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`).

## Validation
- Uses standard Date constructor and year/month rollover functions.

## Loading State
- Uses `Spinner` with label `Carregando agenda…`.

## Empty State
- Uses `EmptyState` with title `"Nada agendado"` and description `"Jobs aprovados podem ser agendados e aparecerão aqui."`.

## Error State
- Uses `ErrorState` with clean server/query error message.

## Semantic Theme
- Uses `var(--looply-color-border-default)`, `var(--looply-color-bg-subtle)`, `var(--looply-color-bg-surface)`, `var(--looply-color-text-primary)`, `var(--looply-color-text-muted)`.

## 390px Runtime Review
- Responsive grid wraps and scales cleanly without horizontal page blowout.

## 768px Runtime Review
- Smooth tablet transition.

## 1440px Runtime Review
- Full desktop grid with multi-event stacking.

## Accessibility
- Buttons have explicit `aria-label` attributes (`Mês anterior`, `Próximo mês`).
- High-contrast text on semantic backgrounds.

## Data Limitations
- Appointments derived from `/api/publications` and content scheduling.

## Domain Limitations
- No Google/Microsoft calendar external syncing (by design in Demo V1).

## Files Modified
- `frontend/src/features/Calendar.tsx`: Reconciled with semantic tokens, Agenda copy, and Jobs vocabulary.
- `frontend/src/tests/components.test.tsx`: Added regression assertions for Calendar.

## Tests
- `npm --prefix frontend run test`: 161 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS.

## Backend Diff
- ZERO new lines in backend.

## Closed Area Preservation
- Auth, App Shell, Dashboard, Clients, Jobs, PublicApproval remain untouched.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- F9 Team final reconciliation reserved for next task.

## Ponytail Lite Review
- Minimal, clean token migration and customer-facing vocabulary harmonization.
- Zero extra dependencies.

## Git Status
- Working tree clean of accidental changes; nothing staged, committed, or pushed.

## Final Status
- F8 CALENDAR — READY FOR REVIEW
