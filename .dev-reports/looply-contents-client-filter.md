# Contents Client Filter — Implementation Report

## Branch

`feature/demo-v1-polish`

## Initial SHA

`46f41d513550651afacb3ff931d4077975343bed`

## Summary

Added a client/company filter dropdown to the Conteúdos (Contents) Kanban page. The filter is purely client-side — content items already include `clientId` and the `client` relation in the API response, so no backend changes were required.

## Files Changed

- `frontend/src/features/ContentsList.tsx` — added `useClients` import, `clientId` state, `filtered` memo, filter `<select>` UI, and `aria-label` for accessibility.

## How the Filter Was Implemented

1. Added `const [clientId, setClientId] = useState<string>("")` — empty string means "Todas as empresas".
2. Added `useClients()` hook to fetch the client list for dropdown options.
3. Added `filtered` memo that filters `data` by `clientId` when non-empty, or returns all items when empty.
4. Changed `byStatus` memo to group from `filtered` instead of `data`.
5. Added a `<select>` dropdown above the Kanban grid with `className="input"` (reuses existing form control style from `NewContent.tsx` pattern).
6. The dropdown renders "Todas as empresas" as default + one `<option>` per client from `useClients()`.

## Client-Side vs Server-Side

**Client-side.** The `ContentListItem` type already includes `clientId: string` and `client?: { id, name, brandColor }`. The backend `listContents` already returns these fields. Filtering client-side avoids:
- API contract changes
- Backend code changes
- Extra network requests
- Cache invalidation complexity

## Tests Executed

| Command | Result |
|---------|--------|
| `npm --prefix frontend run typecheck` | PASS — no errors |
| `npm --prefix frontend run test` | PASS — 5/5 tests passed |
| `npm --prefix frontend run build` | PASS — built successfully |
| `git diff --check` | PASS — no whitespace issues |

## Limitations Known

- No E2E tests exist in the project (no Playwright/Cypress). E2E gate is dispensable.
- The filter is purely visual — it does not persist across page navigation or URL state. This is acceptable for the current scope.
- If a client has no contents, selecting it will show empty columns (valid per requirement #3).

## E2E Gate

**Dispensable** — no E2E framework or tests exist in the repository. No e2e directory, no Playwright config, no Cypress config found.

## git diff --check

Clean — no output (no whitespace errors).

## Commit Hash

Pending commit.
