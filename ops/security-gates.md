# Looply — CI Security Gates (R2.4)

Concise reference for the automated application-security baseline enforced in CI.

## Scanners

| Scanner | What it covers | Where it runs | Fails CI on |
|---------|---------------|---------------|-------------|
| **Semgrep** (SAST) | Static source analysis — OWASP Top 10 + JavaScript rules over `backend/` and `frontend/` | `.github/workflows/ci.yml` → `security` job | Any finding (non-zero exit) |
| **Gitleaks** (secret scan) | Committed secrets / hardcoded credentials | `ci.yml` → `security` job | Any real finding (non-zero exit) |
| **npm audit** (SCA) | Dependency vulnerabilities in the **production** dependency graph (`--omit=dev`) for both `backend/` and `frontend/` | `ci.yml` → `security` job | Critical or High (via `--audit-level=high`) |
| **Dependabot** (SCA alerts) | Automated dependency security alerts + update PRs | GitHub native (`.github/dependabot.yml`) | n/a (alerting/remediation) |

## Severity policy

- **CRITICAL = 0** (required for release)
- **HIGH = 0** (required for release)
- **MEDIUM** — visible, triaged separately, not automatically hidden
- **LOW** — visible / backlog

The release gate enforces `0 Critical / 0 High` against the **production** dependency graph and
against SAST/secret findings on the source. Dev/test-toolchain dependencies (vitest/vite/esbuild)
are NOT shipped; their findings are tracked for remediation but do not gate production CI.

**CI alone does not claim release readiness.** CI is a gate that can *fail* a release; it is not an
attestation that the product is release-ready (that requires the full R2 release gate).

## How CI fails

The `security` job runs SAST, secret scan, and SCA; any step exiting non-zero fails the job and
blocks the PR / push to `main`. The `checks` job runs typecheck, build, and test.

## Reproducing locally

- **SCA**: `npm --prefix backend audit --omit=dev --audit-level=high` and the same for `frontend`.
- **SAST**: install semgrep (`pip install semgrep`) and run
  `semgrep --config p/owasp-top-ten --config p/javascript backend/src frontend/src` (or in CI).
- **Secret scan**: install gitleaks and run `gitleaks detect --config .gitleaks.toml`.
- **Checks**: `npm run typecheck && npm run build && npm run test` (root).

## Handling false positives

- Secret scan allowlist lives in `.gitleaks.toml` (`[allowlist]`). It is **narrow** — only documented
  format-comment placeholders (e.g. `postgresql://user:pass@...`) proven non-secrets. Do not add
  broad ignore patterns.
- For SAST: use Semgrep path/rule filtering or inline `// nosemgrep` with a comment explaining why
  the line is safe. Do not blanket-disable a rule class.

## Rule

**Never suppress a real Critical or High just to get CI green.** If a genuine finding exists, the
gate fails and the finding is remediated or explicitly triaged — never hidden.

## Supply-chain notes

- GitHub Actions are pinned to sensible major versions (`checkout@v4`, `setup-node@v4`,
  `semgrep-action@v3`, `gitleaks-action@v2`).
- `npm ci` is used in CI (deterministic, honors committed lockfiles) rather than `npm install`.
- Lockfiles are committed at root, `backend/`, and `frontend/`.
- No `curl|bash` remote-install paths in CI.
