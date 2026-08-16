# Security Audit — Looply B7 Operational Views — 2026-08-14

## Scope

Reviewed the Job list, board, summary projections, query parameters, capability chain, Workflow/Stage lookups, legacy bridge behavior, and cross-tenant tests.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 1
- Informational: 3

## Low Finding

| Finding | Location | Decision |
|---|---|---|
| Board returns the complete tenant workflow projection without pagination | `backend/src/services/jobService.ts:getJobBoard` | Appropriate for the current read projection and bounded workflow view; monitor volume and add board pagination/windowing in B7 hardening if operational volume grows. List view is bounded to 100 rows. |

## Checked and Clean

- List, board and summary all receive `companyId` from `req.auth.companyId`.
- Board requires JOBS + WORKFLOW + KANBAN.
- Summary requires JOBS + WORKFLOW.
- Local/High Ticket workspaces without KANBAN receive 403 for board while list remains available.
- Workflow ID is tenant-scoped; foreign workflow returns 404.
- Stage/job grouping uses one workflow query plus one job query; no query per stage or per job.
- Search uses a Prisma allowlisted `contains` filter on Job title and Client name.
- Sort accepts only `updatedAt`, `createdAt`, or `title`; direction is only asc/desc.
- Page/limit are numeric and limit is capped at 100.
- Query parameters cannot change tenant or capabilities.
- GET projections do not create Activity.
- Board is read-only; Stage writes continue through `/api/jobs/:id/transition`.
- No Kanban tables, board state, card position, raw SQL, or frontend changes were introduced.

## Informational Notes

- Existing Dashboard aggregates remain global and are deferred to B11.
- Approval public-token behavior remains deferred to B9.
- Client/Job/Activity relations in projections are selected minimally; full histories are not loaded into board cards.

## Out of Scope

- Frontend/Figma views.
- Drag-and-drop.
- Files, Approval redesign, Calendar, Dashboard, CSRF/rate-limit hardening.
