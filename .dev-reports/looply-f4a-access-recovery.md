# F4A — Access + Recovery

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **Baseline HEAD:** `4e6c232` (`feat(v1): migrate app shell and navigation`)
- **F1:** semantic theme runtime + contract committed.
- **F2:** shared component foundation committed.
- **F3:** app shell + navigation committed.
- **Worktree:** intentionally dirty (pre-existing demo-v1-polish redesign of `Icons.tsx`, `StatusPill.tsx`, all `features/*.tsx` except `Login.tsx`, `.dev-reports/looply-contents-card-grouping.md`; untracked `.dev-reports/demo-v1-*.md`, `.env.backup.*`, `ecosystem.config.cjs`, `package-lock.json`).
- **`Login.tsx` was CLEAN at HEAD** (not in the pre-existing dirty set) → `F4A_CHANGED`.
- **No public signup / registration exists anywhere** — access is provisioned via seeded/invited users (`backend/src/seed.ts`, invitations service). F4A adds nothing contrary to this.

## Tooling Evidence

- **AI Memory MCP:** queried at start for auth / recovery / F4A-F4B decisions. No durable auth-page memory existed; the migration roadmap (F4A = Access & Recovery, F4B = Onboarding) and the no-signup constraint were recovered from prior session observations. Repository evidence authoritative.
- **Serena MCP:** inspected `Login.tsx` (Login + ProtectedRoute), `lib/api.ts` (useLogin/useMe/ApiError/apiFetch/SessionInfo), `lib/workspace.ts` (getPostLoginDestination), `lib/types.ts`, `backend/src/routes/auth.ts` (login/logout/change-password/me/switch-company), `backend/src/services/authService.ts` (login/resolveAuth/logout), `backend/src/lib/loginLimiter.ts` (rate limiting), `backend/src/lib/env.ts` (no email vars), `backend/src/lib/password.ts`, `backend/prisma/schema.prisma` (User model), `frontend/src/App.tsx` (routes), `frontend/src/tests/*` (test conventions), `frontend/src/test/setup.ts`, `frontend/src/components/Icons.tsx` (IconEye).
- **Context7 MCP:** not needed — React Router `useLocation`/`Navigate`, TanStack Query `useMutation`, and `@testing-library/react` behaviors verified against committed code/tests.
- **RTK:** all Git/shell commands routed through `rtk`.
- **Skills:** caveman (loaded — minimal token + a11y migration, no new abstractions); **security-audit** (loaded — see Security Review). Kore-specific skills not used. Ponytail **lite** active.

## Existing Authentication Architecture

- **Frontend:** `Login.tsx` — public `/login` route; email+password form; `useLogin()` mutation → `window.location.assign("/dashboard")`; `ProtectedRoute` (guard around the whole internal shell) waits on `useMe()` and redirects to `/login` on 401. Post-login routing decision lives in `lib/workspace.ts` (`getPostLoginDestination`: mustChangePassword → `/change-password`, workspace unconfigured → `/onboarding`, else `/dashboard`); App.tsx currently only defines `/dashboard` + the `*`→`/dashboard` catch-all, so today the effective destination is always `/dashboard`.
- **Backend:** `POST /api/auth/login` (zod email+password, per-IP+email rate limit 10/15min via `loginLimiter.ts`, returns generic `Credenciais inválidas` on any failure — DUMMY_HASH scrypt compare prevents timing/enumeration), `POST /api/auth/logout`, `POST /api/auth/change-password` (requireAuth, `assertNewPasswordOk`, revokes sessions, reissues session), `GET /api/auth/me`, `POST /api/auth/switch-company`. Session = hashed random token in an HttpOnly cookie (`setSessionCookie`).
- **Recovery:** **none exists.** No forgot-password endpoint, no reset-token generation/persistence/expiry, no reset-password endpoint, no email delivery provider/config, no frontend reset route.

## Recovery Capability Gate

