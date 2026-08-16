# Performance Audit — Looply B7 Operational Views — 2026-08-14

## Executive Summary

1. List uses two bounded queries (`count` + `findMany`) and caps page size at 100.
2. Board uses one workflow query and one Job query; it does not perform N+1 queries per stage/card.
3. Board is intentionally unpaginated because it is a complete workflow projection; this is the only current B7 volume risk.

## Findings

| Location | Problem | Severity | Recommended Fix |
|---|---|---|---|
| `src/services/jobService.ts:getJobBoard` | Complete board payload is returned for the tenant; large tenants can produce a large response. | Low | Add stage/window pagination or a board item limit when real operational volume requires it. |
| `src/services/jobService.ts:getJobBoard` | In-memory stage grouping scans the returned Job array once per stage. | Low | Replace with a single-pass Map grouping if stage/job volume becomes material. Current stage count is small and there is no database N+1. |
| `src/services/jobService.ts:listJobs` | List performs count and data queries in parallel, but count still scans the filtered scope. | Info | Keep until measured; existing companyId/currentStage/client indexes support the main filters. |

## Query Strategy

- List: one `count` and one bounded `findMany` in parallel.
- Board: one scoped workflow query and one scoped Job query with minimal card projection.
- Summary: two scoped `groupBy` queries in parallel.
- No loop performs database I/O per stage or per Job.

## Index Review

Existing useful indexes:

- `Job.companyId`
- `Job.clientId`
- `Job.workflowId`
- `Job.currentStageId`
- `Job.status`
- `Client.companyId`
- unique `WorkflowDefinition.companyId`
- unique/index `WorkflowStage.workflowId`

No speculative migration or index was added in B7.

## Quick Wins

- Keep list limit capped at 100.
- Keep board card projection minimal.
- Keep sort fields allowlisted.
- Prefer one batch Job query for board projection.

## Deferred

- Board pagination/windowing after real usage data.
- Dashboard aggregation optimization in B11.
- Cache only after measurements demonstrate repeated expensive reads.
