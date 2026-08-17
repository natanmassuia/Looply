# F14.2 — Dashboard Density + Upcoming Appointments + Demand Activity History

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: apply "SUMMARY FIRST. DEPTH ON DEMAND." to the Dashboard and Demand Detail: cap active
demands to 5, replace "Agenda de hoje" with "Próximas agendas" (future, asc, max 3), add a live
workspace-time clock in the header, and cap inline activity history to 5 with a paginated full
history surface. Backend projections/endpoints extended minimally (no schema change, no migration).

## Baseline
- F14 / F14.1 / F14.1.1 LIVE VERIFIED (backend 434 tests, frontend 231 tests).
- Working tree dirty: 65 entries at start (F12.2 → F14.1.1 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving `/opt/looply/frontend/dist`.

## Dashboard Data Audit

```
ACTIVE_DEMANDS_HOOK:           useDashboard → data.recentContents
ACTIVE_DEMANDS_QUERY_KEY:      ["dashboard"]
ACTIVE_DEMANDS_ENDPOINT:       GET /api/dashboard
ACTIVE_DEMANDS_CURRENT_ORDER:  backend orderBy updatedAt desc (recentJobs)
ACTIVE_DEMANDS_CURRENT_LIMIT:  backend RECENT_LIMIT = 10; frontend rendered ALL

APPOINTMENTS_HOOK:             useDashboard → data.upcoming (getCalendar projection)
APPOINTMENTS_QUERY_KEY:        ["dashboard"]
APPOINTMENTS_ENDPOINT:         GET /api/dashboard (calls getCalendar internally, 7-day range)
APPOINTMENTS_CURRENT_FILTER:   getCalendar filters status=SCHEDULED + startsAt < to, OR future range
APPOINTMENTS_CURRENT_ORDER:    events sorted by `at` ASC in getCalendar
```

Findings:
- Dashboard previously rendered `data.recentContents` (up to 10) with no cap.
- The "Agenda de hoje" card only showed counts (scheduled/approved) — no real list.
- `getCalendar` already projected a timezone + ASC-sorted future event list into `dashboard.upcoming`; the frontend simply ignored it.
- Dashboard clock/timezone: `resolveWorkspaceContext` did not expose Company.timezone → no workspace-clock source.

## Active Demands Root Cause

```
DASHBOARD_ACTIVE_DEMAND_COUNT_BEFORE: up to 10 (RECENT_LIMIT), all rendered
DASHBOARD_ACTIVE_DEMAND_SOURCE:       backend recentJobs (orderBy updatedAt desc)
DASHBOARD_ACTIVE_DEMAND_ORDER:        updatedAt desc (preserved — meaningful "most recently active first")
```

## Active Demands Limit

```
DASHBOARD_ACTIVE_DEMAND_LIMIT: 5
ACTIVE_DEMAND_FETCH_LIMITED_SERVER_SIDE: YES — backend `take: ACTIVE_DEMAND_DASHBOARD_LIMIT (5)` on recentJobs
ACTIVE_DEMAND_CLIENT_SIDE_SLICE:         YES (defensive `.slice(0, 5)`)
BACKEND_CHANGE_FOR_ACTIVE_DEMANDS:       dashboardService constant only (no new endpoint)
```

The Dashboard remains a summary — no pagination, no infinite scroll, no giant section.

## View All Demands

```
DASHBOARD_VIEW_ALL_DEMANDS: YES — "Ver todas as demandas" Link → /contents (canonical Demandas
  route). Full tap target, accessible link, browser back returns to Dashboard.
```

## Appointment Domain Audit

```
APPOINTMENT_DATETIME_FIELD: Appointment.startsAt (schema: startsAt DateTime, endsAt DateTime?)
APPOINTMENT_STATUS_VALUES:  AppointmentStatus = "SCHEDULED" | "CANCELLED"
APPOINTMENT_CANCELLED_STATE: "CANCELLED"
APPOINTMENT_COMPLETED_STATE: not modeled as a status; completed jobs fall outside the upcoming window
APPOINTMENT_UPCOMING_DEFINITION: startsAt in the future AND status = "SCHEDULED" (the calendar
  service already filters status: "SCHEDULED"); past / cancelled are excluded by getCalendar.
```

## Upcoming Appointment Query

The Dashboard reuses the existing `getCalendar` projection (no parallel service/model):

```
UPCOMING_APPOINTMENTS_QUERY_SOURCE:   dashboard.upcoming (getCalendar, 7-day range)
UPCOMING_APPOINTMENTS_SERVER_FILTER:  getCalendar → status SCHEDULED, startsAt < to, endsAt overlaps range
UPCOMING_APPOINTMENTS_SERVER_ORDER:   events sorted by `at` ASC
UPCOMING_APPOINTMENTS_SERVER_LIMIT:   backend MAX_EVENTS (500, defensive); frontend cap = 3
```

## Upcoming Appointment UI

Replaced "Agenda de hoje" with **Próximas agendas**:
- Frontend filters `dashboard.upcoming.events` to `at > now`, sorts ascending (already server ASC), takes first 3.
- Each row: `formatAppointmentLine(at, timeZone)` → "18 ago · 14:00" + title + client name; links to the job/calendar.
- Added **Ver agenda completa** → /calendar.
- Empty state: compact, "Nenhuma agenda próxima" + "Os próximos agendamentos aparecerão aqui." — no giant fixed block.

```
UPCOMING_APPOINTMENTS_SECTION:  "Próximas agendas"
UPCOMING_APPOINTMENTS_ORDER:    ascending by `at`
UPCOMING_APPOINTMENTS_LIMIT:    3
PAST_APPOINTMENTS_SHOWN:        NO (filtered `at > now`)
CANCELLED_APPOINTMENTS_SHOWN:   NO (getCalendar status= SCHEDULED)
UPCOMING_APPOINTMENTS_EMPTY_STATE: YES (compact)
VIEW_FULL_CALENDAR:             YES → /calendar
UPCOMING_TIMEZONE_SOURCE:       Company.timezone (via workspace.timezone / dashboard.upcoming.timezone)
```

## Dashboard Timezone / Live Clock (mid-task product requirement)

Added a compact workspace clock in the Dashboard header (desktop + mobile):
- `formatClock(now, timeZone)` + `gmtOffsetLabel(timeZone)` — both `Intl.DateTimeFormat(..., { timeZone })`.
- Label "Horário da empresa · GMT-3" (never hardcoded "Brasília"; derives from configured timezone).
- Minute-level `setInterval` (60s) — no backend polling, no WebSocket.
- Authority: `Company.timezone` exposed through `resolveWorkspaceContext` (added) and `/api/auth/me` workspace select.

```
COMPANY_TIMEZONE_VALUE:        America/Sao_Paulo (current configured value)
DASHBOARD_TIMEZONE_SOURCE:     useMe → workspace.timezone (backend Company.timezone)
BROWSER_TIMEZONE:              not used for the clock or upcoming rendering
TIMEZONE_CONVERSION_REQUIRED:  YES — Intl with explicit timeZone
DASHBOARD_TIMEZONE_VISIBLE_DESKTOP: YES (header, right of title)
DASHBOARD_TIMEZONE_VISIBLE_MOBILE:  YES (same header, wraps on narrow widths)
DASHBOARD_CURRENT_TIME_VISIBLE:     YES
DASHBOARD_CURRENT_TIME_SOURCE:      formatClock(now, workspace.timezone)
DASHBOARD_CLOCK_LIVE_UPDATE:        YES (60s interval)
DASHBOARD_TIMEZONE_CHANGE_PROPAGATION: YES — /me refetches workspace.timezone; clock + upcoming re-render
UPCOMING_APPOINTMENTS_TIMEZONE_MATCH: YES (same timeZone var used for clock and appointment lines)
```

## Demand Activity Audit

```
ACTIVITY_COMPONENT:            JobActivityTimeline (ContentDetail.tsx)
ACTIVITY_HOOK:                 useJobActivity → data.activities
ACTIVITY_QUERY_KEY:            ["jobActivity", jobId]
ACTIVITY_ENDPOINT:             GET /api/jobs/:id/activity
ACTIVITY_CURRENT_FETCH_COUNT:  ALL activities (listJobActivities returned every row)
ACTIVITY_CURRENT_ORDER:        backend createdAt ASC; frontend reversed to newest-first
ACTIVITY_TOTAL_COUNT_SOURCE:   activities.length (client array length)
DEMAND_ACTIVITY_FETCH_MODEL:   fetch all, render all (183 inline → giant page)
```

## Activity Summary

```
DEMAND_ACTIVITY_INITIAL_LIMIT:     5
DEMAND_ACTIVITY_ORDER:             NEWEST_FIRST (backend orderBy createdAt desc now)
DEMAND_ACTIVITY_TOTAL_COUNT_VISIBLE: YES — "Histórico de atividades (183)" uses backend `total`
DEMAND_ACTIVITY_INITIAL_FETCH_LIMITED: YES (hook requests limit=5&offset=0)
DEMAND_ACTIVITY_PAGINATION_SUPPORTED: YES (listJobActivities accepts limit/offset; endpoint exposes them)
BACKEND_CHANGE_FOR_ACTIVITY_HISTORY: activityService + jobs route only (no new domain/service)
```

The Demand Detail summary now renders only the 5 most recent activities; the heading keeps the
true total from the backend `total` field. "Ver todo o histórico" appears only when total > 5.

## Full Activity History

```
ACTIVITY_FULL_HISTORY_PATTERN:       ModalOrSheet (reused primitive), title "Histórico de atividades (total)"
ACTIVITY_FULL_HISTORY_INTERNAL_SCROLL: YES — container `max-h-[65vh] overflow-y-auto`; the page never grows
ACTIVITY_FULL_HISTORY_PAGE_SIZE:      20
ACTIVITY_FULL_HISTORY_PAGINATED:      YES — "Carregar mais" advances offset by 20 (useJobActivityPage)
ACTIVITY_DUPLICATES:                  NO — server returns fresh slice per offset (newest-first)
ACTIVITY_TOTAL_COUNT_CORRECT:         YES — from backend `total`; stable across pages
```

Loading/error/empty states preserved: summary shows skeleton/error/retry; full history shows
first-load spinner, per-page "Carregando…", controlled error with retry, empty state.

## Desktop QA (1440px)

- Demandas em andamento: max 5, order updatedAt desc, "Ver todas as demandas" link, no pagination/giant section.
- Próximas agendas: max 3, future only, ascending, compact empty state, "Ver agenda completa" → /calendar.
- Header clock + "Horário da empresa · GMT-3" visible.
- Demand Detail with 183 activities: 5 inline + total, "Ver todo o histórico" opens scrollable modal.

## Mobile QA (390px)

- Active demands max 5, cards fit, "Ver todas as demandas" reachable.
- Upcoming appointments max 3, title doesn't overflow, metadata wraps.
- Empty state compact; "Ver agenda completa" reachable.
- Header clock wraps without horizontal overflow.
- Full-history sheet fits viewport with internal scroll; no horizontal page overflow.

## Accessibility

- "Ver todas as demandas", "Ver agenda completa", "Ver todo o histórico", "Carregar mais" are
  real buttons/links with accessible names; keyboard-focusable.
- Activity count remains visible text.
- Modal uses existing ModalOrSheet focus/close/scroll behavior; count in title.

## Regression

```
F14_REGRESSION:   PASS — appearance PATCH 200, public upload intent 201, no loopback.
F14_1_REGRESSION: PASS — grouped-demand + mobile Settings untouched.
F14_1_1_REGRESSION: PASS — ClientEditor + identity media propagation intact (no source changes).
```

## Runtime Activation

- Backend changed (activityService, jobs route, dashboardService, capabilities, auth route) →
  `npm run build` + `pm2 restart looply-backend`.
- Frontend changed → `npm run build` → served bundle `index-Bdw9ex-v.js`; Nginx serves
  `/opt/looply/frontend/dist` (unchanged root, no Nginx reload).
- No migration. No Kore.

```
BACKEND_FILES_CHANGED: 5 (activityService, routes/jobs, services/dashboardService, domain/capabilities, routes/auth)
LOOPLY_BACKEND_RELOADED: YES
FRONTEND_ARTIFACT_CURRENT: YES
```

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Backend tests  | 434    | 434   |
| Frontend tests | 231    | 238   |

Backend: no new backend test file (existing suites still pass; projection additions are additive).
Frontend additions:
- dashboard.test.tsx (new): max 5 active demands + view-all; "Próximas agendas" renders max 3 +
  calendar action; past appointment excluded + compact empty state; workspace clock label.
- activity.test.tsx: summary renders 5 + total; hides "Ver todo o histórico" when ≤5; full history
  modal opens with total + "Carregar mais" pagination.

## Resource Safety

```
AVAILABLE_RAM_START: ~1.7 Gi
AVAILABLE_RAM_FINAL: ~1.6 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: backend typecheck → backend tests → backend build → frontend typecheck →
frontend tests → frontend build.

## Git Status

Working tree preserved (F12.2 → F14.2). Session touched:
backend: `services/activityService.ts`, `routes/jobs.ts`, `services/dashboardService.ts`,
`domain/capabilities.ts`, `routes/auth.ts`
frontend: `features/Dashboard.tsx`, `features/ContentDetail.tsx`, `lib/api.ts`, `lib/types.ts`,
`lib/format.ts`, `tests/dashboard.test.tsx` (new), `tests/activity.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.7 Gi
AVAILABLE_RAM_FINAL:                       ~1.6 Gi

DASHBOARD_ACTIVE_DEMAND_COUNT_BEFORE:      up to 10
DASHBOARD_ACTIVE_DEMAND_SOURCE:            backend recentJobs
DASHBOARD_ACTIVE_DEMAND_ORDER:             updatedAt desc
DASHBOARD_ACTIVE_DEMAND_LIMIT:             5
ACTIVE_DEMAND_FETCH_LIMITED_SERVER_SIDE:   YES
ACTIVE_DEMAND_CLIENT_SIDE_SLICE:           YES
DASHBOARD_VIEW_ALL_DEMANDS:                YES (/contents)

APPOINTMENT_DATETIME_FIELD:                Appointment.startsAt
APPOINTMENT_STATUS_VALUES:                 SCHEDULED | CANCELLED
APPOINTMENT_UPCOMING_DEFINITION:           startsAt future AND status = SCHEDULED
UPCOMING_APPOINTMENTS_QUERY_SOURCE:        dashboard.upcoming (getCalendar)
UPCOMING_APPOINTMENTS_SERVER_FILTER:       status SCHEDULED + future range
UPCOMING_APPOINTMENTS_SERVER_ORDER:        `at` ASC
UPCOMING_APPOINTMENTS_SERVER_LIMIT:        backend MAX_EVENTS; frontend 3
UPCOMING_APPOINTMENTS_SECTION:             "Próximas agendas"
UPCOMING_APPOINTMENTS_ORDER:               ascending by datetime
UPCOMING_APPOINTMENTS_LIMIT:               3
PAST_APPOINTMENTS_SHOWN:                   NO
CANCELLED_APPOINTMENTS_SHOWN:              NO
UPCOMING_APPOINTMENTS_EMPTY_STATE:         YES (compact)
VIEW_FULL_CALENDAR:                        YES (/calendar)
UPCOMING_TIMEZONE_SOURCE:                  Company.timezone

COMPANY_TIMEZONE_VALUE:                    America/Sao_Paulo
DASHBOARD_TIMEZONE_SOURCE:                 workspace.timezone (/me)
BROWSER_TIMEZONE:                          not used for clock/upcoming
TIMEZONE_CONVERSION_REQUIRED:              YES (Intl timeZone)
DASHBOARD_TIMEZONE_VISIBLE_DESKTOP:        YES
DASHBOARD_TIMEZONE_VISIBLE_MOBILE:         YES
DASHBOARD_CURRENT_TIME_VISIBLE:            YES
DASHBOARD_CURRENT_TIME_SOURCE:             formatClock(now, workspace.timezone)
DASHBOARD_CLOCK_LIVE_UPDATE:               YES (60s)
DASHBOARD_TIMEZONE_CHANGE_PROPAGATION:     YES
UPCOMING_APPOINTMENTS_TIMEZONE_MATCH:      YES

DEMAND_ACTIVITY_FETCH_MODEL:               paginated (limit/offset), newest first
DEMAND_ACTIVITY_CURRENT_FETCH_COUNT:       5 (summary) / 20 (full-history page)
DEMAND_ACTIVITY_TOTAL_COUNT_SOURCE:        backend total
DEMAND_ACTIVITY_INITIAL_LIMIT:             5
DEMAND_ACTIVITY_ORDER:                     NEWEST_FIRST
DEMAND_ACTIVITY_TOTAL_COUNT_VISIBLE:       YES
DEMAND_ACTIVITY_INITIAL_FETCH_LIMITED:     YES
DEMAND_ACTIVITY_PAGINATION_SUPPORTED:      YES
ACTIVITY_FULL_HISTORY_PATTERN:             ModalOrSheet
ACTIVITY_FULL_HISTORY_INTERNAL_SCROLL:     YES (max-h-[65vh] overflow-y-auto)
ACTIVITY_FULL_HISTORY_PAGE_SIZE:           20
ACTIVITY_FULL_HISTORY_PAGINATED:           YES
ACTIVITY_DUPLICATES:                       NO
ACTIVITY_TOTAL_COUNT_CORRECT:              YES
DEMAND_DETAIL_GIANT_PAGE_REGRESSION:       NO
MOBILE_ACTIVITY_OVERFLOW:                  NO

MIGRATION_CREATED:                         NO
BACKEND_FILES_CHANGED:                     5
LOOPLY_BACKEND_RELOADED:                   YES
FRONTEND_ARTIFACT_CURRENT:                 YES

F14_REGRESSION:                            PASS
F14_1_REGRESSION:                          PASS
F14_1_1_REGRESSION:                        PASS

BACKEND_TESTS:                             434
FRONTEND_TESTS:                            238
BACKEND_TYPECHECK:                         PASS
FRONTEND_TYPECHECK:                        PASS
BACKEND_BUILD:                             PASS
FRONTEND_BUILD:                            PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none

KORE_TOUCHED:                              NO
```

F14.2 DASHBOARD DENSITY + UPCOMING + ACTIVITY HISTORY — LIVE VERIFIED