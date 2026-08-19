# Looply — V1-R2.4 CI Security Gates Independent Audit

Date: 2026-08-19 · Branch: `main` @ `6003d99` · Audit only — no source modified, no commit, no push, no stage. `KORE_TOUCHED: NO`.

Purpose: independently audit the R2.4 CI security gates against the 14 audit areas, confirm the
implementation is sound, and decide B4. Ignore unrelated untracked M1/M2 Contabo reports.

## Baseline

- HEAD `6003d9909e145cf3565d3c1b573c0e7f3a61ad97` (unchanged, == origin/main).
- R2.4 files: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitleaks.toml`,
  `ops/security-gates.md` (all new). No application source changed.
- `git diff --check`: PASS (exit 0).

## 1 — CI triggers: PASS

`.github/workflows/ci.yml` triggers on `pull_request` (all) and `push: branches: [main]`. **No
`paths:` / `paths-ignore:` filters** — ordinary application changes cannot bypass the security gates.
`concurrency` cancels stale runs (does not skip). All gates run on every PR and main push.

## 2 — SAST (Semgrep): PASS

- Semgrep action (`returntocorp/semgrep-action@v3`) with meaningful focused rulesets
  `p/owasp-top-ten` + `p/javascript` (not the huge generic registry).
- Scans repository source (backend + frontend). Local scan mode (`publish_token: ""`, no account).
- **No `continue-on-error`**, **no shell construct masks exit status**. Semgrep fails the job on any
  finding (default behavior; no `fail_on: "none"` present). Findings are not silently ignored.
- `SAST_GATE: PASS`.

## 3 — Secret scan (Gitleaks): PASS

- `gitleaks/gitleaks-action@v2` runs in the security job (scans diff on PR, repo on push). Real
  finding fails CI (no `continue-on-error`).
- `.gitleaks.toml`: uses default rules (`[extend] useDefault = true`), **narrow** allowlist of 5
  regexes for documented format-comment placeholders (`postgresql://user:pass@...`,
  `YOUR-*-KEY-HERE`) — proven non-secrets from the R2.1 secret scan. No broad exclusions, no
  `.*` ignores, no secret values embedded in the config.
- `SECRET_GATE: PASS`.

## 4 — SCA (npm audit): PASS (counts independently confirmed)

- Both `backend/` and `frontend/` covered with `npm audit --omit=dev --audit-level=high`.
- Independently re-run:
  - **Production graph**: backend 0/0/0/0, frontend 0/0/0/0 → `SCA_PROD_BACKEND: PASS`,
    `SCA_PROD_FRONTEND: PASS`.
  - **Full tree**: backend and frontend each 1 Critical (`vitest`), 1 High (`vite`), 3 Moderate
    (`@vitest/mocker`, `esbuild`, `vite-node`) — all dev/test toolchain. Not hidden.
- `SCA_FULL_TREE: 1 Critical + 1 High + 3 Medium (dev toolchain, both apps)`.

## 5 — Security policy consistency: POLICY_MATCH YES (explicitly production-scoped)

`ops/security-gates.md` (lines 21-23) **explicitly and defensibly** defines the release gate as
"`0 Critical / 0 High` against the **production** dependency graph," with dev/test-toolchain
dependencies "tracked for remediation but do not gate production CI." This is a documented, explicit
policy scoping. The CI enforces exactly that. `POLICY_MATCH: YES`.

Dev-toolchain Critical/High findings are **tracked, not hidden** (documented in the report +
`ops/security-gates.md`), and `RELEASE_SECURITY_GATE` is kept FAIL until they are remediated.

## 6 — Dev-toolchain risk: NON_RELEASE_BLOCKING_WITH_TRACKING

- **Packages**: `vitest` (critical), `vite` (high), transitive `@vitest/mocker`/`esbuild`/`vite-node`.
- **Runtime production code**: NOT affected — frontend prod deps are react/react-dom/react-router/
  zustand/react-query (clean); backend prod deps clean; built `frontend/dist` is static.
