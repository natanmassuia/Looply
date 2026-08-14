# Security Audit — Looply B6 Jobs + Workflow + Activity — 2026-08-14

## Scope

Reviewed the Job/Workflow/Activity schema and migration, canonical `/api/jobs` and `/api/workflows` routes, legacy `/api/contents` bridge, Client attachment validation, Activity queries, capability gates, direct Prisma callers, and cross-tenant tests.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 2
- Informational: 3

## Low Findings

| Finding | Location | Decision |
|---|---|---|
| Legacy Approval/public-token paths still resolve the mapped Job by token/id without authenticated tenant context | `backend/src/services/approvalService.ts` | Approval is B9 and public approval token behavior is intentionally preserved. B6 does not change the public approval contract. |
| Dashboard aggregates remain global | `backend/src/services/dashboardService.ts` | Dashboard belongs to B11. B6 does not claim dashboard tenant isolation. |

## Checked and Clean

- Job list/detail/create/update/transition use `req.auth.companyId`.
- Client attachment requires `Client.id + Client.companyId`.
- `companyId`, actor identity, capabilities, workflow ownership, and stage ownership are never accepted from the request as authority.
- Cross-tenant Job/Workflow/Stage/Activity access returns 404.
- Workflow stage validation requires the stage to belong to the Job workflow and authenticated company.
- Activity queries use `companyId + jobId`.
- Activity actor comes from `req.auth.userId`.
- Job creation and stage transition use one Prisma transaction for state plus Activity.
- Legacy `/api/contents` now uses the mapped Job delegate, requires JOBS capability, and receives tenant context for all operations.
- Legacy Content creation bootstraps the same workflow and records `JOB_CREATED` Activity.
- Migration preserves physical tables, IDs, Client links, versions, Approval foreign keys, and timestamps.
- No Kanban, Files, Approval redesign, Calendar, frontend, or new dependency was introduced.

## Test Evidence

- Job tenant/list/detail/create/update/transition tests.
- Workflow template default and idempotency tests.
- Activity actor and cross-tenant tests.
- Transaction rollback tests for failed Activity creation.
- Migration verification: 8 operational rows, 10 versions, 36 approvals preserved immediately after migration; zero orphan Jobs.

## Out of Scope

- Full Approval tenant/public-token hardening (B9).
- Files/storage (B8).
- Calendar (B10).
- Dashboard tenant aggregates (B11).
- CSRF/rate-limit hardening (B12).
- Frontend/Figma integration.
