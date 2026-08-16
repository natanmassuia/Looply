# Security Audit — Looply B12 Hardening — 2026-08-14

## Scope

Repository-wide review of CSRF/CORS, sessions/cookies, public routes/tokens, rate limiting, proxy trust, tenant/capability boundaries, storage policy, legacy bridges, environment/config, logs, migrations, dependency audit, and operational scripts.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 2
- Informational: 5

## Low Findings

| Finding | Location | Decision |
|---|---|---|
| In-memory rate limits reset on process restart and are not shared across replicas | `backend/src/lib/rateLimit.ts` | Acceptable for single-node V1; distributed limiter deferred until infrastructure requires it. |
| Frontend runtime dependency audit reports moderate React Router advisories; backend runtime audit is clean | `frontend/package.json` | Frontend is Figma scope and B12 has zero frontend changes. Upgrade requires a separate compatibility decision. |

## Fixed / Verified

- Unsafe cookie mutations validate Origin/Referer against configured CORS origin.
- Same-origin mutations proceed; requests without Origin/Referer remain compatible with curl/CLI.
- Public Approval token endpoints bypass cookie CSRF guard because the token is their credential.
- CORS is exact-origin with credentials; wildcard is rejected by env validation.
- Login, invitation accept, public Approval writes and public Approval reads have rate limits.
- Login/rate-limit responses use 429 with Retry-After.
- Express trust proxy is explicit and defaults false; production must opt in for one trusted proxy.
- Public Approval tokens are redacted from application request logs.
- Approval plaintext tokens are absent from DB; tokenHash is unique.
- Storage bucket remains private; storageKey and signed URLs are not logged/returned unnecessarily.
- Job/Client/Workflow/Stage/Activity/Attachment/Approval/Dashboard queries were reviewed for tenant scope.
- Dashboard no longer contains global client/job/user aggregates.
- Board, Calendar, Approval/Attachment lists and Activity lists have bounded behavior.
- Pending attachment cleanup and available-object reconciliation CLI exists.
- Health remains process liveness; readiness remains DB readiness; storage is separate feature readiness.
- Migration status/schema diff are clean.

## Informational Notes

- Public token values in URLs may still exist in browser/upstream infrastructure logs; deployment contract requires redaction/no plaintext access logging.
- Runtime backend dependency audit is clean with `npm audit --omit=dev`.
- Full backend audit reports a critical Vitest dev-tool advisory and transitive Vite/esbuild advisories; Vitest UI is not used in production. No forced major upgrade was applied.
- Full frontend audit reports runtime React Router moderate advisories and dev-tool advisories; frontend remains outside B12 by explicit scope.
- No production credentials, Nginx changes, or deploy were performed.

## Out of Scope

- Frontend/Figma.
- Nginx modification/deployment.
- Redis/distributed rate limiting.
- Production storage smoke without configured provider.
