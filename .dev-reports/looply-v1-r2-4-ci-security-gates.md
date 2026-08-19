# Looply — V1-R2.4 CI Security Gates

Date: 2026-08-19 · Branch: `main` @ `6003d99` · No commit, no push, no stage. `KORE_TOUCHED: NO`.

Addresses release blocker **B4 — CI/security gates** (R2 audit: "No CI exists, `.github/` absent;
no SAST/SCA/secret scan; no release gate enforcement"). Adds a minimal, non-overlapping CI security
baseline.

## Step 1 — Existing tool inventory

The repo had **no CI and no security config at all** (verified: no `.github/workflows`, no
`.gitleaks.toml`, no `.semgrep`, no Dependabot config). Classification:

| Tool | Status | Note |
|------|--------|------|
| Semgrep | ABSENT | added as SAST |
| Gitleaks | ABSENT | added as secret scan |
| Dependabot | ABSENT | added (native alerts) |
| npm audit | PRESENT_NOT_GATED | npm built-in; now gated in CI |
| GitHub dependency review | ABSENT | covered by npm audit gate instead (no duplication) |
| CodeQL | ABSENT | not added — Semgrep covers SAST; avoid overlapping scanners |
| Trivy | ABSENT | not added (container image scan; not needed for this Node repo) |

## Step 2 — Secret scan (Gitleaks)

- Added `.gitleaks.toml` using gitleaks default rules (`[extend] useDefault = true`) with a **narrow**
  allowlist for proven false positives only (format-comment `postgresql://user:pass@...` and
  `YOUR-*-KEY-HERE` placeholders, verified non-secrets in the R2.1 secret scan). No broad ignores.
- Runs on PR/push via `gitleaks/gitleaks-action@v2` in the `security` job; a real finding fails CI.
- No secrets printed into logs (gitleaks masks findings).
- Local limitation: gitleaks not installed on this host; validated via CI wiring + config syntax.

## Step 3 — SAST (Semgrep)

- Added `returntocorp/semgrep-action@v3` with focused rulesets `p/owasp-top-ten` + `p/javascript`
  (OWASP Top 10 + JS/TS) — NOT the huge generic registry. Local scan mode (no external account/token).
- Covers `backend/` and `frontend/` source (repository scan). CI exits non-zero on findings (real gate,
  not "always green").
- Local limitation: semgrep not installed on this host; validated via workflow wiring.

## Step 4 — SCA (npm audit + Dependabot)

- `npm audit --omit=dev --audit-level=high` for **both** `backend/` and `frontend/` in CI — enforces
  Critical/High fail against the **production** dependency graph (what ships). Uses committed lockfiles
  (no install needed in the security job).
- Dependabot (`.github/dependabot.yml`) covers root, `backend/`, `frontend/` npm ecosystems → automated
  security alerts + update PRs (native GitHub SCA).
- Policy: Critical fail, High fail, Medium report/triage, Low report.

### Actual SCA results

**Production dependency graph (--omit=dev):**

| App | Critical | High | Moderate | Low |
|-----|----------|------|----------|-----|
| backend | 0 | 0 | 0 | 0 |
| frontend | 0 | 0 | 0 | 0 |

Production dependencies are clean (0/0/0/0) for both apps.

**Dev/test toolchain (full audit):** both backend and frontend show **1 Critical (`vitest`)**,
**1 High (`vite`)**, and 3 Moderate (`esbuild`, `@vitest/mocker`, `vite-node`) — all in the
test/build toolchain (vitest 2.1.9, vite), which is **NOT shipped to production**. These are tracked
for remediation (a `vitest` 2.x→3.x major upgrade) and are **not hidden** — see B4/Release decision.

## Step 5 — Gate policy

- Release policy: **CRITICAL = 0, HIGH = 0**.
- Enforced in CI against production SCA + SAST + secret-scan findings.
- Medium: visible, triaged separately; Low: backlog. Not automatically hidden.
- `ZERO_CRITICAL_HIGH_ENFORCED` (production graph): YES. Dev-toolchain findings tracked separately.

## Step 6 — CI behavior

- `.github/workflows/ci.yml` runs on `pull_request` and `push` to `main`.
- `security` job: SAST (semgrep) + secret scan (gitleaks) + SCA (npm audit both apps) — no duplicate
  scans; one security pass.
- `checks` job: typecheck + build + test — no redundant re-scan.
- `concurrency` cancels stale runs for the same ref to avoid wasted duplication.
- No deployment behavior added.

## Step 7 — Supply-chain sanity

- Actions pinned to sensible majors: `actions/checkout@v4`, `actions/setup-node@v4`,
  `returntocorp/semgrep-action@v3`, `gitleaks/gitleaks-action@v2`.
- `npm ci` used in CI (deterministic, honors committed lockfiles) — not `npm install`.
- Lockfiles committed at root, `backend/`, `frontend/`.
- No `curl|bash` remote-install paths.
- `SUPPLY_CHAIN_STATUS: SANE` (no redesign).

## Step 8 — Documentation

`ops/security-gates.md`: scanners, coverage, severity policy, how CI fails, local reproduction,
false-positive handling (narrow `.gitleaks.toml` allowlist, `nosemgrep` with rationale), and the rule
"never suppress a real Critical/High to get green."

## Step 9 — Validation

- Memory 1.4Gi available (no RESOURCE_PRESSURE).
- `git diff --check`: PASS (exit 0).
- Config syntax: `ci.yml`, `dependabot.yml` (YAML) and `.gitleaks.toml` (TOML) all parse successfully.
- Local SCA (`npm audit --omit=dev`): backend & frontend prod both 0/0/0/0.
- SAST (semgrep) and secret scan (gitleaks): **not installed locally** → run only in GitHub-hosted CI;
  workflow wiring validated, local reproduction documented. `CI_ONLY_VALIDATION: YES` for these two.
- No application source changed → no app tests re-run (nothing to regress).

## Step 10 — Security findings

| Severity | Package | Graph | Surface | Release blocker |
|----------|---------|-------|---------|-----------------|
| Critical | vitest (≤3.2.5) | dev/test | Vitest UI server file-read (test-only UI) | NO (not shipped) |
| High | vite (≤6.4.2) | dev/test | dev-server path traversal / fs.deny (dev server) | NO (not shipped) |
| Moderate | esbuild / @vitest/mocker / vite-node | dev/test | transitive via vitest/vite | NO |

All findings are in the **dev/test toolchain only**, not in production dependencies (frontend prod =
react/react-dom/react-router/zustand/react-query, clean; backend prod = clean). Remediation for the
Critical/High requires a `vitest` 2.x→3.x major upgrade (backend + frontend) — **not trivial**, and per
task scope is tracked (Dependabot + documented), not remediated inside this battery.

## B4 / Release decision

- **B4 (CI security gates):** IMPLEMENTED — SAST, secret scan, and production SCA gates now run in CI
  with enforced 0-Critical/0-High. Production dependency graph is clean (0/0).
- However, **Critical/High findings remain in the dev/test toolchain** (vitest/vite). Per the task rule
  ("If Critical/High remain... RELEASE_SECURITY_GATE stays FAIL"), these are not hidden:
  - `RELEASE_BLOCKER_B4: PARTIAL` (gate implemented, but dev-toolchain Critical/High findings remain
    to remediate before B4 can be fully cleared).
  - `RELEASE_SECURITY_GATE: FAIL` (0 Critical/0 High not yet achieved across the full dependency tree,
    even though production deps are clean).
- CI alone does not claim release readiness.

## Files changed (new only)

```
.github/workflows/ci.yml          (CI: SAST + secret scan + SCA + typecheck/build/test)
.github/dependabot.yml            (Dependabot alerts for npm ecosystems)
.gitleaks.toml                    (secret-scan config + narrow allowlist)
ops/security-gates.md             (documentation)
```

`BACKEND_CHANGE: NO` · `FRONTEND_CHANGE: NO` · `SCHEMA_CHANGE: NO` · `MIGRATION: NO` ·
`NEW_APP_DEPENDENCY: NO` (CI tooling only; no runtime dependency added).

## Git state

```
HEAD:          6003d9909e145cf3565d3c1b573c0e7f3a61ad97 (unchanged, == origin/main)
Changed:       .github/, .gitleaks.toml, ops/security-gates.md (new, uncommitted)
Untracked:     this report + prior M1/M2 Contabo reports (untouched)
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Ran: `npm audit` (backend/frontend, prod + full), YAML/TOML config validation, `git diff --check`,
  file inventory of CI/security tooling.
- Inspected: root/backend/frontend `package.json` + lockfiles, `AGENTS.md`, R2 security audit, existing
  CI (none), local tool availability (gitleaks/semgrep/trivy absent).
- No secrets printed; no source modified; no dependency upgraded; no CI executed on GitHub (config only).

---

**RESULT: COMPLETE** (gate implemented) · `R2_4_STATUS: COMPLETE` ·
`NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT` · `KORE_TOUCHED: NO`

LOOPLY V1-R2.4 CI SECURITY GATES — COMPLETE