| Requirement | Evidence | Status |
|---|---|---|
| 1. Recovery request endpoint | `grep forgot/reset/recovery` → none in `backend/src` | ✗ |
| 2. Reset token generation | none | ✗ |
| 3. Reset token persistence/expiry | `schema.prisma` User has only `mustChangePassword`; no resetToken column | ✗ |
| 4. Reset-password endpoint | none | ✗ |
| 5. Email delivery provider/config | `env.ts` has no EMAIL/SMTP/MAIL vars; no mailer service | ✗ |
| 6. Frontend reset route | none in `App.tsx` | ✗ |
| 7. Rate limiting / abuse protection | only login limiter exists | ✗ (login only) |

**Classification: RECOVERY_BLOCKED.**

Per task rules: do NOT invent backend infrastructure (no reset tokens, no email provider, no new endpoints). Implement only the access/login improvements that are supported by existing contracts. The blocker is documented below.

## Access Flow

Migrated `Login.tsx` (clean file) onto the F1/F2 foundation — presentation + a11y only; **zero backend/contract changes**:

- **Semantic tokens:** canvas/surface backgrounds, `--looply-color-border-default` card border, `--looply-color-text-primary`/`-muted` headings/labels, `--looply-color-status-danger` error text — replaces raw `neutral-*`, `bg-white`, `bg-neutral-900`, legacy `--looply-background`/`--looply-border`/`--looply-foreground`.
- **F2 primitives:** `.label` (form labels), `.input` (email/password), `.btn-primary` (submit) — replaces bespoke neutral classes and raw button styling.
- **Form hierarchy:** heading + subtitle + labeled fields + submit.
- **Accessible labels:** `<label htmlFor>` wired to `id` on each input.
- **Password-manager compatible:** `autocomplete="email"` / `autocomplete="current-password"`, `type="password"`.
- **Loading state:** submit shows "Entrando..." and is `disabled` while `login.isPending`.
- **Server-auth error:** backend generic message surfaced via `role="alert"`.
- **Network error:** neutral "Não foi possível conectar. Tente novamente." (never the raw browser `Failed to fetch`).
- **Keyboard submission:** native `<form onSubmit>` + `<button type="submit">`.
- **No signup / no onboarding leakage:** none added.
- **Recovery link:** intentionally omitted (RECOVERY_BLOCKED — no backend contract to call).

## Recovery Flow

**Not implemented — RECOVERY_BLOCKED.** There is no recovery request endpoint, no reset token lifecycle, no reset-password endpoint, and no email delivery capability. Adding a UI without a backend contract would be dead code and an account-enumeration risk. Documented as the blocker.

## Security Review

(Scope: F4A frontend diff — `Login.tsx` + new `login.test.tsx`; backend untouched. Full checklist applied; no findings introduced.)

- **Account enumeration:** backend `authService.login` returns the single generic `Credenciais inválidas` for unknown email / wrong password / inactive user, with a constant DUMMY_HASH scrypt compare. `Login.tsx` surfaces only `ApiError.message` — no "email not found" path, no timing signal. ✔
- **Credential logging:** credentials live only in transient React state; never logged, never persisted. ✔
- **Token leakage:** no reset tokens (blocked); session cookie is HttpOnly (backend) and not readable by JS. Login does not touch tokens client-side. ✔
- **Auth errors expose internals?** Backend `ApiError` carries only the safe message; non-JSON bodies fall back to generic `Erro <status>`; network failure → neutral message. No stack, no raw body, no header dump. ✔
- **Password fields:** `type="password"`, correct `autocomplete`, no `autoComplete="off"` interference with password managers. ✔
- **Rate limiting:** backend login limiter (10/15min per IP+email) untouched and still enforced. ✔
- **XSS:** error state rendered via `{error}` (React-escaped); no `dangerouslySetInnerHTML`. ✔
- **Mass assignment / authorization:** no changes; login only accepts `{email, password}`. ✔
- **Findings:** **0** (no Critical/High/Medium/Low/Info introduced by this diff). Pre-existing items out of scope: no CSP/HSTS headers are F4A's concern; password policy lives in `onboardingService.assertNewPasswordOk` (backend, untouched).

## Files Modified

- `frontend/src/features/Login.tsx` — access-flow migration to F1/F2 semantic foundation (presentation + a11y only; contract unchanged).
- `frontend/src/tests/login.test.tsx` — new focused login + ProtectedRoute tests.

## Pre-existing Dirty Preservation

