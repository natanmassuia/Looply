# Performance Audit — Looply B11 Dashboard — 2026-08-14

## Executive Summary

1. Dashboard executes independent bounded sections in parallel with `Promise.all`.
2. Recent Jobs, attention Jobs and recent Activity have explicit limits.
3. No storage calls, no N+1 relation loops, no full tenant collections and no cache/persistence layer were introduced.

## Findings

| Location | Problem | Severity | Recommended Fix |
|---|---|---|---|
| `src/services/dashboardService.ts:getDashboardForCompany` | Multiple parallel aggregate queries are executed for a full Dashboard response. | Low | Keep the simple bounded projection; profile before consolidating into a complex query. |
| `src/services/dashboardService.ts` recent projection | Recent Jobs include latest version metadata for legacy frontend compatibility. | Low | Keep until frontend migration; reduce fields when the Figma client contract is adopted. |
| `src/services/dashboardService.ts` upcoming | Calendar upcoming uses a fixed 7-day window and Calendar's bounded projection. | Info | Correct for attention projection; do not accept arbitrary Dashboard ranges. |

## Query Strategy

- Company lookup by authenticated Company ID.
- Client status groupBy.
- Job lifecycle/status groupBys.
- Active membership count scoped to Company.
- Recent Jobs bounded to 10.
- Attention Jobs bounded to 10.
- Stage groupBy/stage names only with WORKFLOW.
- Approval counts only with APPROVAL.
- Calendar upcoming only with CALENDAR and fixed 7-day range.
- Activity only with ACTIVITY and bounded to 10.

## N+1 Review

No query is executed inside a loop. Relations use Prisma select/include and all sections are bounded.

## Quick Wins

- Keep attention/recent limits explicit.
- Keep capability sections lazy.
- Keep Dashboard range fixed.
- Avoid storage or full Approval/File loading.

## Deferred

- Materialized metrics.
- Cache.
- Analytics warehouse.
- Dashboard query consolidation after measurement.
