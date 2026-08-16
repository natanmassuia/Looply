# Performance Audit — Looply B10 Calendar — 2026-08-14

## Executive Summary

1. Calendar uses one scoped Job query after small tenant/filter validation queries; no query per day/client/event.
2. Projection is minimal and does not load Activity, Approval, files, versions or media.
3. Range is bounded to 90 days and result rows are capped at 501 before projection.

## Findings

| Location | Problem | Severity | Recommended Fix |
|---|---|---|---|
| `src/services/calendarService.ts:getCalendar` | Calendar returns at most 500 events and has no pagination token. | Low | Add windowing/pagination only after real volume requires it. `truncated` and `totalEvents` expose current behavior. |
| Calendar OR over `publicationTarget`/`scheduledAt` | Two temporal fields require an OR predicate. | Info | Reuse existing fields; add compound indexes only after EXPLAIN/real measurements. |

## Query Strategy

- Company lookup for timezone.
- Optional Client/Stage tenant validation.
- One Job query with `companyId`, range OR, filters, select projection and `take=501`.
- In-memory projection into DUE-like `PUBLICATION_TARGET` and `SCHEDULED` events.
- Stable sort by event timestamp and id.

## Index Review

Existing useful indexes include Job `companyId`, `clientId`, `currentStageId`, `workflowId`, and status. No speculative B10 migration/index was added.

## Quick Wins

- Keep 90-day range cap.
- Keep 500 event cap.
- Keep minimal select.
- Do not issue storage/activity/approval queries per event.

## Deferred

- Month/week presentation queries.
- Materialized calendar views.
- Index changes after measured query plans.
