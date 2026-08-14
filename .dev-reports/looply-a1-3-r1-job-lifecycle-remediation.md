# A1.3-R1 Job Lifecycle Remediation

## Changes

| Area | Status |
|---|---|
| Canonical transition primitive | Added `transitionJobLifecycle` |
| Generic update lifecycle field | Removed |
| Cancellation | Canonical transition to `CANCELLED` |
| HTTP surface | No new route; service primitive is sufficient for A2 |
| Schema/migration | Unchanged |

## Matrix

| From | Allowed target |
|---|---|
| `OPEN` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | none |
| `CANCELLED` | `CANCELLED` idempotently |

## Validation

| Command | Result |
|---|---|
| Focused lifecycle tests | PASS, 12 tests |
| Existing Job atomic tests | PASS, 2 tests |
| Full backend/frontend validation | Recorded in final A1 report |
