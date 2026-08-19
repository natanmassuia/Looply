# R2.P8 — Dependency / Runtime Hygiene — Independent Audit

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** 67037d7

## Audit scope

- `.dev-reports/looply-v1-r2-p8-dependency-runtime-hygiene.md`
- backend + frontend `package.json` / `package-lock.json`
- CI workflow `.github/workflows/ci.yml`, `.github/dependabot.yml`
- No new open-ended dependency sweep; no source/manifest changes.

## 1. Runtime consistency

- `engines.node >=22` declared in root, backend, and frontend manifests.
- CI `.github/workflows/ci.yml` uses `actions/setup-node` with `node-version: 22` in both jobs.
- Dev runtime is Node v24.18.0.
- **All within `>=22`** — consistent across backend, frontend, CI, and repo docs. No current compatibility defect.
- **NODE_PIN_FOLLOWUP: REQUIRED_LATER** — dev runs 24 while CI pins 22; within-range but drift between dev/CI/prod is possible. Not release-blocking.

## 2. Lockfiles / npm ci

- CI runs `npm --prefix backend ci` and `npm --prefix frontend ci` (deterministic, lockfile-driven).
- `npm ci --dry-run` succeeds for both (verified in R2.P8, manifests match lockfiles, no drift).
- **LOCKFILE_CONSISTENCY: PASS**, **NPM_CI_COMPATIBILITY: PASS**.

## 3. Security (independently re-run)

- BACKEND_FULL_AUDIT: 0/0/0/0 (re-confirmed)
- FRONTEND_FULL_AUDIT: 0/0/0/0 (re-confirmed)

## 4. Dependency placement

- Runtime deps (backend: @aws-sdk/*, @prisma/client, cors, express, helmet, ioredis, zod, dotenv; frontend: @tanstack/react-query, react, react-dom, react-router-dom, zustand) all in `dependencies`.
- Build/test-only packages (vite, vitest, typescript, @testing-library/*, jsdom, tailwindcss, autoprefixer, postcss, dotenv-cli, tsx) all in `devDependencies`.
- **PROD_DEV_DEPENDENCY_PLACEMENT: PASS**.

## 5. Direct dependencies

- Reference evidence confirms every declared runtime dependency has source usage (backend `dotenv`/`express`/`zod`/etc.; frontend `react` via `react-dom/client`, `react-router-dom`, `zustand`, `@tanstack/react-query`).
- **UNUSED_DIRECT_DEPENDENCIES: 0_CONFIRMED**.

## 6. Deprecated packages

- Full-tree audits clean (0/0/0/0 both apps). No installed direct package is EOL/unsupported with material runtime or security risk.
- **DEPRECATED_PACKAGES: NONE_BLOCKING**.

## 7. Global tool assumptions

- Scripts use `npm --prefix <app> run <script>` and local binaries; CI uses `npm ci` + package scripts + `npm audit`.
- No undocumented global tooling required.
- **GLOBAL_TOOL_ASSUMPTIONS: NONE_BLOCKING**.

## 8. Scope confirmation

- SOURCE_CHANGE: NO
- MANIFEST_CHANGE: NO
- LOCKFILE_CHANGE: NO
- DEPENDENCY_CHANGE: NO
- SCHEMA_CHANGE: NO
- MIGRATION: NO

## Validation (evidence reused — no changes)

- BACKEND_TESTS: 481/481_PASS
- FRONTEND_TESTS: 305/305_PASS
- BACKEND_TYPECHECK: PASS
- FRONTEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- FRONTEND_BUILD: PASS
- DIFF_CHECK: PASS

## Result

RESULT: PASS
NODE_RUNTIME_CONSISTENCY: PASS
NODE_PIN_FOLLOWUP: REQUIRED_LATER
NODE_PIN_RELEASE_BLOCKING: NO

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
NEEDS_INFRA_FOLLOWUP: 1

SOURCE_CHANGE: NO
MANIFEST_CHANGE: NO
LOCKFILE_CHANGE: NO
DEPENDENCY_CHANGE: NO
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
R2_P8_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION

REPORT: .dev-reports/looply-v1-r2-p8-dependency-runtime-independent-audit.md
GIT_STATE: no source/manifest/lockfile changes; reports (M1/M2/P7/P8 + this) untracked; HEAD still 67037d7
KORE_TOUCHED: NO

LOOPLY R2.P8 DEPENDENCY RUNTIME INDEPENDENT AUDIT — PASS