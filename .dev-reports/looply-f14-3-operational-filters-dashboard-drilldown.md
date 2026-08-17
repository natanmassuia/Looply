# F14.3 — Operational Filters + Dashboard Drill-down + Demand Client Filter UX

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: add real operational filters (Clients, Team), replace the native client selector on
Demandas with a rich filter, and make Dashboard KPI cards drill down to truthful destinations.
Frontend-only — all filter state is client-side over the complete single-tenant dataset (no server
pagination exists), and backend list endpoints already return the full tenant-scoped set with the
required fields. No backend files changed this battery. No migration. No commit. No push.

## Baseline
- F14 / F14.1 / F14.1.1 / F14.2 LIVE VERIFIED (backend 434 tests, frontend 238 tests).
- Working tree dirty: 70 entries at start (F12.2 → F14.2 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving `/opt/looply/frontend/dist`.

## Domain Audit

```
CLIENT_STATUS_VALUES:             ACTIVE | INACTIVE | PROSPECT (backend CLIENT_STATUSES)
CLIENT_CHANNEL_FIELD:             Client.channels (String[], F14 normalized)
CLIENT_DEMAND_COUNT_SOURCE:       listClients → _count.jobs where status in ACTIVE_CONTENT_STATUSES (activeContents)
CLIENT_PENDING_DEMAND_DEFINITION: activeContents > 0 (active/unresolved demand statuses)
CLIENT_FILTER_ENDPOINT_CAPABILITIES: GET /api/clients supports status + search query params
CLIENT_CURRENT_SORT_CAPABILITIES:   none server-side; name asc default (client-side sort added)

TEAM_STATUS_VALUES:               active | inactive (CompanyMember.isActive)
TEAM_ROLE_VALUES:                 CompanyMember: OWNER|ADMIN|MEMBER · User: ADMIN|CONTENT_MANAGER|EDITOR|SOCIAL_MEDIA|DESIGNER
TEAM_FUNCTION_FIELD_IF_ANY:       none separate from role — role is the only classification field
TEAM_FILTER_ENDPOINT_CAPABILITIES: GET /api/team + /api/members return full tenant set (no server filter)
TEAM_CURRENT_SORT_CAPABILITIES:   none (client-side name sort added)

DEMAND_CLIENT_FILTER_CURRENT_COMPONENT: native <select> in ContentsList
DEMAND_CLIENT_FILTER_CURRENT_VALUE:     clientId string state
DEMAND_CLIENT_FILTER_QUERY_MODEL:       local state (clientId), client-side filter of `filtered`
DEMAND_CLIENT_FILTER_ROUTE_STATE:       none (no URL param)
DEMAND_CLIENT_FILTER_BACKEND_SUPPORT:   n/a (Demandas already filters all contents client-side by clientId)

DASHBOARD_KPI_KEYS:               Demandas ativas · Em aprovação · Clientes ativos · Agendados
DASHBOARD_KPI_QUERY_SOURCE:       useDashboard counts
DASHBOARD_KPI_TARGET_ROUTES:      /contents, /contents, /clients?status=ACTIVE, /calendar
TARGET_FILTER_SUPPORT:            Clients reads ?status=ACTIVE (honored); Contents/Calendar navigate canonical (no fake params)
```

## Clients Filter Audit

```
CLIENTS_CURRENT_SEARCH:    present (name/contact/email/channel)
CLIENTS_CURRENT_FILTERS:   none beyond search
CLIENTS_CURRENT_SORT:      name asc (backend default)
CLIENTS_FILTER_STATE_LOCATION: local state (search) — now extended to URL search params
```

## Clients Filter Contract

- **Search**: retained.
- **Status**: Todos / Ativos / Inativos / Prospect (all real domain statuses).
- **Demand activity**: Com demandas pendentes / Sem demandas pendentes → based on `activeContents > 0`.
- **Channel**: filter by any stored channel (predefined + custom, derived from live clients).
- **Sort**: Nome A–Z, Nome Z–A, Mais demandas, Menos demandas (uses `activeContents`).

Quick chips (status + pending) + "Mais filtros" sheet (status, demand activity, channel) + sort
control. Desktop toolbar stays compact; mobile uses ModalOrSheet with internal scroll.

## Clients Filter Implementation

```
CLIENT_FILTER_STATE_AUTHORITY:   URL search params (useSearchParams) — the product already uses
  router state on other screens; this keeps back/forward + refresh coherent.
CLIENT_FILTER_URL_SYNC:          /clients?status=ACTIVE&demandActivity=pending&channel=X&sort=...
CLIENT_FILTER_EXECUTION:         client-side over the full tenant dataset (single-tenant, no pagination)
CLIENT_FILTER_SERVER_SIDE:       no — status/search still server-supported; demandActivity/channel/sort client-side
CLIENT_FILTER_PAGINATION_SAFE:   YES — backend returns the complete tenant-scoped client list (no server paging), so client-side filtering is global, not page-local.
```

## Clients Filter QA

```
CLIENT_FILTER_COMPOSITION:         search + status + demandActivity + channel + sort compose (tested)
CLIENT_FILTER_RESULT_COUNT_CORRECT: YES (status/pending/channel tests assert exact inclusion/exclusion)
CLIENT_FILTER_MOBILE:              bottom sheet reachable, internal scroll, applied state visible after close
CLIENT_FILTER_MOBILE_OVERFLOW:     NO (toolbar wraps)
CLIENT_FILTER_POST_MUTATION_REACTIVITY: YES — ClientEditor mutation invalidates ["clients"], so a
  status change re-filters the current result without F5.
```

## Team Domain Audit

```
TEAM_STATUS_VALUES:                 active | inactive
TEAM_ROLE_VALUES:                   OWNER | ADMIN | MEMBER (members) + ADMIN | CONTENT_MANAGER | EDITOR | SOCIAL_MEDIA | DESIGNER (team)
TEAM_FUNCTION_SEPARATE_FROM_ROLE:   NO — no separate function/title field exists; role is the classification
```

## Team Filter Contract

Search + status (Ativos/Inativos) + role (canonical labels) + sort (Nome A–Z / Z–A). Same visual
language as Clients (chips + selects), not a new filter system. "Limpar filtros" resets.

```
TEAM_FILTER_UI_CONSISTENT_WITH_CLIENTS: YES (chips + selects, same tokens)
TEAM_FILTER_EXECUTION:                  client-side over full members/team arrays
TEAM_FILTER_SERVER_SIDE:                no (endpoints return full set)
TEAM_FILTER_PAGINATION_SAFE:            YES (complete set, no paging)
TEAM_FILTER_COMPOSITION:                search + status + role + sort compose (tested)
TEAM_FILTER_RESULT_COUNT_CORRECT:       YES
TEAM_FILTER_DESKTOP:                    chips + selects in toolbar
TEAM_FILTER_MOBILE:                     reachable via toolbar (wraps), no overflow
TEAM_FILTER_POST_MUTATION_REACTIVITY:   YES — role/status edits invalidate ["team"]/["members"], re-filtering the result
```

## Demand Client Filter Audit

```
DEMAND_CLIENT_FILTER_ROOT_CAUSE:      native <select> — minimal, no search/logo, poor on large lists
DEMAND_CLIENT_FILTER_CLIENT_SOURCE:   useClients (full tenant client list)
```

## Rich Client Filter

Replaced the native `<select>` with a trigger button ("Todos os clientes" or selected client
identity) + ModalOrSheet bottom sheet:
- Header "Filtrar por cliente".
- Search input ("Buscar cliente…").
- Option "Todos os clientes" + client rows with logo (when available) or brand-color initials,
  name, and a check on the selected row.
- Sheet closes on selection; selection shows in the trigger with logo/initials.
- Internal scroll (`max-h-[50vh] overflow-y-auto`); empty search state.

```
DEMAND_CLIENT_FILTER_NATIVE_SELECT_REMOVED: YES
DEMAND_CLIENT_FILTER_SEARCH:                YES
DEMAND_CLIENT_FILTER_LOGO:                  YES
DEMAND_CLIENT_FILTER_INITIALS_FALLBACK:     YES
DEMAND_CLIENT_FILTER_SELECTED_STATE:        YES (trigger + check in sheet)
DEMAND_CLIENT_FILTER_MOBILE:                YES (bottom sheet, closes on select, no overflow)
```

## Demand Filter QA

- Zero matching: "Nenhum cliente encontrado." empty state.
- One / many clients: internal scroll, no viewport overflow, long names truncate.
- Demand workflow semantics untouched (clientId filter unchanged).

## Dashboard KPI Audit

```
DASHBOARD_KPI_KEYS:       Demandas ativas · Em aprovação · Clientes ativos · Agendados
DASHBOARD_KPI_QUERY_SOURCE: useDashboard counts
```

## KPI Drill-down

Entire KPI card is now a `Link` when it has a truthful destination:
- Demandas ativas → /contents (canonical Demandas — shows active board, no fake param).
- Em aprovação → /contents (canonical Demandas).
- Clientes ativos → /clients?status=ACTIVE (Clients reads ?status and pre-selects "Ativos").
- Agendados → /calendar (canonical Agenda).

Accessible: `aria-label` includes KPI label + value; pointer cursor; hover/focus ring; keyboard
activable; no nested conflicting buttons.

```
DASHBOARD_KPI_CLICKABLE:  YES
DASHBOARD_KPI_ACCESSIBLE: YES
KPI_DEMANDAS_ACTIVE_HANDOFF: /contents (canonical Demandas)
KPI_APPROVAL_HANDOFF:        /contents (canonical Demandas)
KPI_CLIENTS_ACTIVE_HANDOFF:  /clients?status=ACTIVE (honored filter)
KPI_SCHEDULED_HANDOFF:       /calendar
```

## Performance

```
FILTER_N_PLUS_ONE:     NO — no per-row demand-count requests; counts come from existing list projection (activeContents)
FILTER_REFETCH_LOOP:   NO — filters are client-side over already-fetched data; no new fetch per keystroke
FILTER_PERFORMANCE:    OK — search is a single controlled input (no debounce needed, dataset small); memoized filtered arrays
```

## Accessibility

- Chips are real buttons with `aria-pressed`; selects have accessible labels; "Mais filtros" has
  `aria-expanded`; rich client filter uses `aria-haspopup="dialog"` + labeled search; KPI cards are
  real links with `aria-label`. ModalOrSheet provides focus/close behavior.

## Regression

```
F14_REGRESSION:   PASS — appearance PATCH 200, public upload intent 201, no loopback.
F14_1_REGRESSION: PASS — grouped-demand + mobile Settings untouched.
F14_1_1_REGRESSION: PASS — ClientEditor + identity propagation intact (no source changes).
F14_2_REGRESSION: PASS — dashboard recentContents=5, timezone present, activity pagination works.
```

## Runtime Activation

- Frontend-only → `npm run build` → served bundle `index-CGZSi4Wr.js`; Nginx serves
  `/opt/looply/frontend/dist` (unchanged root, no Nginx reload).
- Backend unchanged this battery → no backend reload.
- No migration. No Kore.

```
BACKEND_FILES_CHANGED: 0 (this battery)
LOOPLY_BACKEND_RELOADED: NO
FRONTEND_ARTIFACT_CURRENT: YES
```

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Backend tests  | 434    | 434   |
| Frontend tests | 238    | 248   |

Frontend additions:
- clients.test.tsx: status filter, pending-demand filter, channel filter (via "Mais filtros"
  sheet), demand-count sort, clear filters; adjusted "Abrir" test to be name-sort-agnostic.
- team.test.tsx: status + role filter composition, search composition.
- jobs.test.tsx: rich client filter — no native `<select>` remains, trigger + sheet, select client.
- dashboard.test.tsx: KPI drill-down links (labels → routes).

## Resource Safety

```
AVAILABLE_RAM_START: ~1.6 Gi
AVAILABLE_RAM_FINAL: ~1.5 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: frontend typecheck → frontend tests → frontend build. Backend not rerun (unchanged this battery; last validated 434 in F14.2).

## Git Status

Working tree preserved (F12.2 → F14.3). Session touched (frontend only):
`features/Clients.tsx`, `features/Team.tsx`, `features/ContentsList.tsx`, `features/Dashboard.tsx`,
`components/Icons.tsx` (added IconChevronDown), `tests/clients.test.tsx`, `tests/team.test.tsx`,
`tests/jobs.test.tsx`, `tests/dashboard.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.6 Gi
AVAILABLE_RAM_FINAL:                       ~1.5 Gi

CLIENT_STATUS_VALUES:                      ACTIVE | INACTIVE | PROSPECT
CLIENT_PENDING_DEMAND_DEFINITION:          activeContents > 0
CLIENT_FILTER_STATE_AUTHORITY:             URL search params
CLIENT_FILTER_URL_SYNC:                    YES
CLIENT_FILTER_EXECUTION:                   client-side (full tenant dataset)
CLIENT_FILTER_SERVER_SIDE:                 status/search server; activity/channel/sort client
CLIENT_FILTER_PAGINATION_SAFE:             YES
CLIENT_FILTER_COMPOSITION:                 YES
CLIENT_FILTER_RESULT_COUNT_CORRECT:        YES
CLIENT_FILTER_MOBILE:                      YES
CLIENT_FILTER_MOBILE_OVERFLOW:             NO
CLIENT_FILTER_POST_MUTATION_REACTIVITY:    YES

TEAM_STATUS_VALUES:                        active | inactive
TEAM_ROLE_VALUES:                          OWNER|ADMIN|MEMBER (+ User roles)
TEAM_FUNCTION_SEPARATE_FROM_ROLE:          NO
TEAM_FILTER_UI_CONSISTENT_WITH_CLIENTS:    YES
TEAM_FILTER_EXECUTION:                     client-side
TEAM_FILTER_SERVER_SIDE:                   NO
TEAM_FILTER_PAGINATION_SAFE:               YES
TEAM_FILTER_COMPOSITION:                   YES
TEAM_FILTER_RESULT_COUNT_CORRECT:          YES
TEAM_FILTER_DESKTOP:                       YES
TEAM_FILTER_MOBILE:                        YES
TEAM_FILTER_POST_MUTATION_REACTIVITY:      YES

DEMAND_CLIENT_FILTER_ROOT_CAUSE:           native <select>, no search/logo
DEMAND_CLIENT_FILTER_NATIVE_SELECT_REMOVED: YES
DEMAND_CLIENT_FILTER_SEARCH:               YES
DEMAND_CLIENT_FILTER_LOGO:                 YES
DEMAND_CLIENT_FILTER_INITIALS_FALLBACK:    YES
DEMAND_CLIENT_FILTER_SELECTED_STATE:       YES
DEMAND_CLIENT_FILTER_MOBILE:               YES

DASHBOARD_KPI_KEYS:                        Demandas ativas · Em aprovação · Clientes ativos · Agendados
DASHBOARD_KPI_CLICKABLE:                   YES
DASHBOARD_KPI_ACCESSIBLE:                  YES
KPI_DEMANDAS_ACTIVE_HANDOFF:               /contents
KPI_APPROVAL_HANDOFF:                      /contents
KPI_CLIENTS_ACTIVE_HANDOFF:                /clients?status=ACTIVE
KPI_SCHEDULED_HANDOFF:                     /calendar

FILTER_N_PLUS_ONE:                         NO
FILTER_REFETCH_LOOP:                       NO
FILTER_PERFORMANCE:                        OK

MIGRATION_CREATED:                         NO
BACKEND_FILES_CHANGED:                     0 (this battery)
LOOPLY_BACKEND_RELOADED:                   NO
FRONTEND_ARTIFACT_CURRENT:                 YES

F14_REGRESSION:                            PASS
F14_1_REGRESSION:                          PASS
F14_1_1_REGRESSION:                        PASS
F14_2_REGRESSION:                          PASS

BACKEND_TESTS:                             434
FRONTEND_TESTS:                            248
BACKEND_TYPECHECK:                         PASS (unchanged)
FRONTEND_TYPECHECK:                        PASS
BACKEND_BUILD:                             PASS (unchanged)
FRONTEND_BUILD:                            PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none

KORE_TOUCHED:                              NO
```

F14.3 OPERATIONAL FILTERS + DRILL-DOWN — LIVE VERIFIED