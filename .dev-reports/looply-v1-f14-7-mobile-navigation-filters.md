# Looply — V1-F14.7 Mobile Navigation, Dashboard Interaction & Filter Consistency

Date: 2026-08-18 · Branch: `main` · Worktree left dirty (no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          582c65ab8b726f5f348a87d3cc978739cf36bd78 (matches expected base)
RAM:                 ~1.7 Gi available (no RESOURCE_PRESSURE)
WORKTREE:            clean at start
KORE_TOUCHED:        NO
```

## Root causes

1. **Password change mobile bug**: `Minha Conta → Alterar minha senha` links to `/change-password`, but `AccessGate` redirected every non-forced, workspace-active user away from `/change-password` to the dashboard — so the canonical password screen never rendered and the click "returned to Dashboard".
2. **Dashboard clock/Ver demandas**: the header meta row used `shrink-0` with a right-aligned clock, which floated awkwardly in the stacked mobile header.
3. **No contextual navigation**: all demand-related dashboard links went to a bare `/contents` with no focus/intent.
4. **Filter inconsistency**: Demandas' client filter had no clear/reset action; Team's "Limpar filtros" lacked the icon Clients has.

## Files changed

```
frontend/src/features/Dashboard.tsx       mobile meta row + contextual ?focus links (attention + Em aprovação)
frontend/src/features/Onboarding.tsx      AccessGate voluntary /change-password + ChangePassword voluntary flow
frontend/src/features/ContentsList.tsx    ?focus consumption, target highlight, canonical clear filter
frontend/src/features/Team.tsx            "Limpar filtros" icon consistency (IconX)
frontend/src/tests/dashboard.test.tsx     +4 contextual/mobile tests
frontend/src/tests/onboarding.test.tsx    +4 password-flow tests + voluntary AccessGate test; router-wrapped renders
frontend/src/tests/workflowKanban.test.tsx +3 focus/filter tests
```

## Dashboard mobile fix

- `UpcomingClock` now aligns `text-left sm:text-right`; the clock + "Ver demandas" share one meta row that is `w-full flex-wrap justify-between` on mobile and `sm:w-auto sm:justify-end` on desktop. No arbitrary offsets; plain responsive flex.

## Contextual navigation behavior

- Attention "Ver todas as demandas" → `/contents?focus=<first pending demand id>` when a target is known (else bare `/contents`).
- "Em aprovação" KPI → `/contents?focus=<first AWAITING_CLIENT demand id>` from `needingAttention` when available (else bare `/contents`).
- Other KPI/links keep their existing destinations (no uniform behavior forced).

## Target focus/highlight

- ContentsList reads `?focus=<id>` via `useSearchParams`. Once data is available, a rAF scrolls the `[data-job-id]` card into view (`scrollIntoView`, `block/inline: nearest`) and applies a temporary non-animated ring highlight that clears after 2500 ms and on unmount/param change.
- The highlight is not the only context (the card is scrolled into view; the URL intentionally carries the focus).
- The focus param persists in the URL by design (refresh keeps intent).

## Password change fix

- `AccessGate`: `/change-password` is now reachable voluntarily for active workspaces (only `/onboarding` stays first-access-only).
- `ChangePassword`: adaptive copy (forced = "Primeiro acesso", voluntary = "Alterar minha senha"), a "Voltar" control for voluntary users (`navigate(-1)`), and on success voluntary users navigate to the app home (forced users are re-routed by AccessGate via the existing `["me"]` invalidation + session rotation). Same screen, same `POST /api/auth/change-password` contract; no second implementation.

## Filter canonicalization

- Clients remains the UX reference (search + pills + "Mais filtros" sheet + clear/reset).
- Team already matched the canonical pattern; added the missing `IconX` on "Limpar filtros".
- Demandas client filter: kept its entity-picker domain and sheet; added the canonical clear/reset action ("Limpar filtros" with `IconX`) shown while a client filter is active.
- Calendar and Approvals have no filter surface (Calendar's selects are editor controls; there is no Approvals list screen) — N/A.
- No shared filter primitive extracted (Team already matched; Demandas is a different domain — extraction would not reduce duplication).

## Mobile / desktop behavior

- Sheets (`ModalOrSheet`) remain bottom-sheet on mobile / centered modal on desktop; closing never resets selections; selected states stay clear; existing touch targets preserved.
- Desktop keeps compact pill/select controls (no new large dialogs).

## Accessibility notes

- All new controls are real buttons/links with semantic labels; focus-visible rings on interactive elements; the highlight is static (reduced-motion safe); `role="dialog"`/Escape/backdrop for sheets come from the existing `ModalOrSheet` primitive.

## Tests

- Focused: dashboard (contextual + mobile row), onboarding (password voluntary/forced/back/success + AccessGate voluntary), workflowKanban (focus highlight + clear + filter reset) → **51 passed**.
- Wider affected set (jobs, settings, components, shell, team, calendar) → **95 passed**.
- Full frontend suite → **298 passed** (20 files; +12 new F14.7 tests).

## Typecheck / build / backend

- Frontend `tsc --noEmit`: PASS · build: PASS (pre-existing chunk-size warning only).
- `git diff --check`: PASS.
- Backend: **no source change** (`BACKEND_CHANGE: NO`); backend validation N/A.

## Remaining limitations

- `?focus` stays in the URL after the highlight clears (intentional refresh intent; not persisted UI state).
- "Em aprovação" focus falls back to bare `/contents` when no AWAITING_CLIENT item is in `needingAttention`.
- ModalOrSheet has no focus trap (existing primitive, unchanged).
- Filter work is interaction-level only; no new filtering capabilities added.

## Schema / migration status

```
SCHEMA_CHANGE: NO
MIGRATION: NO
```

## Git state

```
HEAD:               582c65ab8b726f5f348a87d3cc978739cf36bd78 (unchanged)
Dirty files:        7 modified (all frontend, F14.7-scoped)
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman` (minimal-change discipline). `kore-validate` tiering honored (focused tests → typecheck/build → full suite).
- No external MCP required; source/tests inspected via Read/Grep.
