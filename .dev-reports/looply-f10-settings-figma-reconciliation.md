# F10 — Settings Figma Reconciliation

## Baseline
- Branch: `feature/demo-v1-polish`
- Baseline test status: 162 PASS
- Post-F10 test status: 163 PASS (100% across all 8 test files)
- Scope: Implementation of Settings experience against canonical Figma 12 (`12 — Settings`, `12.1 — Theme Selector`, `12.2 — Integrations & WhatsApp`, `12.3 — Theme Coverage & Regression`).

## Current Capability Audit
- `Appearance`: Presets (`AURA`, `FLUX`, `PULSE`, `CUSTOM`) and modes (`LIGHT`, `DARK`) persisted via `/api/settings/appearance` and session `useMe()`.
- `Integrations`: WhatsApp Meta Cloud API deferred in Demo V1; surfaced truthfully as `Não configurado` / `Indisponível no momento`.
- `Company`: Read-only workspace session data (`name`, `timezone`, `locale`).

## Canonical Figma Audit
- File: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)
- Pages: `12 — Settings`, `12.1 — Theme Selector`, `12.2 — Integrations & WhatsApp`, `12.3 — Theme Coverage & Regression`
- Key requirements:
  - Accessible tabbed navigation: `Aparência`, `Integrações`, `Empresa`.
  - Appearance editor with theme presets (`Aura`, `Flux`, `Pulse`, `Customizado`), mode toggle (`LIGHT` / `DARK`), custom color inputs for 6 channels.
  - Honest integration card for WhatsApp with status indicator and clear explanatory copy.
  - Company parameters card with timezone and language.

## Settings Route
- Authenticated route `/settings` registered in `App.tsx` under `<AppLayout />`.

## Navigation Registry Update
- Single canonical registry in `Sidebar.tsx` updated with `Configurações` (`mobilePlacement: "secondary"`).
- Desktop Sidebar: Canonical 6 destinations (`Visão geral`, `Clientes`, `Jobs`, `Agenda`, `Equipe`, `Configurações`).
- Mobile Bottom Nav: Canonical 4 destinations (`Visão geral`, `Clientes`, `Jobs`, `Agenda`).
- Mobile Secondary Account Menu: `Equipe`, `Configurações`, `Sair`.

## Page Structure
- Header: `Configurações` with subtitle `Aparência, integrações e dados da empresa`.
- Tabs: `Aparência`, `Integrações`, `Empresa`.

## Appearance Authority
- Reuses `useWorkspaceAppearance()` and `useUpdateSettingsAppearance()` calling backend `PATCH /api/settings/appearance`.
- Real-time CSS variables application through `ThemeProvider` without secondary stores.

## Theme Presets
- Full visual preset cards with color preview swatches and check indicators.

## Custom Appearance
- 6-channel color palette editor (`primary`, `secondary`, `accent`, `surface`, `text`, `border`).

## Persistence Semantics
- Server-authoritative mutation with optimistic query cache update.

## Theme Preview
- Dynamic color preview swatches on preset cards.

## Integrations
- WhatsApp card with `Não configurado` status pill.

## WhatsApp / Meta State
- Truthful copy: "A conexão com a API oficial do WhatsApp está temporariamente indisponível nesta versão de demonstração. Os links públicos de aprovação funcionam normalmente."
- Disabled connect action without fake OAuth or mock connections.

## Company Settings
- Displays workspace name, timezone, and locale derived from active session.

## Profile / Account Settings
- Reuses active user session identity.

## Contract Limitations
- Single-tenant Demo V1; no multi-company switcher or external third-party OAuth.

## Theme Coverage
- Verified across Aura, Flux, Pulse, Custom and light/dark modes.

## Loading / Error States
- Inline mutation pending states ("Salvando…") and feedback alerts.

## 390px Runtime Review
- Mobile tabs and vertical card stacking without horizontal body blowout.

## 768px Runtime Review
- 2-column preset grid.

## 1440px Runtime Review
- 4-column preset grid and full desktop layout.

## Accessibility
- Tab buttons and radio inputs with focus rings and semantic status roles.

## Approvals Blocker Preservation
- No standalone authenticated `/approvals` route created; approvals live inside Job detail context.

## Files Modified
- `frontend/src/features/Settings.tsx`: Created Settings feature.
- `frontend/src/App.tsx`: Registered `/settings` route.
- `frontend/src/components/Sidebar.tsx`: Added `Configurações` to `NAV`.
- `frontend/src/components/Icons.tsx`: Added `IconSettings`.
- `frontend/src/lib/api.ts`: Added `useUpdateSettingsAppearance`.
- `frontend/src/tests/shell.test.tsx`: Updated navigation assertions to 6 destinations and secondary menu.
- `frontend/src/tests/components.test.tsx`: Added regression assertions for Settings.

## Tests
- `npm --prefix frontend run test`: 163 PASS (100% across all 8 test files).

## Typecheck
- `npm --prefix frontend run typecheck`: PASS (0 errors).

## Build
- `npm --prefix frontend run build`: PASS (Vite production bundle built cleanly).

## Backend Diff
- ZERO new lines in backend.

## Closed Area Preservation
- Auth, Dashboard, Clients, Jobs, Calendar, Team, PublicApproval remain untouched.

## Pre-existing Dirty Preservation
- All pre-existing dirty files preserved untouched.

## Remaining Out-of-Scope Findings
- None.

## Ponytail Lite Review
- Minimal, clean token migration and customer-facing vocabulary harmonization.
- Zero extra dependencies.

## Git Status
- Working tree clean of accidental changes; nothing staged, committed, or pushed.

## Final Status
- F10 SETTINGS — READY FOR REVIEW
