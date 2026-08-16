# Security Audit — Looply Frontend F2A — 2026-08-14

## Scope

Reviewed the normalized API client, error contract, retry policy, session/workspace/capability types and helpers, first-login routing helper, direct-fetch migration in ContentsList, QueryClient defaults, test harness, and the React Router upgrade.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 1
- Informational: 3

## Low Finding

| Finding | Location | Decision |
|---|---|---|
| Dev-tool dependency advisories remain (vite/vitest/esbuild chain) | `frontend/package.json` | Dev-only (test server warnings); no runtime exposure. Major tooling upgrade deferred to a maintenance pass; `npm audit fix --force` deliberately not run. |

## Checked and Clean

- `credentials: "include"` preserved on every request (verified by test).
- No Bearer/JWT/localStorage auth introduced; session remains cookie-based.
- No `companyId` sent as authority; no tenant state in storage.
- Capability helper answers UI visibility only; no frontend capability matrix; backend remains authority (documented rule + tests treat missing workspace as false).
- No automatic 401 redirect inside `apiFetch` — auth boundary decides (F3).
- 4xx (400/401/403/404/409/413/429) never retried; mutations never retried — no replay of approvals/transitions/uploads.
- Non-JSON error bodies are never surfaced (safe generic `Erro <status>` message; verified by test).
- No logging of cookies, Approval tokens or signed URLs in the client.
- `Content-Type: application/json` set only when a body is sent (no content-type sniffing on GETs).
- First-login helper is pure routing logic; no placeholder auth screens; no premature redirects to nonexistent routes.
- ContentsList direct fetches migrated to the shared client — same-origin cookie behavior preserved, now with ApiError handling.
- React Router runtime advisories resolved via compatible v7.18.2 upgrade, proven by typecheck/tests/build; no `--force`.
- `VITE_API_URL` remains the only VITE var (public by nature; no secrets).

## Informational Notes

- `getPostLoginDestination` returns paths for routes that do not exist yet; wiring is F3. Harmless as pure function.
- AbortSignal is supported by the client but existing hooks do not pass it yet (documented; canonical F4+ hooks will).
- Bundle grew ~15KB gzip with RR v7; acceptable, revisit at F10.

## Out of Scope

- Visual foundations (F2B).
- Auth/onboarding screens (F3).
- Domain pages F4–F9.
