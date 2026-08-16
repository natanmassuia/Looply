# F4B — Provisioned First-Access Onboarding

## Status

**F4B IMPLEMENTATION — READY FOR REVIEW**

## Onboarding contract classification

**ONBOARDING_CONTRACT_READY.** The server/persisted domain was already complete before F4B — no new backend tables, migrations, or endpoints were required:

- `GET /api/onboarding/status` → `OnboardingStatus` (`mustChangePassword`, `company{name,timezone,locale,template,onboardedAt}`, `readyToComplete`, `status: PASSWORD_CHANGE_REQUIRED | ONBOARDING_REQUIRED | ACTIVE`) — `backend/src/services/onboardingService.ts`.
- `PATCH /api/onboarding/company` — allowlisted zod contract; rejects after `onboardedAt` is set.
- `POST /api/onboarding/template` — enum-validated; template locked after activation.
- `POST /api/onboarding/complete` — server checks `readyToComplete` (password changed + name + template); idempotent.
- `POST /api/auth/change-password` — `requireAuth`, server-side min length (10–200), sets `mustChangePassword=false`, revokes **all** sessions, issues a fresh cookie.
- Persistence: `User.mustChangePassword`, `Company.onboardedAt`, `Company.workspaceTemplate` — persisted authority, no localStorage anywhere in the flow.
- Provisioning (pre-existing, no HTTP endpoint): `provisionWorkspace()` creates User (temp password, `mustChangePassword=true`) + Company (UNCONFIGURED) + OWNER membership.

**One small additive backend change (F4B):** the login response now includes `workspace` (`resolveWorkspaceContext`), same shape as `/api/auth/me`. Without it, `getPostLoginDestination()` — already shipped and tested in F3 — could never route an ACTIVE user correctly (the login response was typed as `SessionInfo` but lied about `workspace`).

## Implementation

### Routing authority — one canonical guard

`frontend/src/features/Onboarding.tsx` exports `AccessGate`, used once in `App.tsx` around every authenticated route:

- `mustChangePassword` → `/change-password` (from any route; stays put on it — no loop)
- workspace `UNCONFIGURED` → `/onboarding` (no bypass by typing an app URL; stays put on it)
- ACTIVE → the app; `/onboarding` and `/change-password` bounce to `/dashboard` (no zombie screens)

State transitions are mutually exclusive → no redirect loops (covered by tests). `ProtectedRoute` (session) remains untouched from F4A; `ThemeProvider` wraps both gates so onboarding renders with workspace appearance (AURA/LIGHT default). Public routes (`/login`, `/approve/:token`) stay outside. Backend enforcement is independent and stricter (`requireWorkspaceActive` middleware on every domain route) — the frontend gate is UX, the server remains the authority.

### First-access flow (3 screens, all outside the app shell)

1. **`/change-password`** — full-page form (Login visual language): nova senha + confirmação, `autoComplete="new-password"`, client mirrors the server minimum (10), mismatch checked locally, `role="alert"` errors, disabled while pending, neutral network-error message. On success the hook invalidates `["me"]` → gate routes on.
2. **`/onboarding` step 1** — "Sobre o workspace": nome + fuso + idioma, prefilled from `GET /api/onboarding/status` (derived state, no effects), `PATCH /api/onboarding/company`.
3. **`/onboarding` step 2** — "Modelo de trabalho": three template cards (pt-BR), prefilled if already chosen; "Concluir" → `POST /template` + `POST /complete` → invalidate `["me"]` → gate sees ACTIVE → `/dashboard`. "Voltar" returns to step 1.

`Login.tsx` now routes to `getPostLoginDestination(loginResult)` instead of hardcoded `/dashboard` — the exact first gate is chosen at login time; any drift is still corrected by `AccessGate` after the full page load.

### Files

