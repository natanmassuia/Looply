# Security Audit — Looply B11 Dashboard — 2026-08-14

## Scope

Reviewed Dashboard route/service, all aggregate queries, capability-aware sections, Approval/Calendar/Activity projections, tenant filters, response projections, and cross-tenant tests.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- Informational: 3

## Checked and Clean

- Every Dashboard query uses `companyId` from authenticated context.
- Global `client.count()`, `job.count()`, `user.count()` and status aggregates were removed from Dashboard.
- Team metric uses active `CompanyMember` count, not global User count.
- Dashboard requires `Capability.DASHBOARD`.
- Approval queries run only when `APPROVAL` is present.
- Calendar/upcoming queries run only when `CALENDAR` is present.
- Activity query runs only when `ACTIVITY` is present and is bounded to 10 rows.
- Stage metrics run only when `WORKFLOW` is present.
- Board section is advertised only when `KANBAN` is present.
- `companyId` query spoof is ignored.
- No arbitrary Dashboard filters, date ranges, raw sort columns or frontend capabilities are accepted.
- Response does not include storage, Approval tokens, full Approval history, Files or private metadata.
- GET Dashboard does not create Activity.
- No Dashboard persistence model, cache table, warehouse, or materialized view was introduced.

## Informational Notes

- `publicationTarget` and `scheduledAt` are treated as upcoming operational dates; no fake overdue metric is produced because no generic due date exists.
- Legacy `counts` fields remain in the response for compatibility, but are tenant-scoped.
- Dashboard does not claim to expose analytics or production performance metrics.

## Out of Scope

- Dashboard UI/Figma.
- Analytics warehouse.
- CSRF/rate-limit hardening (B12).
- Production deployment and proxy logging.
