# F9 — Team Figma Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 161 PASS
- Post-F9 test status: 162 PASS (100% across all 8 test files)
- Scope: Reconciliation of Team experience against Figma 10 (`10 — Team`).

## Route Audit
- Team Route: `/team`
- Derived from existing `Sidebar.tsx` navigation contract with label `Equipe` and icon `IconUsers`.

## Membership / Role Contract Audit
- Member list queried via `useTeam()` (/api/team endpoint).
- Member creation queried via `useCreateTeamMember()` (/api/team endpoint).
- Supported Roles: `ADMIN`, `CONTENT_MANAGER`, `EDITOR`, `SOCIAL_MEDIA`, `DESIGNER`.

## Current Team Audit
- Reconciled page header title to `Equipe` and subtitle to `Membros e permissões da agência`.
- Reconciled CTA and form copy to `Convidar membro`.
- Replaced all legacy `--looply-*` aliases with canonical `var(--looply-color-*)` semantic tokens.
- Preserved member cards layout, initials avatar colors, role pill formatting, and active status indicators.

## Canonical Figma Audit
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Page: `10 — Team`
- Key requirements:
  - Page header with title `Equipe`, subtitle `Membros e permissões da agência`, and CTA `Convidar membro`.
  - Member cards with avatar/initials, name, email, role badge, and active status indicator.
  - Inline invitation form with Name, Email, and Role selection.
  - Semantic theme compliance and responsive layout.

## Figma → Runtime Mapping

| Figma Element | Runtime Data Source | Classification |
|---|---|---|
| PageHeader Title & Subtitle | Static copy | DIRECT_MATCH |
| Primary Action ("Convidar membro") | Toggle `showForm` state | DIRECT_MATCH |
| Member Grid | `useTeam()` array | DIRECT_MATCH |
| Member Avatar | `initials(u.name)` + role-based background | DIRECT_MATCH |
| Member Details | `u.name`, `u.email` | DIRECT_MATCH |
| Role Pill | `ROLE_LABEL[u.role]` + `ROLE_STYLE[u.role]` | DIRECT_MATCH |
| Status Indicator | `u.active` boolean with semantic color | DIRECT_MATCH |
| Invite Form | Name, Email, Role inputs via `useCreateTeamMember()` | DIRECT_MATCH |

## Page Header
- Title: `Equipe`
- Subtitle: `Membros e permissões da agência`
- Action: `<button className="btn-primary"><IconPlus className="h-4 w-4" />Convidar membro</button>`

## Member List
- Responsive grid: 1 column on mobile, 2 columns on tablet, 3 columns on desktop.

## Member Identity
- High-contrast avatar initials, truncated name and email container with `min-w-0 flex-1` (preserved from FR1-R4).

## Roles
- `ROLE_LABEL`: Administrador, Gerente de Conteúdo, Editor, Social Media, Designer.

## Status
- Textual and visual indicator: `Ativo` / `Inativo` using semantic tokens.

## Invite Member
- Inline Card form with validation (requires name and email) and accessible inputs.

## Role Change
- Role selection available at member creation.

## Remove / Deactivate
- No destructive backend operations exposed in Demo V1.

## Current User
- Derived from active session.

## Permissions
- Standard role definitions without custom ACL complexity.

## Loading State
- Uses `Spinner` with label `Carregando equipe…`.

## Empty State
- Uses `EmptyState` with title `"Sem membros"` and description `"Nenhum membro cadastrado ainda."`.

## Error State
- Uses `ErrorState` with clean user-facing error messages.

## Semantic Theme
- Uses `var(--looply-color-border-default)`, `var(--looply-color-text-primary)`, `var(--looply-color-text-muted)`, `var(--looply-color-status-success)`, `var(--looply-color-status-danger)`.

## 390px Runtime Review
- Single column cards stacking with clean text truncation and no horizontal overflow.

## 768px Runtime Review
- 2-column grid.

## 1440px Runtime Review
- 3-column desktop grid with hover elevation (`hover:shadow-looply-md`).

## Accessibility
- Form inputs have explicit labels; modal close button has `aria-label="Fechar"`.

## Permission Limitations
- Single-tenant agency team membership.

## Data Limitations
- Member creation supported; member removal not part of Demo V1 scope.

## Files Modified
- `frontend/src/features/Team.tsx`: Reconciled with semantic tokens and Equipe product vocabulary.
- `frontend/src/tests/components.test.tsx`: Added regression assertions for Team.

## Tests
- `npm --prefix frontend run test`: 162 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS.

## Backend Diff
- ZERO new lines in backend.

## Closed Area Preservation
- Auth, App Shell, Dashboard, Clients, Jobs, Calendar, PublicApproval remain untouched.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- None.

## Ponytail Lite Review
- Clean token migration, zero extra dependencies, standard React state and hooks.

## Git Status
- Working tree clean of accidental changes; nothing staged, committed, or pushed.

## Final Status
- F9 TEAM — READY FOR REVIEW
