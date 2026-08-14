# Performance Audit — Looply Frontend F1 — 2026-08-14

## Executive Summary

1. TanStack Query is the server-state source; Zustand contains only sidebar UI state.
2. Existing domain pages use bounded individual queries, but Contents/Dashboard pages can render legacy response collections without frontend pagination.
3. No new F1 performance code was introduced; Figma phases should replace legacy projections with canonical bounded APIs.

## Findings

| Location | Problem | Severity | Recommendation |
|---|---|---|---|
| `src/features/ContentsList.tsx` | Loads the complete legacy `/api/contents` collection and performs client filtering/grouping. | Medium | F6 should consume bounded `/api/jobs` list/board projections. |
| `src/features/Dashboard.tsx` | Uses dashboard plus team query and legacy response fields. | Low | F4 should consume the canonical capability-aware Dashboard contract and avoid redundant team fetches where possible. |
| `src/features/Calendar.tsx` | Fetches `/api/publications` and builds a month projection locally. | Medium | F8 should consume `/api/calendar` bounded range projection. |
| `src/lib/api.ts` | No central handling for 429/503 or cancellation. | Low | Normalize errors/retry policy during F2 API foundation. |

## Checked and Clean

- No API calls inside render loops were found in the inventory.
- No new N+1 frontend request path was introduced.
- QueryClient defaults disable window-focus refetch and use bounded stale time.
- Zustand does not duplicate server entities.

## Deferred

- Figma-driven query redesign.
- Pagination/windowing adoption.
- React Query key normalization during F2/F4-F8.
