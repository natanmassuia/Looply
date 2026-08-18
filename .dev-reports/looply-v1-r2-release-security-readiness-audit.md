# Looply — V1-R2 Release & Security Readiness Audit

Date: 2026-08-18 · Branch: `main` @ `b8cd50b` · Audit/discovery only — no source modified, no commit, no push.

## 1. Executive status

Looply V1 has a **strong application-level security baseline** (helmet, scrypt+timingSafeEqual password hashing, httpOnly/secure/sameSite session cookies with opaque sha256-hashed tokens, per-request session/membership revalidation, CSRF origin guard, request correlation IDs, structured redacting logger, clean error mapping, webhook signature/IP verification, rate limiting on login/approval/invite, tenant scoping across jobs/clients/files/appointments/calendar, no injection/mass-assignment/XSS). No CI, no automated security scanning, no backups, no observability/alerting, and **one confirmed cross-tenant PII disclosure** block release.

**NOT_RELEASE_READY** / **NOT_SECURITY_READY**. Release gate **FAIL**.

## 2. Baseline / git state

```
REPO_ROOT:      /opt/looply
HEAD:           b8cd50b909cbd86d77294bdf77a98f395f9ae0c5 (== origin/main)
WORKTREE:       clean at start; no source modified during audit
KORE_TOUCHED:   NO
```

## 3. Architecture / security surface

- **Stack**: Node ≥22 + Express backend (PM2 `ecosystem.config.cjs`), React/Vite SPA, Prisma/PostgreSQL, S3-compatible object storage (MinIO-style), Redis (optional, for WhatsApp idempotency), optional external providers (Meta WhatsApp, Gupshup, Assistant LLM).
- **Process manager**: PM2 fork, 1 instance, autorestart, 500MB memory-restart (backend only). **No Docker/Compose/Nginx** in repo.
- **Deployment**: `ecosystem.config.cjs` runs `backend/dist/server.js`; frontend built to `frontend/dist` (static, no serving config in repo).
- **Secrets**: `.env` and `.env.backup.*` are git-ignored and **not committed** (verified via `git ls-files` and history). `.env.example` committed with empty placeholders. No hardcoded secrets found.
- **App middleware**: helmet (defaults), CORS restricted to `CORS_ORIGIN` (env rejects `*`), express.json `1mb`, requestId, requestLogger, CSRF origin guard, then global `requireAuth → requirePasswordChanged → requireWorkspaceActive`; public token routes and webhooks mounted outside the session chain with their own auth.
- **Security libs**: `loginLimiter` (10/15min/IP+email), `rateLimit` (approval read 60/15min, approval write 20/15min, invite 20/15min), `password` (scrypt + timingSafeEqual; opaque 256-bit session tokens hashed), `token` (256-bit random approval tokens, hashed at rest), `session` (7-day httpOnly secure lax cookie), `env.validateEnv` (fail-fast, rejects CORS wildcard).

## 4. Threat model (focused)

- **Assets**: tenant data, credentials, sessions, client/demand data, uploaded files, approval links/tokens, provider credentials, audit/history, PostgreSQL, object storage.
- **Actors**: owner/admin, member/viewer, invited user, unauthenticated user, public approval recipient, malicious tenant, compromised user, external attacker, compromised provider, operator.
- **Trust boundaries**: browser↔SPA, SPA↔API, API↔DB, API↔Redis, API↔object storage, API↔providers, public-approval boundary, CI↔deployment (N/A — no CI), host↔internet.

**Material threats with controls:**
- Cross-tenant object access → mostly controlled (tenant-scoped `findFirst`) but **BROKEN via `/api/team`** (HIGH).
- BOLA/IDOR → 1 confirmed (team), others verified tenant-safe.
- Approval-token guessing → controlled (256-bit random, hashed, rate-limited).
- File upload/download → controlled (non-predictable keys, ownership check, size/type limits, presign TTL).
- Webhook spoofing/replay → controlled (HMAC or IP allowlist + idempotency).
- Injection/XSS/mass assignment → no findings.
- Brute force → login/approval/invite limited; password-reset-with-token not limited (defense-in-depth).
- Backup theft / DR → **no backup exists** (see §7).
- Destructive operator action / rollback → no rollback mechanism.

