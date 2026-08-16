# Security Audit — Looply Frontend F1 — 2026-08-14

## Scope

Read-only review of frontend routes, API client, auth guards, storage assumptions, tenant/company state, capability handling, public Approval token usage, dangerous URLs, and frontend dependencies.

## Findings

| Finding | Severity | Status / Action |
|---|---|---|
| Frontend persists no JWT/access token and uses `credentials: include` cookies | Info | Correct for B2/B12 auth model. |
| Frontend currently expects `Approval.token` in internal content responses | Medium | Contract drift. Backend no longer returns plaintext token; migrate Content/Approval UI in F6/F7. No F1 workaround. |
| Frontend has no must-change-password/onboarding guard | Medium | Backend blocks operations, but UX guard is incomplete. F3 scope. |
| Frontend does not consume `/api/auth/me` workspace capabilities | Low | Capability rendering/route visibility belongs F3/F4+. |
| Frontend dependency audit reports React Router moderate advisories | Medium | No upgrade in F1 because frontend is zero-change and major-compatible fix is unresolved. Review during F2/F10 dependency pass. |

## Checked and Clean

- No storage credentials or VITE secrets found.
- No localStorage/sessionStorage auth token found.
- No `Authorization: Bearer` or JWT authority found.
- API client uses `credentials: "include"`.
- Public Approval token is obtained from URL params only for public API calls.
- No `dangerouslySetInnerHTML` or raw HTML rendering found in the F1 inventory.
- Frontend route guards are UX-only; backend remains authorization authority.

## Out of Scope

- Backend security, already covered by B12.
- Figma frontend redesign.
- Dependency major upgrade.
