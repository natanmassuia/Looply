# Security Audit — Looply B5 Clients — 2026-08-14

## Scope

Reviewed the B5 Client schema, migration, service, routes, capability boundary, Client-related content creation lookup, tests, and existing direct `prisma.client` callers.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 2
- Informational: 3

## Low Findings

| Finding | Location | Decision |
|---|---|---|
| Dashboard client count is still global | `backend/src/services/dashboardService.ts` | Deferred to B11 Dashboard by Template; dashboard is not the B5 Client API and is not claimed tenant-isolated yet. |
| Existing Content read paths are not yet tenant-scoped | `backend/src/services/contentService.ts` | B6 scope. B5 fixes the Client lookup used during content creation so a tenant cannot attach content to another tenant's Client. Full Content/Job isolation remains deferred. |

## Checked and Clean

- Client list, search, status filter, detail, create, update, and delete all receive `companyId` from `req.auth.companyId`.
- Cross-tenant detail/update/delete returns 404 and does not reveal resource existence.
- `companyId` in Client request bodies is ignored; ownership is assigned by the service argument.
- Client `companyId` is immutable through update input.
- Client capability is enforced with `requireCapability(Capability.CLIENTS)`.
- Inactive/unconfigured workspaces are blocked by the existing workspace gate before Client routes.
- Client foreign key uses `ON DELETE RESTRICT`; no silent cascade.
- Global Client name uniqueness was replaced by `(companyId, name)` uniqueness.
- Client document/email fields are not globally unique and are not logged by the new code.
- Client creation from Content now validates `clientId + companyId`; it cannot attach a cross-tenant Client.
- Migration is additive with an explicit slug-based backfill and an abort if any Client remains unmapped.
- No frontend changes, no new secrets, no raw SQL from request input, and no new dependencies.

## Test Evidence

- Fake-DB tenant tests: list/detail/create/update/delete/search/capability behavior.
- Live-DB HTTP tests: Tenant A/B list isolation, cross-tenant 404, body spoof rejection, unauthenticated 401.
- Migration verification: 6 Clients before, 6 after, 0 unmapped, all assigned to the demo Company.

## Out of Scope

- Full Content/Job tenant isolation.
- Dashboard aggregation isolation.
- Frontend/Figma integration.
- CSRF/rate-limit hardening (B12).