Verified identical pre/post for all untouched dirty files (`Icons.tsx`, `StatusPill.tsx`, all 6 other `features/*.tsx`, `.dev-reports/looply-contents-card-grouping.md`, untracked files). `Login.tsx` was clean at HEAD, so no pre-existing hunks were at risk. F1/F2/F3 files (`index.css`, `common.tsx`, `Breadcrumb.tsx`, `Sidebar.tsx`, `AppLayout.tsx`, `App.tsx`, `lib/api.ts`, `tailwind.config.js`, `theme/*`) show **zero diff** — all intact and committed. Backend `git diff` empty.

## Tests

`npm --prefix frontend run test` → **112 passing** (7 files; baseline 104 + 8 new).

New `login.test.tsx` (mocked `useLogin`/`useMe` via `vi.mock`):
- Accessible labeled fields with `type`/`autocomplete` for email + password.
- Valid submission posts `{email, password}` and redirects to the post-login destination.
- Invalid credentials → backend generic message shown (`role="alert"`), no redirect.
- Network failure → neutral message, never the raw error.
- Submit button disabled while pending.
- ProtectedRoute: loading state, redirect to `/login` on 401, renders children when valid.

## Typecheck

`npm --prefix frontend run typecheck` → **PASS** (`tsc --noEmit`).

## Build

`npm --prefix frontend run build` (`tsc --noEmit && vite build`) → **PASS** (115 modules, dist emitted).

## Ponytail Lite Review

- **Speculative auth abstractions:** none — no new form-<abbr>lib</abbr>, no shared AuthForm wrapper, no auth state store (reuses existing `useLogin`/`useMe`).
- **Duplicate auth state:** none — single TanStack Query source; no second state mechanism added.
- **Overengineered form:** no — native `<form>` + controlled state, no validation library (backend zod already validates).
- **Account enumeration:** not introduced (blocked recovery = no enumeration-prone "email sent" fork; generic login errors preserved).
- **Token leakage:** n/a (no tokens).
- **Speculative backend work:** none — RECOVERY_BLOCKED honored; no fake reset endpoints.
- **F4B leakage:** none — no onboarding/signup/workspace-creation added.
- **Unused removal kept:** Login's bespoke neutral styling collapsed into existing `.input`/`.label`/`.btn-primary` (less CSS, less code). No `show/hide password` toggle added (no `IconEye` requirement; backend password manager handles it — YAGNI).

## Blockers

- **RECOVERY_BLOCKED.** Recovery (forgot-password request + reset) cannot be implemented without backend infrastructure that does not exist: (1) a recovery-request endpoint, (2) reset-token generation + persistence with expiry (no schema column), (3) a reset-password endpoint, (4) an email delivery provider/config (none in `env.ts`, no mailer service). Per F4A scope rules, no backend infrastructure was invented; only the supported access-flow improvements were implemented.
- **Change-password / onboarding gates** (`getPostLoginDestination` → `/change-password`, `/onboarding`) are wired in `lib/workspace.ts` but App.tsx defines no such routes (falls through to `/dashboard`). This is pre-existing and belongs to F4B / password-gate work, not F4A.

## Git Status

```
 M .dev-reports/looply-contents-card-grouping.md            PRE_EXISTING_DIRTY
 M frontend/src/components/Icons.tsx                        UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/components/StatusPill.tsx                   UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/Calendar.tsx                       UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/Clients.tsx                        UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/ContentDetail.tsx                  UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/Dashboard.tsx                      UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/Login.tsx                          F4A_CHANGED
 M frontend/src/features/NewContent.tsx                     UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/PublicApproval.tsx                 UNTOUCHED_PRE_EXISTING_DIRTY
 M frontend/src/features/Team.tsx                           UNTOUCHED_PRE_EXISTING_DIRTY
?? frontend/src/tests/login.test.tsx                        F4A_ADDED (new test file)
?? .dev-reports/demo-v1-*.md, .env.backup.*, ecosystem.config.cjs, package-lock.json   PRE_EXISTING_UNTRACKED
```

Nothing staged. Nothing committed. Backend clean. No public signup. No F4B leakage.

## Final Status

F4A ACCESS DONE — RECOVERY BLOCKED