- **Executes during CI/build/test?**: CI runs headless `vitest run` (no UI server) and `vite build`
  (production build, no dev server). The vitest critical targets the **Vitest UI server**
  (dev-only, human-invoked `--ui`); the vite high targets the **dev server** path-traversal /
  `fs.deny` / Windows NTLMv2 (dev-server only). Neither vulnerable surface is exercised by the
  automated CI/build/test pipeline.
- **Untrusted-input exploitation**: requires a local dev/UI server; not reachable via CI.
- **Upgrade path**: a `vitest` 2.x→3.x major upgrade (backend + frontend) resolves both; tracked via
  Dependabot + documented. Not a trivial patch (major version), so not remediated inside this battery.
- `DEV_TOOLCHAIN_RISK: NON_RELEASE_BLOCKING_WITH_TRACKING` · `DEV_FINDINGS_RELEASE_BLOCKING: NO`.

## 7 — Gate bypass: NONE

Workflow contains **no `continue-on-error`**, **no `|| true`**, **no `fail_on: "none"`**, no
ignored exit codes, no conditional `if:` that skips the security steps, no report-only scanners, and
no path filters. The only `true` match is `cancel-in-progress: true` (correct concurrency behavior).
`GATE_BYPASS_FOUND: NO`.

## 8 — GitHub Action supply chain

- `actions/checkout@v4`, `actions/setup-node@v4`, `returntocorp/semgrep-action@v3`,
  `gitleaks/gitleaks-action@v2` — all **major-pinned**, not SHA-pinned.
- `ACTION_PINNING: MAJOR_PINNED_ACCEPTABLE`. SHA-pinning would be a hardening improvement (LOW),
  not a blocker.

## 9 — Deterministic installs: PASS

- Lockfiles present: root, `backend/`, `frontend/` (`package-lock.json`).
- CI uses `npm ci` (deterministic) in the checks job; the security job uses committed lockfiles for
  `npm audit` (no install). No bare `npm install` in CI.
- `DEPENDENCY_INSTALL_DETERMINISM: PASS`.

## 10 — Dependabot: correct

- Covers `/backend`, `/frontend`, and `/` npm ecosystems; weekly schedule; default target branch
  (current default); no auto-merge of vulnerable majors configured. Dependabot is alerting/PR tooling,
  **not** counted as a gate.

## 11 — Current findings (independently classified, not merged)

| Severity | Package | Class | Count (each app) |
|----------|---------|-------|------------------|
| Critical | vitest | DEV_BUILD_TOOLCHAIN | 1 |
| High | vite | DEV_BUILD_TOOLCHAIN | 1 |
| Medium | @vitest/mocker, esbuild, vite-node | DEV_BUILD_TOOLCHAIN | 3 |
| — | — | PRODUCTION_RUNTIME | 0 Critical / 0 High / 0 Moderate / 0 Low |

`PROD_CRITICAL: 0` · `PROD_HIGH: 0` · `DEV_CRITICAL: 1` · `DEV_HIGH: 1` · `DEV_MEDIUM: 3`.

## 12 — B4 decision: PARTIAL

B4 requirements — SAST enforced (PASS), secret scan enforced (PASS), SCA enforced (PASS), no trivial
bypass (PASS), project's 0-Critical/0-High release policy satisfied for the **production** graph
(YES). However, **known Critical/High dev-toolchain findings (vitest/vite) remain unremediated** in
the full dependency tree. Even though they are non-release-blocking under the documented
production-scoped policy, a rigorous gate is **not cleared** while Critical/High remain anywhere in
the build/test toolchain — they are flagged for remediation rather than silently cleared. Per the
task rule ("do not clear it for convenience"), `RELEASE_BLOCKER_B4: PARTIAL`.

`RELEASE_SECURITY_GATE: FAIL` (0 Critical / 0 High not yet achieved across the full dependency tree).

## 13 — Test evidence

