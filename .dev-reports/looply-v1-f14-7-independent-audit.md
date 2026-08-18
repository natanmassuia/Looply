# Looply — V1-F14.7 Independent Audit

Date: 2026-08-18 · Branch: `main` · Audit-only (no source modified, no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          582c65ab8b726f5f348a87d3cc978739cf36bd78
ORIGIN_MAIN:         582c65ab8b726f5f348a87d3cc978739cf36bd78 (match)
WORKTREE:            7 modified + 1 untracked report (all F14.7-scoped)
STAGED:              none
RAM:                 ~1.7 Gi available
git diff --check:    PASS
KORE_TOUCHED:        NO
```

## Files audited

```
frontend/src/features/Dashboard.tsx       responsive meta row; attention/KPI ?focus links
frontend/src/features/Onboarding.tsx      AccessGate voluntary /change-password; ChangePassword voluntary flow
frontend/src/features/ContentsList.tsx    ?focus consumption + highlight; canonical clear filter; data-job-id
frontend/src/features/Team.tsx            IconX on "Limpar filtros"
frontend/src/tests/dashboard.test.tsx, onboarding.test.tsx, workflowKanban.test.tsx
backend/src/services/memberService.ts      (read-only) confirms admin password reset sets mustChangePassword
```

## Dashboard responsive review

- Clock + "Ver demandas" share one meta row (`w-full flex-wrap justify-between`, `sm:w-auto sm:justify-end sm:shrink-0`); clock is `text-left sm:text-right`. Normal flex/grid, no absolute/fixed positioning introduced. Mobile layout is coherent; desktop variants preserve the prior right-aligned behavior. **PASS / no desktop regression.**

## Contextual navigation review

- Attention "Ver todas as demandas" → `/contents?focus=<first pending id>` (falls back to `/contents`); "Em aprovação" KPI → `/contents?focus=<first AWAITING_CLIENT id>` (fallback `/contents`). Other links unchanged. Fallbacks correct; not every KPI invents a target. **PASS.**

## Focus/highlight lifecycle

- `?focus` is a presentation hint only, consumed client-side over the already tenant-scoped `useContents` dataset (`document.querySelector('[data-job-id=…]')`); never fetches by id; a stale/foreign id simply finds nothing and the page is unaffected. **Tenant-safe.**
- Single `requestAnimationFrame` (no loop), waits for data, uses `scrollIntoView(block/inline: nearest)`; changing the focus param clears the prior highlight via effect cleanup; the 2500 ms timer and the rAF are cancelled on cleanup/unmount. **Safe.**
- LOW-1: the effect depends on `data`, so any contents refetch while `?focus` is present re-scrolls/re-highlights the target (bounded — stops once refetching stops). Minor if the user scrolled away.
- LOW-2: `behavior: "smooth"` is not gated on `prefers-reduced-motion`; the highlight itself is static, only the scroll animates.
- `?focus` persisting in the URL is intentional (refresh keeps intent) and safe — **acceptable.**

## Voluntary password flow

- MyAccountModal → `/change-password` (auth-gated by `ProtectedRoute`); AccessGate now lets active-workspace users render the canonical screen. Mobile and desktop share the screen/endpoint; "Voltar" (`navigate(-1)`) returns to the previous authenticated page; success navigates to the app home. Forced vs voluntary is distinguished by server state (`mustChangePassword`), not URL text. **PASS.**

## Forced first-access flow (critical regression check)

- **Enforcement intact**: `AccessGate` still redirects every route to `/change-password` when `mustChangePassword` is true; no bypass exists (verified in source). Forced+UNCONFIGURED users still land on onboarding after the change (the `!isWorkspaceActive` branch fires before the URL checks). 
- **MEDIUM — M1 (regression)**: for a user who MUST change a temporary password in an **ACTIVE** workspace (real path: admin `POST /api/members/:id/reset-password`, `memberService.ts:236` sets `mustChangePassword: true`), the F14.7 change leaves them **on `/change-password` after a successful change** instead of landing in the app. Before F14.7 the AccessGate line-49 redirect sent them to the dashboard. Now `ChangePassword` only navigates when `!forced`, and AccessGate no longer redirects `/change-password` for active workspaces — so the (now voluntary) form re-renders. Recoverable (the now-visible "Voltar" returns to the previous page, typically re-login), but a genuine post-change landing regression in the exact flow this battery touched. Proven with a focused throwaway AccessGate simulation (forced+ACTIVE post-change stays on the password screen).
- Smallest remediation: on success, `navigate(DEFAULT_HOME_PATH)` when `isWorkspaceActive(session)` (existing `lib/workspace` helper), leaving only forced+UNCONFIGURED users to AccessGate's onboarding redirect.

## Filter consistency review

- Clients remains the reference. Demandas "Limpar filtros" clears only `clientId` (does not touch workflow state, search, or `?focus`); the R1.3 WorkflowStage board is untouched. Team "Limpar filtros" gained the `IconX` consistency (role/search domain unchanged). Calendar has no user-facing filter surface (its selects are appointment-editor controls); Approvals has no list/filter screen — both legitimately N/A. **PASS / no domain regression.**

## Accessibility

- New controls are real buttons/links with labels and `focus-visible` rings; the highlight is not the only indicator (scroll + URL carry context); no nested interactive controls added. ModalOrSheet gained no new usages in F14.7 (the Demandas picker sheet predates it), so the absent focus trap is a **pre-existing acceptable deferred limitation**, not a new regression. Minor reduced-motion note (LOW-2).

## Reported limitation assessment

| Reported | Verdict |
|---|---|
| `?focus` persists in URL | acceptable — intentional, tenant-safe, refresh-stable |
| "Em aprovação" falls back to `/contents` when no AWAITING_CLIENT target | acceptable — correct fallback |
| ModalOrSheet has no focus trap | pre-existing acceptable deferred limitation |
| filter standardization interaction-level | acceptable — domain semantics preserved |

## Findings by severity

**CRITICAL** — none.

**HIGH** — none (no bypass of mandatory password enforcement).

**MEDIUM**
- M1: forced password change in an ACTIVE workspace stays on `/change-password` after success (post-change landing regression vs pre-F14.7). One-line remediation.

**LOW**
- L1: `?focus` re-focuses on any contents refetch while the param is present.
- L2: smooth scroll not gated on `prefers-reduced-motion`.
- L3/L4: reported fallback + URL-persistence limitations (acceptable).

## Validation actually executed

- `git status/stat/name-status/diff --check`; full F14.7 diff + callers inspected.
- Focused F14.7 tests (dashboard + onboarding + workflowKanban) → **51 passed** (full suite 298 + typecheck + build already substantiated on the identical diff).
- Throwaway AccessGate simulation proved M1 (forced+ACTIVE post-change stays on the password screen) — temp file removed.

## Consolidation decision

**REMEDIATION_REQUIRED.** Everything else verifies clean, but M1 is a real functional regression in the password flow — the exact surface this battery fixes — where pre-F14.7 behavior worked. The change is not fully coherent until the post-change landing is restored for forced users in active workspaces. The fix is one line (`isWorkspaceActive(session)` gate in `ChangePassword` success).

## Remediation evidence (post-audit, 2026-08-18)

M1 was remediated in `frontend/src/features/Onboarding.tsx` (`ChangePassword` success handler): the handler now navigates to `DEFAULT_HOME_PATH` when `isWorkspaceActive(session)` — regardless of whether the change was forced or voluntary — while non-active workspaces keep the existing onboarding contract (no navigation; AccessGate routes them to `/onboarding` on the `["me"]` invalidation). No AccessGate architecture change; the existing `isWorkspaceActive` helper is reused.

Regression tests added in `frontend/src/tests/onboarding.test.tsx`:
- forced + ACTIVE workspace → successful change lands on the app home;
- forced + UNCONFIGURED workspace → successful change does NOT navigate away (onboarding remains);
- voluntary + ACTIVE → unchanged (lands on the app home).

Validation: focused onboarding suite **28 passed**; wider F14.7 set **91 passed**; full frontend suite **300 passed** (20 files, +2 regression tests); typecheck PASS; build PASS; `git diff --check` PASS. Mandatory password enforcement unchanged (AccessGate still forces `/change-password`).

M1 is now **CLOSED**. Remaining findings are LOW/deferred only: L1 `?focus` re-focus on refetch, L2 reduced-motion smooth scroll, L3 focus URL persistence / "Em aprovação" fallback, plus the pre-existing ModalOrSheet focus-trap limitation.

## Git state

```
HEAD:               582c65ab8b726f5f348a87d3cc978739cf36bd78 (unchanged)
Dirty files:        7 modified + 2 untracked reports
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate` (tiered validation; focused suites only).
- No external MCP required; source/tests inspected via Read/Grep + a throwaway test simulation.
