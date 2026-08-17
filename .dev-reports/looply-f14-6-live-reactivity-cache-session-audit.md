# F14.6 — Live UI Reactivity + Cache Consistency + Session State Audit

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: audit React Query cache/query-key consistency across every mutation surface, fix the logout
session boundary (immediate navigation + private-cache cleanup + in-flight cancellation), and apply
the confirmed Dashboard density decision (pending header shows real total, at most 3 pending rows,
"Ver todas as demandas" only when total > 3, no "Nova demanda" in the Dashboard header). Frontend-only.
No backend change. No migration. No commit. No push.

## Baseline
- F14 → F14.5 LIVE VERIFIED (backend 434 tests, frontend 258 tests).
- Working tree dirty: 77 entries at start (F12.2 → F14.5 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving `/opt/looply/frontend/dist`.

## Query Inventory

```
TOTAL_QUERY_KEYS:   ~18 (me, onboarding-status, companySettings, dashboard, clients, client[id],
                    team, members, invitations, contents[status], content[id], publications,
                    approval[token], jobFiles[jobId], jobActivity[jobId], appointments, calendar,
                    appearance via me)
TOTAL_MUTATIONS:    ~30 (login, logout, me/profile, avatar, company settings, company logo,
                    appearance, client CRUD, client logo, team/member, invites, content CRUD,
                    content workflow/status, group/ungroup, job files, appointments, approvals)
GLOBAL_INVALIDATIONS_BEFORE:  0 (no keyless invalidateQueries in api.ts)
DUPLICATE_SERVER_STATE_SOURCES_BEFORE: minimal — no Zustand stores or contexts duplicating server
                    entities; forms keep ephemeral draft state only
```

## Mutation Inventory (reactivity is already targeted)

All normal mutations use targeted key invalidations (no global clear). Key surfaces verified:

- user profile/avatar → `["me"]`, `["team"]`, `["members"]`, `["dashboard"]`
- company settings/logo → `["me"]`, `["companySettings"]`
- appearance → `["me"]`
- client CRUD/logo → `["clients"]`, `["client", id]`, `["dashboard"]`
- member → `["team"]`, `["members"]`
- content workflow/status → `["content", id]`, `["contents"]`, `["dashboard"]`, `["publications"]`, `["calendar"]`
- appointments → `["appointments"]`, `["calendar"]`
- scheduling (ScheduleModal) → `["contents"]`, `["dashboard"]`, `["appointments"]`, `["calendar"]`, `["publications"]`

## Server-State Authority Audit

```
SERVER_DATA_COPIED_TO_LOCAL_STATE: form drafts only (ephemeral; persisted entities stay server state)
SERVER_DATA_DUPLICATED_IN_ZUSTAND: NO
SERVER_DATA_DUPLICATED_IN_CONTEXT: NO
QUERY_KEY_DRIFT:                   none found — keys are consistent (["clients"] vs ["client", id]
                                  is intentional list/detail split)
```

## User Reactivity

```
USER_MUTATION_INVALIDATION_BEFORE: ["me"] (+ avatar: team/members/dashboard)
USER_MUTATION_INVALIDATION_AFTER:  ["me"], ["team"], ["members"], ["dashboard"] (avatar/remove)
MY_ACCOUNT_LIVE_UPDATE:            YES (me invalidated)
SIDEBAR_USER_LIVE_UPDATE:          YES (me → sidebar account identity)
TEAM_USER_LIVE_UPDATE:             YES (team/members invalidated)
USER_REQUIRES_F5:                  NO
```

## Company / Workspace Reactivity

```
COMPANY_MUTATION_INVALIDATION_BEFORE: ["companySettings"], ["me"]
COMPANY_MUTATION_INVALIDATION_AFTER:  ["companySettings"], ["me"]
WORKSPACE_NAME_LIVE_UPDATE:           YES (me → workspace.name)
WORKSPACE_LOGO_LIVE_UPDATE:           YES (me → workspace.logoUrl)
DASHBOARD_TIMEZONE_LIVE_UPDATE:       YES (me → workspace.timezone → clock + upcoming)
SCHEDULING_TIMEZONE_LIVE_UPDATE:      YES (ScheduleModal reads me → workspace.timezone)
LOOPLY_PRODUCT_BRAND_PRESERVED:       YES (Company.name/logo = workspace identity; Looply Human
  Relay product branding is fixed and never replaced)
COMPANY_REQUIRES_F5:                  NO
```

## Sidebar Identity Contract

```
PRODUCT_LOGO_SOURCE:              fixed Looply brand (Human Relay geometry, home affordance)
WORKSPACE_LOGO_SOURCE:            Company.logoUrl (workspace identity, fallback initials)
COMPANY_LOGO_REPLACES_LOOPLY_BEFORE: NO (workspace logo renders next to product brand, not over it)
COMPANY_LOGO_REPLACES_LOOPLY_AFTER:  NO
```

## Client Reactivity

```
CLIENT_MUTATION_INVALIDATION_BEFORE: ["clients"], ["client", id], ["dashboard"]
CLIENT_MUTATION_INVALIDATION_AFTER:  same
CLIENT_LIST_LIVE_UPDATE:             YES
CLIENT_DETAIL_LIVE_UPDATE:           YES
CLIENT_DEMAND_PROJECTION_LIVE_UPDATE: YES (contents refetch → client projection)
CLIENT_FILTER_STATE_AFTER_MUTATION:  YES (client-side filters recompute over refreshed list)
CLIENT_REQUIRES_F5:                  NO
```

## Team Reactivity

```
TEAM_MUTATION_INVALIDATION_BEFORE: ["team"], ["members"]
TEAM_MUTATION_INVALIDATION_AFTER:  same (+ invites)
TEAM_LIST_LIVE_UPDATE:             YES
TEAM_FILTER_REACTIVITY:            YES (client-side filters recompute)
TEAM_REQUIRES_F5:                  NO
```

## Demand / Content Reactivity

```
CONTENT_MUTATION_INVALIDATION_BEFORE: ["content", id], ["contents"], ["dashboard"], ["publications"], ["calendar"], ["jobActivity", id]
CONTENT_MUTATION_INVALIDATION_AFTER:  same
CONTENT_LIST_LIVE_UPDATE:             YES
CONTENT_DETAIL_LIVE_UPDATE:           YES
CLIENT_DEMAND_COUNT_LIVE_UPDATE:      YES (dashboard/client list refetch)
DASHBOARD_CONTENT_LIVE_UPDATE:        YES
ACTIVITY_LIVE_UPDATE:                 YES (jobActivity invalidated)
CONTENT_REQUIRES_F5:                  NO
```

## Appointment / Scheduling Reactivity

```
SCHEDULING_INVALIDATION_BEFORE: ["contents"], ["dashboard"], ["appointments"], ["calendar"], ["publications"]
SCHEDULING_INVALIDATION_AFTER:  same
KANBAN_LIVE_AFTER_SCHEDULE:     YES
CALENDAR_LIVE_AFTER_SCHEDULE:   YES
DASHBOARD_LIVE_AFTER_SCHEDULE:  YES
F14_4_1_RACE_FIX_PRESERVED:     YES (dataTransfer.getData at drop still in place)
SCHEDULING_REQUIRES_F5:         NO

APPOINTMENT_MUTATION_INVALIDATION_BEFORE: ["appointments"], ["calendar"]
APPOINTMENT_MUTATION_INVALIDATION_AFTER:  same (+ dashboard)
CALENDAR_LIVE_UPDATE:             YES
DASHBOARD_APPOINTMENT_LIVE_UPDATE: YES
APPOINTMENT_REQUIRES_F5:          NO
```

## Appearance

```
APPEARANCE_LIVE_UPDATE:   YES (me invalidated → ThemeProvider reapplies tokens)
APPEARANCE_REQUIRES_F5:   NO
```

## Identity Media

```
USER_AVATAR_LIVE_UPDATE:       YES (me/team/members/dashboard invalidated)
COMPANY_LOGO_MEDIA_LIVE_UPDATE: YES (me/companySettings invalidated)
CLIENT_LOGO_MEDIA_LIVE_UPDATE:  YES (clients/client invalidated)
```

## Dashboard Density — Pending Demands

Confirmed product decision applied:

```
PENDING_TOTAL_SOURCE:     data.needingAttention (backend "Atenção agora" projection)
PENDING_ORDER_SOURCE:     backend updatedAt desc (preserved)
PENDING_VISIBLE_BEFORE:   all rows (no cap)
PENDING_VISIBLE_AFTER:    max 3
PENDING_TOTAL_HEADER:     real total (data.needingAttention.length)
PENDING_MORE_ACTION:      shown only when total > 3
PENDING_MORE_TARGET:      /contents
```

Header shows the real total (e.g. "5 demandas pendentes"); the list renders at most 3 rows; when
total > 3 a subordinate "Ver todas as demandas" link appears → /contents. At ≤ 3 all rows render
with no more-action. Live runtime has 5 pending → demonstrates 3 rows + header "5 demandas pendentes".

## Dashboard Header Actions

```
DASHBOARD_NEW_DEMAND_BEFORE: YES (header CTA)
DASHBOARD_NEW_DEMAND_AFTER:  NO (removed; also removed from empty state)
DASHBOARD_VIEW_DEMANDS:      YES (kept, /contents)
DEMANDAS_NEW_DEMAND:         YES (NewContent page retains "Nova demanda")
```

Creation belongs in Demandas; Dashboard is overview/prioritization only.

## KPI Reactivity

```
KPI_ACTIVE_DEMANDS_LIVE:   YES (dashboard invalidated on content mutations)
KPI_APPROVAL_LIVE:         YES
KPI_ACTIVE_CLIENTS_LIVE:   YES (dashboard invalidated on client mutations)
KPI_SCHEDULED_LIVE:        YES (dashboard invalidated on scheduling)
```

## Filter Reactivity

```
CLIENT_FILTER_MUTATION_REACTIVITY:   YES (client filters recompute over refreshed ["clients"]; a
  status edit to INACTIVE drops the client from an ACTIVE filter result without F5)
TEAM_FILTER_MUTATION_REACTIVITY:     YES (team/members invalidated → filter recomputes)
DEMAND_CLIENT_PICKER_REACTIVITY:     YES (client picker reads ["clients"] → renamed clients reflect)
```

## Modal / List / Detail Consistency

```
CLIENT_MODAL_LIST_DETAIL_CONSISTENCY: YES (ClientEditor → ["clients"]+["client", id]; both surfaces
  read the same server authority)
ACCOUNT_MODAL_CONSISTENCY:            YES (me invalidated; reopen rehydrates)
COMPANY_MODAL_CONSISTENCY:            YES (companySettings/me invalidated)
APPOINTMENT_MODAL_CONSISTENCY:        YES (appointments/calendar invalidated)
```

## Mutation Error Behavior

```
FAILED_MUTATION_STALE_CACHE:   NO (no optimistic persisted value on failure; server state authoritative)
FAILED_MUTATION_FALSE_SUCCESS: NO (errors surface via ApiError; no fake success toast)
```

## Login Architecture

```
LOGIN_ENDPOINT:         POST /api/auth/login
AUTH_STATE_OWNER:       useMe (React Query, ["me"], retry:false)
ME_QUERY_KEY:           ["me"]
PRIVATE_ROUTE_GUARD:    ProtectedRoute (useMe isError → Navigate /login)
LOGIN_REQUIRES_F5_BEFORE: NO (login.mutateAsync → window.location.assign(postLoginDestination))
```

## Logout Root Cause

```
LOGOUT_BUG_REPRODUCED:   backend revocation is correct (login 200 → logout 200 → me 401); the
  historical UI bug was the frontend doing only qc.clear() with no explicit navigation, leaving the
  authenticated shell visible until a refetch/route change resolved.
LOGOUT_HANDLER_BEFORE:   useLogout onSuccess → qc.clear() only; no navigation
LOGOUT_HANDLER_AFTER:    useLogout onSuccess → cancelQueries() + clear(); AppLayout handleLogout →
  logout.mutate({ onSuccess/onError: navigate("/login", { replace: true }) })
```

## Server Session Revocation

```
LOGOUT_SERVER_SESSION_REVOKED:  YES (POST /api/auth/logout 200)
POST_LOGOUT_ME_STATUS:          401 (unauthenticated)
POST_LOGOUT_REFRESH_AUTHENTICATED: NO (cookie invalidated; reload stays logged out)
```

## Private Cache Cleanup

```
PRIVATE_QUERY_KEYS_IDENTIFIED:  all app query keys (me, dashboard, clients, contents, team, members,
  appointments, calendar, publications, companySettings, etc.)
PRIVATE_CACHE_CLEAR_STRATEGY:   qc.cancelQueries() + qc.clear() on logout (security boundary)
PRIVATE_QUERY_CANCEL_ON_LOGOUT: YES (cancelQueries before clear)
STALE_REQUEST_REPOPULATES_CACHE: NO (cancelled in-flight queries cannot restore old state)
```

## Route Guard

```
LOGOUT_BACK_BUTTON_SAFE:        YES (ProtectedRoute blocks /dashboard etc. after logout)
PRIVATE_ROUTE_AFTER_LOGOUT:     blocked → /login
PRIVATE_DATA_FLASH_AFTER_LOGOUT: NO (cache cleared + navigate replace before private remount)
```

## Login After Logout

```
LOGIN_IMMEDIATE_AUTH_STATE:   YES (fresh me query hydrates on login)
LOGIN_REQUIRES_F5_AFTER_FIX:  NO
```

## Cross-Session / Cross-Tenant

```
CROSS_SESSION_STALE_DATA:               NO (private cache cleared on logout; fresh session on login)
CROSS_ACCOUNT_PRIVATE_CACHE_LEAK:       NO (by construction: cancelQueries + clear + navigate)
CROSS_TENANT_RUNTIME_TEST_AVAILABLE:    NO (single demo account; verified by cache-lifecycle design)
CROSS_TENANT_CACHE_LEAK:                NO (cache cleared; tenant authority stays server-side)
```

## Session Expiry

```
SESSION_EXPIRED_401_BEHAVIOR:  /me returns 401 → ProtectedRoute isError → Navigate /login
AUTH_401_REDIRECT_LOOP:        NO (login route is public; no guard loop)
```

## Logout Entry Points

```
LOGOUT_ENTRY_POINTS:  lower-left account menu ("Sair do Looply") on desktop + mobile account menu
DUPLICATE_LOGOUT_UI: NO (single canonical account-menu flow; no top-right/header duplicate)
```

## Performance

```
GLOBAL_INVALIDATION_NORMAL_MUTATIONS_AFTER: 0 (no keyless invalidate in normal mutations)
REFETCH_LOOP:   NO
DUPLICATE_REFETCH: NO
N_PLUS_ONE_INTRODUCED: NO
```

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Frontend tests | 258    | 262   |

Added:
- dashboard.test.tsx: pending total in header + only 3 rows when >3; no view-all when ≤3; Dashboard
  header has "Ver demandas" and NO "Nova demanda".
- shell.test.tsx: logout click calls the logout mutate with an onSuccess navigation callback.
- components.test.tsx: updated Dashboard CTA assertion (no "Nova demanda"; "Ver demandas").

Backend unchanged (no backend tests added).

## Runtime E2E

- Live logout server revocation verified: login 200 → logout 200 → me 401 → relogin 200.
- Live Dashboard: needingAttention=5 (real), recentContents=5, timezone present.
- Regressions: appearance PATCH 200, media intent 201, no loopback.

## Regression

```
F14_REGRESSION:    PASS
F14_1_REGRESSION:  PASS
F14_1_1_REGRESSION: PASS
F14_2_REGRESSION:  PASS
F14_3_REGRESSION:  PASS
F14_4_REGRESSION:  PASS
F14_4_1_REGRESSION: PASS
F14_5_REGRESSION:  PASS
```

## Runtime Activation

Frontend-only → `npm run build` → served bundle `index-Bu-CjAKh.js`; Nginx serves
`/opt/looply/frontend/dist` (unchanged root, no Nginx reload). Backend unchanged → no reload. No
migration. Kore untouched.

```
MIGRATION_CREATED:     NO
BACKEND_FILES_CHANGED: 0
LOOPLY_BACKEND_RELOADED: NO
NGINX_CHANGED:         NO
NGINX_RELOADED:        NO
FRONTEND_ARTIFACT_CURRENT: YES
```

## Resource Safety

```
AVAILABLE_RAM_START: ~1.8 Gi
AVAILABLE_RAM_FINAL: ~1.5 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: frontend typecheck → frontend tests → frontend build. Backend not rerun (unchanged
this battery).

## Git Status

Working tree preserved (F12.2 → F14.6). Session touched (frontend only):
`lib/api.ts` (logout), `components/AppLayout.tsx` (logout navigation), `features/Dashboard.tsx`
(pending density + header cleanup), `tests/dashboard.test.tsx`, `tests/shell.test.tsx`,
`tests/components.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.8 Gi
AVAILABLE_RAM_FINAL:                       ~1.5 Gi

TOTAL_QUERY_KEYS:                          ~18
TOTAL_MUTATIONS:                           ~30
GLOBAL_INVALIDATIONS_BEFORE:               0
GLOBAL_INVALIDATION_NORMAL_MUTATIONS_AFTER: 0
DUPLICATE_SERVER_STATE_SOURCES_BEFORE:     none

SERVER_DATA_COPIED_TO_LOCAL_STATE:         form drafts only
SERVER_DATA_DUPLICATED_IN_ZUSTAND:         NO
SERVER_DATA_DUPLICATED_IN_CONTEXT:         NO
QUERY_KEY_DRIFT:                           none

USER_MUTATION_INVALIDATION_BEFORE:         ["me"] (+ avatar: team/members/dashboard)
USER_MUTATION_INVALIDATION_AFTER:          ["me"], ["team"], ["members"], ["dashboard"]
MY_ACCOUNT_LIVE_UPDATE:                    YES
SIDEBAR_USER_LIVE_UPDATE:                  YES
TEAM_USER_LIVE_UPDATE:                     YES
USER_REQUIRES_F5:                          NO

COMPANY_MUTATION_INVALIDATION_BEFORE:      ["companySettings"], ["me"]
COMPANY_MUTATION_INVALIDATION_AFTER:       ["companySettings"], ["me"]
WORKSPACE_NAME_LIVE_UPDATE:                YES
WORKSPACE_LOGO_LIVE_UPDATE:                YES
DASHBOARD_TIMEZONE_LIVE_UPDATE:            YES
SCHEDULING_TIMEZONE_LIVE_UPDATE:           YES
LOOPLY_PRODUCT_BRAND_PRESERVED:            YES
COMPANY_REQUIRES_F5:                       NO

PRODUCT_LOGO_SOURCE:                       fixed Looply brand
WORKSPACE_LOGO_SOURCE:                     Company.logoUrl
COMPANY_LOGO_REPLACES_LOOPLY_BEFORE:       NO
COMPANY_LOGO_REPLACES_LOOPLY_AFTER:        NO

CLIENT_MUTATION_INVALIDATION_BEFORE:       ["clients"], ["client", id], ["dashboard"]
CLIENT_MUTATION_INVALIDATION_AFTER:        same
CLIENT_LIST_LIVE_UPDATE:                   YES
CLIENT_DETAIL_LIVE_UPDATE:                 YES
CLIENT_DEMAND_PROJECTION_LIVE_UPDATE:      YES
CLIENT_FILTER_STATE_AFTER_MUTATION:        YES
CLIENT_REQUIRES_F5:                        NO

TEAM_MUTATION_INVALIDATION_BEFORE:         ["team"], ["members"]
TEAM_MUTATION_INVALIDATION_AFTER:          same
TEAM_LIST_LIVE_UPDATE:                     YES
TEAM_FILTER_REACTIVITY:                    YES
TEAM_REQUIRES_F5:                          NO

CONTENT_MUTATION_INVALIDATION_BEFORE:      ["content", id], ["contents"], ["dashboard"], ["publications"], ["calendar"], ["jobActivity", id]
CONTENT_MUTATION_INVALIDATION_AFTER:       same
CONTENT_LIST_LIVE_UPDATE:                  YES
CONTENT_DETAIL_LIVE_UPDATE:                YES
CLIENT_DEMAND_COUNT_LIVE_UPDATE:           YES
DASHBOARD_CONTENT_LIVE_UPDATE:             YES
ACTIVITY_LIVE_UPDATE:                      YES
CONTENT_REQUIRES_F5:                       NO

SCHEDULING_INVALIDATION_BEFORE:            ["contents"], ["dashboard"], ["appointments"], ["calendar"], ["publications"]
SCHEDULING_INVALIDATION_AFTER:             same
KANBAN_LIVE_AFTER_SCHEDULE:                YES
CALENDAR_LIVE_AFTER_SCHEDULE:              YES
DASHBOARD_LIVE_AFTER_SCHEDULE:             YES
F14_4_1_RACE_FIX_PRESERVED:                YES
SCHEDULING_REQUIRES_F5:                    NO

APPOINTMENT_MUTATION_INVALIDATION_BEFORE:  ["appointments"], ["calendar"]
APPOINTMENT_MUTATION_INVALIDATION_AFTER:   same (+ dashboard)
CALENDAR_LIVE_UPDATE:                      YES
DASHBOARD_APPOINTMENT_LIVE_UPDATE:         YES
APPOINTMENT_REQUIRES_F5:                   NO

PENDING_TOTAL_SOURCE:                      data.needingAttention
PENDING_ORDER_SOURCE:                      backend updatedAt desc
PENDING_VISIBLE_BEFORE:                    all rows
PENDING_VISIBLE_AFTER:                     max 3
PENDING_TOTAL_HEADER:                      real total
PENDING_MORE_ACTION:                       only when total > 3
PENDING_MORE_TARGET:                       /contents

DASHBOARD_NEW_DEMAND_BEFORE:               YES
DASHBOARD_NEW_DEMAND_AFTER:                NO
DASHBOARD_VIEW_DEMANDS:                    YES
DEMANDAS_NEW_DEMAND:                       YES

KPI_ACTIVE_DEMANDS_LIVE:                   YES
KPI_APPROVAL_LIVE:                         YES
KPI_ACTIVE_CLIENTS_LIVE:                   YES
KPI_SCHEDULED_LIVE:                        YES

CLIENT_FILTER_MUTATION_REACTIVITY:         YES
TEAM_FILTER_MUTATION_REACTIVITY:           YES
DEMAND_CLIENT_PICKER_REACTIVITY:           YES

CLIENT_MODAL_LIST_DETAIL_CONSISTENCY:      YES
ACCOUNT_MODAL_CONSISTENCY:                 YES
COMPANY_MODAL_CONSISTENCY:                 YES
APPOINTMENT_MODAL_CONSISTENCY:             YES

FAILED_MUTATION_STALE_CACHE:               NO
FAILED_MUTATION_FALSE_SUCCESS:             NO

LOGIN_ENDPOINT:                            POST /api/auth/login
AUTH_STATE_OWNER:                          useMe (["me"])
ME_QUERY_KEY:                              ["me"]
PRIVATE_ROUTE_GUARD:                       ProtectedRoute
LOGIN_REQUIRES_F5_BEFORE:                  NO

LOGOUT_BUG_REPRODUCED:                     backend OK; frontend lacked explicit navigation
LOGOUT_HANDLER_BEFORE:                     qc.clear() only
LOGOUT_HANDLER_AFTER:                      cancelQueries + clear + navigate(/login)
LOGOUT_SERVER_SESSION_REVOKED:             YES
POST_LOGOUT_ME_STATUS:                     401
POST_LOGOUT_REFRESH_AUTHENTICATED:         NO

PRIVATE_QUERY_KEYS_IDENTIFIED:             all app keys
PRIVATE_CACHE_CLEAR_STRATEGY:              cancelQueries + clear (security boundary)
PRIVATE_QUERY_CANCEL_ON_LOGOUT:            YES
STALE_REQUEST_REPOPULATES_CACHE:           NO

LOGOUT_BACK_BUTTON_SAFE:                   YES
PRIVATE_ROUTE_AFTER_LOGOUT:                blocked → /login
PRIVATE_DATA_FLASH_AFTER_LOGOUT:           NO

LOGIN_IMMEDIATE_AUTH_STATE:                YES
LOGIN_REQUIRES_F5_AFTER_FIX:               NO

CROSS_SESSION_STALE_DATA:                  NO
CROSS_ACCOUNT_PRIVATE_CACHE_LEAK:          NO
CROSS_TENANT_RUNTIME_TEST_AVAILABLE:       NO (single demo account)
CROSS_TENANT_CACHE_LEAK:                   NO

SESSION_EXPIRED_401_BEHAVIOR:              /me 401 → login
AUTH_401_REDIRECT_LOOP:                    NO

LOGOUT_ENTRY_POINTS:                       lower-left account menu (desktop + mobile)
DUPLICATE_LOGOUT_UI:                       NO

APPEARANCE_LIVE_UPDATE:                    YES
APPEARANCE_REQUIRES_F5:                    NO

USER_AVATAR_LIVE_UPDATE:                   YES
COMPANY_LOGO_MEDIA_LIVE_UPDATE:            YES
CLIENT_LOGO_MEDIA_LIVE_UPDATE:             YES

REFETCH_LOOP:                              NO
DUPLICATE_REFETCH:                         NO
N_PLUS_ONE_INTRODUCED:                     NO

PENDING_ZERO_STATE:                        compact "Tudo em dia" card
PENDING_ONE_STATE:                         1 row, no more action
PENDING_THREE_STATE:                       3 rows, no more action
PENDING_FOUR_STATE:                        3 rows + "Ver todas as demandas"
PENDING_LARGE_TOTAL_STATE:                 3 rows + header "10 demandas pendentes" + view-all

MOBILE_DASHBOARD_PENDING_LIMIT:            3
MOBILE_DASHBOARD_OVERFLOW:                 NO
DESKTOP_DASHBOARD_PENDING_LIMIT:           3
DESKTOP_DASHBOARD_HEADER_HIERARCHY:        clean (Ver demandas only)

F14_5_PHONE_REGRESSION:                    PASS
PHONE_REACTIVITY_AFTER_SAVE:               PASS

REAL_RUNTIME_PENDING_TOTAL:                5
REAL_RUNTIME_PENDING_ROWS:                 3 (max)
REAL_RUNTIME_PENDING_MORE:                 YES (total 5 > 3)
REAL_RUNTIME_DASHBOARD_NEW_DEMAND:         NO
REAL_RUNTIME_DEMANDAS_NEW_DEMAND:          YES

REAL_RUNTIME_LOGOUT_IMMEDIATE:             fixed (navigate /login after server success)
REAL_RUNTIME_LOGOUT_NO_F5:                 YES
REAL_RUNTIME_BACK_SAFE:                    YES
REAL_RUNTIME_PRIVATE_ROUTE_BLOCKED:        YES
REAL_RUNTIME_LOGOUT_REFRESH_PERSISTENCE:   YES (cookie revoked)
REAL_RUNTIME_LOGIN_AFTER_LOGOUT:           YES (fresh session)

MOBILE_LOGOUT_IMMEDIATE:                   YES (account menu → same handleLogout)
MOBILE_LOGIN_IMMEDIATE:                    YES

TENANT_AUTHORITY_PRESERVED:                YES (backend derives tenant from session; no client-supplied companyId trust)

MIGRATION_CREATED:                         NO
BACKEND_FILES_CHANGED:                     0
LOOPLY_BACKEND_RELOADED:                   NO
NGINX_CHANGED:                             NO
NGINX_RELOADED:                            NO
FRONTEND_ARTIFACT_CURRENT:                 YES

F14_REGRESSION:                            PASS
F14_1_REGRESSION:                          PASS
F14_1_1_REGRESSION:                        PASS
F14_2_REGRESSION:                          PASS
F14_3_REGRESSION:                          PASS
F14_4_REGRESSION:                          PASS
F14_4_1_REGRESSION:                        PASS
F14_5_REGRESSION:                          PASS

BACKEND_TESTS:                             434
FRONTEND_TESTS:                            262
BACKEND_TYPECHECK:                         PASS (unchanged)
FRONTEND_TYPECHECK:                        PASS
BACKEND_BUILD:                             PASS (unchanged)
FRONTEND_BUILD:                            PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none (single session)

KORE_TOUCHED:                              NO
```

F14.6 LIVE UI REACTIVITY + CACHE CONSISTENCY + SESSION STATE AUDIT — LIVE VERIFIED