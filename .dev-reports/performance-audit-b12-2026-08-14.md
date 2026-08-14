# Performance Audit — Looply B12 Hardening — 2026-08-14

## Executive Summary

1. Existing B7/B10/B11 caps remain active: Jobs list 100, board 500 projection risk, Calendar 500, Dashboard recent/attention/activity 10.
2. Storage list avoids HEAD per attachment; Approval public read avoids storage calls; Dashboard avoids storage calls.
3. Reconciliation is explicitly bounded to 500 object HEADs per command run.

## Findings

| Location | Problem | Severity | Recommended Fix |
|---|---|---|---|
| `src/services/rateLimit.ts` | In-memory map is per process and can grow with many unique keys until windows expire. | Low | Keep for single-node V1; use distributed limiter only when scaling. |
| `src/services/attachmentReconciliationService.ts` | Reconciliation performs one HEAD per scanned object. | Low | Bounded to 500; schedule operationally only when storage is configured. |
| Existing board/calendar/approval list projections | Some lists have caps but no cursor pagination. | Info | Revisit with real volume; current explicit caps prevent unbounded responses. |

## Verified

- No new N+1 query pattern introduced.
- No storage HEAD during attachment list or Dashboard.
- No full Job/Approval/File collection in Dashboard.
- Public Approval file download signs only the requested file.
- Rate limiter does not perform DB/storage I/O.
- Health/readiness does not call object storage on every request.

## Deferred

- Cache/materialized views.
- Distributed rate limiting.
- Cursor pagination/windowing after measured volume.
- Storage reconciliation scheduling.
