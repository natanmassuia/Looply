# Security Audit — Looply B3 (Workspace Templates + Capabilities) — 2026-08-14

Scope: `backend/src/domain/capabilities.ts`, `backend/src/middleware/requireCapability.ts`, `/api/auth/me` workspace block, migration `20260814100000_workspace_templates`.

## Executive summary
- Critical: 0 · High: 0 · Medium: 0 · Low: 1 · Info: 2

## Low
| Finding | Location | Detail |
|---|---|---|
| Capability guard does a DB read per request (company lookup) | backend/src/middleware/requireCapability.ts | No caching by design (no Redis; per-request freshness). Acceptable at V1 traffic; can memoize per-request later. |

## Info
- Tenant safety: guard reads ONLY `req.auth.companyId` (established by session+membership); body/query `companyId`/`capabilities`/`templateCapabilities` fields never read (tested with spoof probe).
- Null template → zero capabilities → 403 on capability-guarded routes even for OWNER (no permissive fallback; tested).
- Role/capability separation verified: MEMBER/ADMIN/OWNER get identical capability answers (tested).
- `resolveWorkspaceContext` returns a defensive copy; registry arrays cannot be mutated through the API layer (tested).
- Existing domain routes (clients/contents/team/publications) are NOT yet capability-guarded — documented known gap (domain batteries B4/B5+), not a regression: they were equally open before B3 behind requireAuth.
- Migration is additive (enum type + nullable column); no destructive SQL.

## Checked and clean
- No frontend authority path exists (frontend untouched in B3).
- No template mutation endpoint exposed; template change is a future governed operation (B4+).
- /api/auth/me returns only the authenticated tenant's workspace; memberships limited to own.
- No secrets/PII in capability payloads.