| File | Change |
|---|---|
| `backend/src/services/authService.ts` | login returns `workspace` (resolveWorkspaceContext); company columns in the membership include |
| `backend/src/routes/auth.ts` | login response gains `workspace` |
| `frontend/src/features/Onboarding.tsx` | **new** — `AccessGate`, `ChangePassword`, `Onboarding` (2 steps) |
| `frontend/src/lib/api.ts` | hooks: `useOnboardingStatus`, `useChangePassword`, `useUpdateOnboardingCompany`, `useSelectTemplate`, `useCompleteOnboarding` (the two terminal mutations invalidate `["me"]`) |
| `frontend/src/lib/types.ts` | `OnboardingStatus` / `OnboardingCompany` mirror |
| `frontend/src/App.tsx` | `/change-password` + `/onboarding` routes under `ProtectedRoute → ThemeProvider → AccessGate`; app shell nested inside |
| `frontend/src/features/Login.tsx` | routes via `getPostLoginDestination(session)` |

No new dependencies. No schema changes. No migration. No roles/ACL changes. UI copy in pt-BR.

## Tests

- **New** `frontend/src/tests/onboarding.test.tsx` — 17 tests: AccessGate routing (temp-password → senha, un-onboarded → onboarding, no loops, no bypass from `/contents`, ACTIVE never sees gates again), ChangePassword (a11y labels/autocomplete, local min-length + mismatch rejection without API call, exact `newPassword` contract, neutral network error, server message), Onboarding (prefill from server status, company PATCH contract, required name, required template, template+complete sequence, neutral error).
- **Updated** `frontend/src/tests/login.test.tsx` — post-login destination is now the real contract (`/onboarding` for an incomplete session).
- **Updated** `backend/tests/auth.test.ts` — login returns the workspace context (`id/name/template/status`); seed row gains `workspaceTemplate: null`.

## Security review (OWASP checklist over the F4B diff)

| Severity | Finding |
|---|---|
| Critical / High | none |
| Medium (pre-existing, **not in F4B diff**) | `POST /api/auth/change-password` does not require the current password. Acceptable for the forced temp-password flow; for a voluntary change a hijacked session could persist access by rotating the password. Recommend: require `currentPassword` when `mustChangePassword=false`. |
| Low (pre-existing) | Onboarding endpoints have no rate limit (authenticated, low risk; login limiter exists). |
| Info | Login response now includes `workspace` — non-sensitive (same fields as `/api/auth/me`). |

Verified in the diff: tenant always from `req.auth` (never client-supplied IDs → no IDOR); zod allowlist on `PATCH /company` (no mass assignment); template enum + activation governance server-side; `complete` gated on server-side `readyToComplete`; React escapes all rendered input (no XSS); no secrets logged; Prisma parameterized (no injection); session rotation on password change; frontend guard is UX-only with independent backend enforcement (`requireWorkspaceActive`).

## Validation

| Check | Result |
|---|---|
| `npm --prefix backend run typecheck` | ✅ |
| `npm --prefix backend run test` | ✅ 379 passed (32 files) — +1 new |
| `npm --prefix frontend run typecheck` | ✅ |
| `npm --prefix frontend run test` | ✅ 129 passed (8 files) — +17 net |
| `npm --prefix frontend run build` | ✅ 117 modules, 41.52 kB CSS / 363.84 kB JS |

## Deviations & simplifications (ponytail/caveman)

- **Appearance step skipped deliberately**: `readyToComplete` does not include appearance, and `/api/settings/appearance` requires an ACTIVE workspace (no pre-activation onboarding endpoint exists). AURA/LIGHT default applies; appearance remains editable in Settings after activation. Add a step only if the product wants it pre-activation (would need an onboarding-scoped appearance endpoint).
- **2 wizard steps, local `useState`** — no wizard framework, no engine, no persistence of step state (a reload returns to the correct step via server prefill: name/template survive, user just redoes the current screen).
- **Caveman check**: `AccessGate` is three sequential ifs over mutually exclusive states — no state machine, no strategy objects. Prefill is derived state (`value ?? serverValue`), not effects.
- Timezone list is 4 common zones (schema default `America/Sao_Paulo`); grow it when a real customer needs more.