- No app tests rerun (no application source changed; CI files do not alter build scripts).
- Workflow YAML structurally sane (jobs `security` + `checks`, correct scanner steps) and
  `dependabot.yml` + `.gitleaks.toml` parse cleanly.
- SCA commands and counts independently re-run and confirmed.
- `git diff --check`: PASS.
- Semgrep/Gitleaks are CI-only (not installed locally) — documented local limitation; workflow wiring
  validated.

## 14 — Scope: clean

- No backend/frontend source changes, no schema/migration, no new app dependency, no unrelated
  workflow redesign. Only new CI/config/docs files. M1/M2 Contabo reports untouched.

## Findings summary

- **CRITICAL: 0 (production) / 1 (dev toolchain)** — tracked, non-release-blocking.
- **HIGH: 0 (production) / 1 (dev toolchain)** — tracked, non-release-blocking.
- **MEDIUM: 0 (production) / 3 (dev toolchain)** — tracked.
- No implementation defects in the CI gates themselves.

## Result

```
CRITICAL_FINDINGS: 0 (prod) / 1 (dev)
HIGH_FINDINGS: 0 (prod) / 1 (dev)
MEDIUM_FINDINGS: 0 (prod) / 3 (dev)
LOW_FINDINGS: 0

CI_PR_GATE: PASS
CI_MAIN_GATE: PASS
GATE_BYPASS_FOUND: NO

SAST_GATE: PASS
SECRET_GATE: PASS

SCA_PROD_BACKEND: PASS
SCA_PROD_FRONTEND: PASS
SCA_FULL_TREE: 1C + 1H + 3M (dev toolchain)

PROD_CRITICAL: 0
PROD_HIGH: 0
DEV_CRITICAL: 1
DEV_HIGH: 1
DEV_MEDIUM: 3

SECURITY_POLICY: 0_CRITICAL_0_HIGH (production-scoped, explicitly documented)
POLICY_MATCH: YES
ZERO_CRITICAL_HIGH_EFFECTIVELY_ENFORCED: YES (production graph); dev findings tracked separately

DEV_TOOLCHAIN_RISK: NON_RELEASE_BLOCKING_WITH_TRACKING
DEV_FINDINGS_RELEASE_BLOCKING: NO

ACTION_PINNING: MAJOR_PINNED_ACCEPTABLE
DEPENDENCY_INSTALL_DETERMINISM: PASS
DEPENDABOT_CONFIG: PASS
SUPPLY_CHAIN_STATUS: SANE

BACKEND_CHANGE: NO
FRONTEND_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
NEW_APP_DEPENDENCY: NO

RELEASE_BLOCKER_B4: PARTIAL
RELEASE_SECURITY_GATE: FAIL

R2_4_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_DEV_TOOLCHAIN_REMEDIATION

VALIDATION: PASS (SCA confirmed, YAML/TOML valid, diff-check clean, gates wired)
REPORT: .dev-reports/looply-v1-r2-4-ci-security-gates-independent-audit.md
GIT_STATE: HEAD 6003d99 unchanged; new CI files uncommitted; M1/M2 untouched
KORE_TOUCHED: NO
```

## Git state

```
HEAD:          6003d9909e145cf3565d3c1b573c0e7f3a61ad97 (unchanged)
Changed:       .github/, .gitleaks.toml, ops/security-gates.md (new, uncommitted)
Untracked:     this report + R2.4 report + prior M1/M2 reports (ignored/untouched)
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: R2.4 report, `ci.yml`, `dependabot.yml`, `.gitleaks.toml`, `ops/security-gates.md`,
  `AGENTS.md`, R2 security audit.
- Ran: `npm audit` (prod + full, backend/frontend) to independently confirm counts, YAML/TOML
  structural validation, workflow bypass-pattern grep, lockfile/determinism checks, `git diff --check`.
- No secrets printed; no source modified; no dependency upgraded; no CI executed on GitHub (config audit only).

---

LOOPLY V1-R2.4 CI SECURITY GATES INDEPENDENT AUDIT — PASS