## 5. Release operations

```
DEPLOYMENT_AUTHORITY: PARTIAL (PM2 + build scripts; no CI/CD, no container, no proxy config in repo)
ROLLBACK_EXISTS: MISSING (no rollback/version-identify mechanism; prior state = git + manual redeploy)
ROLLBACK_TESTED: MISSING
HEALTHCHECK_EXISTS: PARTIAL (/health liveness + /ready DB-readiness exist; not wired to a process manager/probe)
POST_DEPLOY_VERIFY_EXISTS: MISSING (no post-deploy smoke/verify step)
RELEASE_VERSION_TRACEABLE: PARTIAL (git commit is traceable; no runtime version endpoint exposing release id)
```

## 6. Observability & error monitoring

- **Structured logging**: YES — one JSON line/event (`logger.ts`), requestId, method, redacted path, status, duration.
- **Log redaction**: GOOD — logger redacts `authorization/cookie/password/token/secret/apikey`; request logger strips approval tokens and query strings; webhook logs mask phones.
- **Error handling**: `errorHandler` maps Prisma/known errors to clean 4xx/5xx, never leaks stack to clients (dev-only), surfaces requestId.
- **Unhandled rejection/exception**: MISSING — no `unhandledRejection`/`uncaughtException` handlers (a crash is only caught by PM2 autorestart, not logged as a structured event).
- **Metrics/uptime/alerting**: MISSING — no metrics, no health-check integration, no alerting, no exception-monitoring platform (Sentry/Datadog/etc. absent).
- **Security-event logging**: PARTIAL — auth/approval/workflow events logged as domain Activities, but no dedicated security-audit log with structured auth failure/revocation events for ops review.

```
OBSERVABILITY: PARTIAL
ERROR_MONITORING: PARTIAL
ALERTING: MISSING
LOG_REDACTION: GOOD
SECURITY_EVENT_LOGGING: PARTIAL
```

**Operational question ("what failed, when, for which tenant/request, and are we alerted?"):** The requestId + structured logs answer *when/which request*; tenant is not consistently included in every log line; and there is **no alerting** — a failure can go undetected until a user reports it.

## 7. Backup / Restore / DR

- **PostgreSQL**: NO backup mechanism evidenced in repo; no script, schedule, retention, or off-host destination.
- **Object storage (MinIO)**: NO backup evidenced.
- **Application config / env**: `.env` is present on the host only (git-ignored); a copy exists as `.env.backup.20260813-132904` on the same host (**not off-host**, not encrypted, not automated).
- **Migration history**: Prisma migrations are committed (good — rebuildable schema), but no tested recovery drill.
- **Restore procedure**: NOT defined/evidenced. **BACKUP EXISTS ≠ RESTORE PROVEN** — restore has never been proven.

```
POSTGRES_BACKUP: MISSING
OBJECT_STORAGE_BACKUP: MISSING
CONFIG_BACKUP: PARTIAL (host-local .env.backup only, not off-host)
OFF_HOST_BACKUP: MISSING
RESTORE_PROVEN: NO
RPO: UNDEFINED
RTO: UNDEFINED
DR_STATUS: NOT_EVIDENCED
```

**Scenarios**: ransomware (no backup → unrecoverable), VM loss (data loss), accidental DELETE (no point-in-time restore), broken migration (no tested rollback), object-storage loss (no backup). **RESTORE_PROVEN=NO is a release blocker.**

## 8. OWASP review

