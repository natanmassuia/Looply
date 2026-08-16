# Performance Audit — Looply Frontend F2A — 2026-08-14

## Executive Summary

1. Retry policy now fails fast on deterministic 4xx and caps transient retries at one — fewer duplicate requests, especially around sensitive mutations (which never retry).
2. Zero new runtime dependencies beyond the in-place React Router major upgrade; bundle grew ~15KB gzip (333→348KB raw, ~98→104KB gzip).
3. Test harness disables retries, keeping foundation tests deterministic with no timer flakiness.

## Findings

| Location | Problem | Severity | Recommendation |
|---|---|---|---|
| Bundle after RR v7 | +15KB gzip vs v6. | Low | Acceptable; revisit at F10 if budget matters. |
| Existing hooks do not forward AbortSignal | Queries cannot be cancelled on unmount/refetch. | Low | Canonical F4+ hooks should pass `{ signal }`; migrating all 19 legacy hooks now is scope creep. |
| Legacy domain queries unchanged | ContentsList/Dashboard/Calendar still fetch legacy unbounded projections. | Info | Owned by F4/F6/F8 canonical migrations, not F2A. |

## Checked and Clean

- `shouldRetry` caps at one retry; 4xx short-circuits — no retry loops.
- Mutations: `retry: false` — no replayed writes.
- No new state duplication: session still lives only in TanStack Query `me`; workspace helpers derive from it without copying into Zustand.
- Query keys unchanged (stable, simple) — no cache churn from renames.
- No API calls inside render loops; ContentsList handlers remain event-driven.
- Test QueryClient has `gcTime: 0` and retries off — no leaked timers.

## Deferred

- Signal wiring on legacy hooks.
- Query-key namespacing per domain (F4+).
- Bundle analysis/code-splitting (F10).
