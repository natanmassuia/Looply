# R2.P8 — Dependency / Runtime Hygiene

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** 67037d7

## Runtime / version authority

- Node runtime: v24.18.0; npm 11.16.0.
- `engines.node >=22` declared consistently in root (`package.json`), backend, and frontend manifests. Node v24 satisfies all.
- No `.nvmrc` in repo (see infra follow-up).
- No CI workflow files in-repo (CI config is external).

## Dependency observations

| Check | Result |
|---|---|
| Backend lockfile ↔ manifest | CONSISTENT (`npm ci --dry-run` OK) |
| Frontend lockfile ↔ manifest | CONSISTENT (`npm ci --dry-run` OK) |
| Root package-lock.json | Minimal lockfile (root has no deps, only engines) — consistent, not an artifact |
| Node version expectations | Consistent `>=22` across root/backend/frontend; runtime v24 satisfies |
| Production vs dev placement | PASS — all runtime deps used in prod code; build/test deps in devDependencies |
| Unused direct dependencies | 0 confirmed — every backend runtime dep and every frontend runtime dep has source usage (`react-dom` via `react-dom/client`) |
| Duplicate runtime dependencies | 0 confirmed — multi-version lockfile entries are nested transitive packages (frontend `react-is`/`react-refresh`/`react-router`, backend `dotenv-cli`/`dotenv-expand`), not conflicting copies of the direct deps |
| Deprecated/unsupported packages | none blocking (audit clean) |
| Global tool assumptions | NONE_BLOCKING — root scripts use `npm --prefix` / package scripts; no unexpected global-tool dependence |

## Security audit

- BACKEND_FULL_AUDIT: 0 Critical / 0 High / 0 Medium / 0 Low (full tree)
- FRONTEND_FULL_AUDIT: 0 Critical / 0 High / 0 Medium / 0 Low (full tree)

## Classification

- CONFIRMED_HYGIENE_DEFECTS: 0
- COMPATIBILITY_RISKS: 0
- FALSE_POSITIVES: 1 (suspected `dotenv`/`react` duplicate versions — proven nested transitive deps)
- NEEDS_INFRA_FOLLOWUP: 1

### Infra-only follow-up (not a source defect)

- No `.nvmrc` / explicit Node version pin. Runtime v24 satisfies `>=22`, but dev/CI/prod could drift. Recommend pinning Node (e.g. `.nvmrc` = 24) as an infra/host task — outside this battery's scope (no host/config changes per task rules).

## Fixes applied

None. No confirmed hygiene defect required a source/manifest change.

## Validation

No source/manifest changes → existing validated state reused (backend 481/481, frontend 305/305 previously green; `npm ci --dry-run` confirmed lockfile consistency fresh).

- BACKEND_TESTS: 481/481_PASS (unchanged)
- FRONTEND_TESTS: 305/305_PASS (unchanged)
- BACKEND_TYPECHECK: PASS (unchanged)
- FRONTEND_TYPECHECK: PASS (unchanged)
- BACKEND_BUILD: PASS (unchanged)
- FRONTEND_BUILD: PASS (unchanged)
- DIFF_CHECK: PASS (no changes)

## Files changed

None.

## Result

RESULT: PASS
NODE_RUNTIME_CONSISTENCY: PASS
PACKAGE_MANAGER_CONSISTENCY: PASS
LOCKFILE_CONSISTENCY: PASS
NPM_CI_COMPATIBILITY: PASS

BACKEND_FULL_AUDIT: 0/0/0/0
FRONTEND_FULL_AUDIT: 0/0/0/0

PROD_DEV_DEPENDENCY_PLACEMENT: PASS
UNUSED_DIRECT_DEPENDENCIES: 0_CONFIRMED
DUPLICATE_RUNTIME_DEPENDENCIES: 0_CONFIRMED
DEPRECATED_PACKAGES: NONE_BLOCKING
GLOBAL_TOOL_ASSUMPTIONS: NONE_BLOCKING

CONFIRMED_HYGIENE_DEFECTS: 0
COMPATIBILITY_RISKS: 0
NEEDS_INFRA_FOLLOWUP: 1 (Node version pin / .nvmrc — infra task, out of scope)

FIXES_APPLIED: 0
FILES_CHANGED: NONE
DEPENDENCY_CHANGE: NO
APP_CODE_CHANGED: NO
SCHEMA_CHANGE: NO
MIGRATION: NO

BACKEND_TESTS: 481/481_PASS
FRONTEND_TESTS: 305/305_PASS
BACKEND_TYPECHECK: PASS
FRONTEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
FRONTEND_BUILD: PASS
DIFF_CHECK: PASS

REMAINING_HYGIENE_FINDINGS: 0
R2_P8_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT

REPORT: .dev-reports/looply-v1-r2-p8-dependency-runtime-hygiene.md
GIT_STATE: no source/manifest changes; reports (M1/M2/P7/P8 + this) untracked; HEAD still 67037d7
KORE_TOUCHED: NO

LOOPLY R2.P8 DEPENDENCY RUNTIME HYGIENE — COMPLETE