`OWASP_2025_REFERENCE: UNAVAILABLE` (no local 2025-nomenclature tooling; assessment uses the security skill's OWASP-10-aligned checklist + general categories; exact 2025 category names not claimed).

- **Access control**: FAIL — `/api/team` cross-tenant user enumeration (HIGH). Most objects correctly tenant-scoped.
- **Authentication**: GOOD — scrypt, opaque tokens, per-request revalidation, generic login errors (no enumeration), rate-limited login.
- **Cryptography/secrets**: GOOD — scrypt passwords, sha256 token hashes, no committed secrets.
- **Injection**: PASS (no SQL/command/template injection found).
- **Insecure design**: PARTIAL — single-node in-memory rate limits; no abuse-resilience plan.
- **Security configuration**: PARTIAL — helmet defaults; CORS restricted; no CSP tuning verified at runtime.
- **Vulnerable/outdated dependencies**: UNKNOWN — **no SCA in CI** (lockfiles present but unscanned).
- **Integrity/supply chain**: MISSING — no CI, no pinned Actions, no Dependabot.
- **Logging/monitoring**: FAIL for alerting — no alerting/metrics; unhandled exceptions not captured.
- **SSRF**: no external-URL fetch surfaced as a primary path (integrations are provider SDKs); not deeply exercised.

## 9. OWASP ASVS

`ASVS_TARGET: NOT DEFINED` → **recommend V2 target** for Looply V1 (single-tenant-per-company app with APIs, no financial/mass-PII). `ASVS_COVERAGE: PARTIAL` (architecture, auth, session, access-control-paths, validation, cryptography, error handling, files, API — largely evidenced; gaps in security-config evidence, logging/alerting, business-logic abuse, and the team BOLA). `ASVS_CRITICAL_GAPS`: cross-tenant authorization on `/api/team`; no ASVS audit checklist enforced; no evidence for level-2 controls like rate-limit coverage across all sensitive flows.

## 10. OWASP API Security Top 10

- **BOLA/object-level authorization**: FAIL — `/api/team` (HIGH). Other objects verified tenant-scoped.
- **Broken auth**: PASS (per-request validation).
- **Property-level / mass assignment**: PASS (zod allowlists; no `req.body` spread).
- **Resource consumption**: PARTIAL — rate limits on login/approval/invite only; pagination bounded on list endpoints; no global request limit.
- **Function-level authorization**: PARTIAL — `requireRole`/`requireCapability` used on some routes (workflow config, board), but coverage should be audited per sensitive operation.
- **Sensitive business-flow abuse**: PARTIAL — approval/transition guards present.
- **SSRF / unsafe consumption**: PARTIAL — integrations via SDKs; no broad external-URL ingestion.
- **Security misconfiguration**: PARTIAL — helmet defaults; no tailored CSP evidence.
- **API inventory/versioning**: N/A (single version, no versioned API surface documented).
- **Unsafe consumption of third-party APIs**: PARTIAL — provider responses validated defensively (webhooks).

## 11–12. Concrete vulnerability findings (deduplicated) + CWE/CVSS

| ID | Title | Surface | Severity | CWE | CVSS | Release blocker |
|----|-------|---------|----------|-----|------|-----------------|
| R2-01 | Cross-tenant user/PII enumeration via `/api/team` (`teamService.ts:3` + `routes/team.ts` + `Team.tsx:597`) | Team API/UI | **HIGH** | CWE-639/200 | NEEDS_TRIAGE (High, authenticated, PII) | **YES** |
| R2-02 | `/api/auth/password-reset` (token consumption) not rate-limited (`auth.ts:233`) | Auth | MEDIUM | CWE-307 | NEEDS_TRIAGE | No (256-bit single-use token mitigates) |
| R2-03 | In-process single-node rate limiters (`loginLimiter.ts:7`, `rateLimit.ts:6`) — cleared on restart, not multi-instance | Auth/API | MEDIUM (hardening) | CWE-770 | NEEDS_TRIAGE | No |
| R2-04 | `/api/media/file` `users/` prefix not tenant-scoped (`identityMediaService.ts:258`) | Media | LOW | CWE-639 | NEEDS_TRIAGE | No (avatars non-secret) |
| R2-05 | Cross-tenant `responsibleId` reference in createContent (`contentService.ts:41`) | Content | LOW | CWE-639 | NEEDS_TRIAGE | No (foreign ref only, no disclosure) |
| R2-06 | Non-idiomatic `getContent findUnique({id,companyId})` (`contentService.ts:88`) — **verified tenant-safe** (Prisma extended-where applies companyId) | Content | INFO | — | — | No |
| R2-07 | `mailService.ts:126` logs full upstream error body | Ops | INFO | CWE-532 | — | No |
| R2-08 | No `unhandledRejection`/`uncaughtException` handler; no alerting | Ops | INFO/LOW | — | — | No |

`CVSS`: where determinable, values are conservative; most require triage (NEEDS_TRIAGE) rather than invented precision.

**Separating vulnerability vs hardening vs ops:**
- Vulnerability: R2-01 (cross-tenant data leak).
- Hardening: R2-02, R2-03, R2-04, R2-05, R2-07.
- Operational gap: R2-08, no backups, no CI, no observability/alerting.

## 13–14. SAST / SCA / Secret scan / CI & supply chain

**No CI exists** (`.github/` absent; no other CI config). Therefore:
- **SAST**: none (no Semgrep/CodeQL config; not run in CI).
- **SCA**: none (package-lock.json present but no Dependabot/npm-audit gate in CI).
- **Secret scan**: none automated; manual audit found no committed secrets (`.env` git-ignored).
- **CI security gates**: none.
- **Supply chain**: no pinned Actions (none exist), no Dependabot, no artifact integrity verification, no branch-protection evidence. Lockfiles are committed (good reproducibility seed) but unenforced.

```
SAST: MISSING
SCA: MISSING
SECRET_SCAN: MISSING (manual only)
CI_SECURITY_GATES: MISSING
SUPPLY_CHAIN_STATUS: NOT_EVIDENCED (no CI to harden)
```

## 15. CIS Controls v8.1 / infrastructure

Host-level controls are **NOT_EVIDENCED** from the repo (no Docker/Compose/Nginx/SSH/firewall/TLS/service-user config tracked). Application-level positive evidence: secure config (helmet, secure cookies, CORS), access control (session + role/capability), account management (invites, password rules, session revocation), no injection, structured logging, tenant scoping (except R2-01). Gaps: no vulnerability management (no SCA), no backup, no audit-log/alerting, no incident-response runbook, no network-exposure/config for the host, no patch/update process.

`HOST_HARDENING_EVIDENCE: NOT_EVIDENCED` (repo cannot prove live host state).

## 16. Security gates

```
SECURITY_GATE_DEFINED: NO (no written release gate in repo)
SECURITY_GATE_ENFORCED: NO (no CI to enforce)
CURRENT_CRITICAL: 0
CURRENT_HIGH: 1  (R2-01 cross-tenant)
CURRENT_MEDIUM: 2 (+ hardening R2-04/05/07 as LOW, R2-08 INFO/LOW)
CURRENT_LOW: 3
RELEASE_SECURITY_GATE: FAIL
```

**Mandatory gate FAIL reasons:** (1) HIGH cross-tenant PII disclosure (R2-01) → Critical/High must be 0; (2) tenant isolation demonstrably broken; (3) restore not proven; (4) no production error visibility/alerting; (5) no CI security gates.

## 17. Pentest readiness

```
PENTEST_READY: NO (not yet — release blockers exist that would invalidate a meaningful pentest)
PENTEST_PREREQUISITES: fix R2-01, add CI security gates + SCA, define/restore-prove backups, add observability/alerting, document scope
PENTEST_SCOPE (recommended): authenticated web app; unauthenticated endpoints; APIs; multi-tenant authorization; public approval flow; file access; account/invite/reset; role boundaries; integrations/webhooks; rate limits; injection/XSS/SSRF; business-logic abuse
PENTEST_BLOCKERS: confirmed cross-tenant leak; no staging/env parity; no CI; no restore drill
```

Exclusions for any future pentest: destructive production testing, DoS, real third-party abuse, sending real messages, destructive DB/file ops.

## 18. Release blockers (deduplicated)

| ID | Category | Severity | Reason | Evidence | Next battery |
|----|----------|----------|--------|----------|--------------|
| B1 | Tenant isolation | HIGH | `/api/team` leaks every user (id/name/email/role) to any authenticated member | teamService.ts:3, routes/team.ts, Team.tsx:597 | R2.3 |
| B2 | Backup/DR | Blocking | No backup, restore never proven, no off-host/encryption, RPO/RTO undefined | repo has no backup/restore artifacts | R2.1 |
| B3 | Observability/alerting | Blocking | No metrics/alerting; unhandled exceptions uncaptured; production failures undetectable | app.ts, server.ts, no monitoring config | R2.2 |
| B4 | CI/security gates | Blocking | No CI, no SAST/SCA/secret scan, no release gate enforcement | no .github | R2.4 |
| B5 | Host hardening | High (ops) | No infra config/backup/service hardening evidenced; not release-blocking alone but required for production | repo lacks infra artifacts | R2.5 |

Non-blocking deferred: R2-02 (reset rate limit), R2-03 (in-memory limiters), R2-04/05 (media/responsible LOW), R2-06/07/08 (INFO), CSP tuning, version-traceable release id.

## 19. Deferred / non-blocking items

- Password-reset-with-token rate limit (defense-in-depth).
- Multi-instance rate limiting (requires Redis-backed limiter if scaling).
- Media `users/` prefix tenant-scope hardening.
- CSP/security-header tailoring at runtime.
- Release-version endpoint + post-deploy smoke test.
- Runtime-exception capture + security-audit log.
- Pentest (after blockers cleared).

## 20. Recommended implementation batteries

- **R2.1 — Backup / Restore / DR**: PostgreSQL + object-storage backup (schedule, retention, off-host, encryption), tested restore drill, define RPO/RTO, document RTO.
- **R2.2 — Observability / Error Monitoring**: capture unhandled rejections/exceptions, add tenant/request context to logs, define alerting (health/readiness + error threshold), optional lightweight exception monitor; add release-version + post-deploy verify.
- **R2.3 — Application Security Remediation**: fix `/api/team` tenant scoping (R2-01) — scope to active membership, keep member roles tenant-scoped; add password-reset rate limit; harden media `users/` prefix; change `getContent` to `findFirst`.
- **R2.4 — CI Security Gates / Supply Chain**: introduce minimal CI (GitHub Actions or equivalent) with typecheck/test/build, SCA (`npm audit`/lockfile), secret scan, SAST (Semgrep/CodeQL), and a release gate enforcing 0 Critical/0 High.
- **R2.5 — Infrastructure Hardening**: containerize or document host config (TLS, service user, firewall, resource limits), Dependabot/renovate, secure env provisioning.
- **R2.6 — Security Validation / Release Gate**: after R2.1–R2.5, run authorized pentest on a staging env, execute restore drill, sign off the release gate.

Not all are mandatory in this exact order; sequence by dependency: R2.3 (fix the confirmed leak) and R2.1 (restore) are the two hard blockers; R2.4 (CI) and R2.2 (observability) enable a safe gate.

## 21. Tools / skills actually used

- Skills loaded: `caveman`, `security-audit`, `kore-validate`.
- Deployed a read-only `general` subagent for the deep backend security code review (routes/services/middleware) — verified its two HIGH findings against source before classifying.
- Inspected via Read/Grep: app.ts, server.ts, middleware (requireAuth/csrf/requestId/requestLogger), lib (logger/env/password/session/token/rateLimit/loginLimiter/errors/storage), auth/recovery services, team/teamService, contentService, identityMediaService, health, routes, Prisma schema + generated types, ecosystem.config.cjs, package.json/.gitignore/.env.example.
- No secrets read or printed; no source modified; no heavy scans run (no CI/security scanners exist to run).

## Git state

```
HEAD:               b8cd50b909cbd86d77294bdf77a98f395f9ae0c5 (unchanged)
WORKTREE:           clean (no source modified; report added)
Staged/Committed:   none
KORE_TOUCHED:       NO
```

---

**RESULT — R2_STATUS: AUDIT_COMPLETE**
**RELEASE_READINESS: NOT_RELEASE_READY** (restore not proven + HIGH cross-tenant leak + no CI/observability)
**SECURITY_READINESS: NOT_SECURITY_READY** (1 HIGH confirmed + gate not enforced)
**RELEASE_SECURITY_GATE: FAIL**
