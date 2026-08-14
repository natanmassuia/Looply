# Looply V1 — B12 Hardening + Module Boundaries

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `1bc1a28`
- **B11 ancestry:** confirmada (`1bc1a28 feat(v1): add tenant safe dashboard projections`).
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend; não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B12 possuía diff preexistente.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `performance-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Consolidated Debt Inventory

| Finding | Source | Severity | Current status | B12 action |
|---|---|---:|---|---|
| CSRF em cookie mutations | B2/B4/B9 | Medium | Open | Origin/Referer guard + tests |
| Login limiter response | B2 | Low | 400 | Common 429 contract |
| Public Approval rate limit | B9 | Low | Open | 20 write / 60 read per 15m |
| Invitation accept rate limit | B4 | Low | Open | 20 per 15m |
| Approval token logs | B9 | Medium | App fixed | Proxy contract documented |
| Storage provider missing | B8/B9 | Operational | No credentials | 503 fail-closed + readiness prerequisite |
| PENDING uploads | B8 | Low | Open | Reconciliation CLI marks stale rows FAILED |
| Object/metadata reconciliation | B8 | Low | Open | Bounded reconciliation CLI |
| Board windowing | B7 | Low | Cap/projection | Reviewed; deferred until measured |
| Calendar windowing | B10 | Low | 90d/500 cap | Reviewed; retained |
| Approval/file list pagination | B8/B9 | Low | No cursor | Caps 100 added |
| Dashboard global aggregates | B5/B6 | High | Fixed B11 | Re-audited tenant scope |
| Legacy bridges | B5/B6/B9 | Medium | Active | Scoped, deprecated, removal triggers documented |
| Runtime dependency vulnerabilities | B8/B11 | High if runtime | Backend runtime clean | `audit --omit=dev` PASS |
| Dev dependency vulnerabilities | B8/B11 | Dev-only | Open | Documented; no forced major upgrade |
| Frontend React Router advisories | B11 | Runtime frontend | Open | Deferred to Figma/frontend compatibility work |
| Trust proxy ambiguity | B2 | Low | Implicit | Explicit `TRUST_PROXY=false` default |
| Storage smoke | B8 | Operational | Not available | Formal prerequisite, no false PASS |

## Fixed Findings

- Origin/Referer CSRF guard for unsafe cookie mutations.
- CORS exact origin with credentials and wildcard rejection.
- Rate limits for Approval public reads/writes and invitation accept.
- Rate-limit errors now return 429/Retry-After.
- Explicit Express trust proxy setting.
- Public Approval token path redaction.
- Pending attachment cleanup/reconciliation CLI.
- Approval/attachment list caps of 100.
- Dashboard global aggregate removal was verified.

## Accepted Findings

- In-memory rate limiting is single-node and resets on restart.
- Frontend React Router moderate advisories require a separate compatibility upgrade.
- Backend dev-tool vulnerabilities remain outside production runtime.
- Board/calendar/approval/attachment use bounded caps rather than cursor pagination.

## Deferred Findings

- Distributed Redis rate limiting.
- Nginx changes/deployment.
- Real storage smoke because no bucket/credentials are configured.
- Backup/restore operational procedure.
- Frontend/Figma dependency upgrades.

## CSRF

Implemented `csrfOriginGuard`:

- unsafe methods require matching Origin or Referer;
- no Origin/Referer remains compatible with CLI/curl;
- foreign origin → 403;
- public Approval token routes bypass cookie CSRF because token is their credential.

Tests cover foreign origin, same origin and public token behavior.

## CORS

Express uses exact `env.CORS_ORIGIN` with `credentials: true`. `CORS_ORIGIN=*` is rejected by env validation. No reflected arbitrary origin exists.

## Rate Limiting

- Login: existing in-memory limiter, now 429.
- Approval writes: 20/15 minutes per IP+hashed token key.
- Approval reads: 60/15 minutes per IP+hashed token key.
- Invitation accept: 20/15 minutes per IP+hashed token key.
- `Retry-After` included.
- No plaintext token in limiter key/log.

## Proxy / Client IP Trust

`TRUST_PROXY=false` by default. Production must explicitly set true behind one trusted reverse proxy. No arbitrary forwarded IP trust.

## Session / Cookie Review

Existing B2 controls remain: HttpOnly, Secure production, SameSite=Lax, 7-day expiry, logout revocation, password-change rotation, membership/user/company revalidation.

## Public Route Inventory

| Route | Model |
|---|---|
| `/health` | process liveness |
| `/health/ready` | DB readiness |
| `/api/auth/login` | credential + CSRF + limiter |
| `/api/auth/logout` | session + CSRF |
| `/api/auth/change-password` | session + CSRF |
| `/api/onboarding/*` | session/onboarding |
| `/api/invitations/accept` | invitation token + CSRF + limiter |
| `/api/public/approvals/*` | approval token + public limiter |
| other `/api/*` | session + workspace + capability |

Public Approval is intentionally mounted before the session auth wall.

## Public Approval Security

38 plaintext Approval tokens were migrated to SHA-256 hashes and removed from DB. Expiry, revocation, immutable Decision history, conditional decision writes and token log redaction are active.

## Token Logging

`requestLogger` redacts `/api/public/approvals/<token>` as `[redacted]`. Deployment contract requires Nginx/upstream access logs to avoid plaintext token retention. Nginx was not modified.

## Tenant Audit

Reviewed Client, Job, Workflow, Stage, Activity, Attachment, Approval, Decision, Invitation, Member and Dashboard callers. Canonical domain queries use Company scope. Public token chains resolve through Approval/Job/Attachment.

## Capability Audit

- Clients: CLIENTS.
- Jobs: JOBS.
- Workflow/transition: WORKFLOW.
- Board: JOBS + WORKFLOW + KANBAN.
- Files: FILES.
- Approval internal: APPROVAL.
- Calendar: CALENDAR.
- Dashboard: DASHBOARD.
- Activity history: ACTIVITY.

No route trusts capabilities from the frontend.

## IDOR Audit

Reviewed all `:id`, `:jobId`, `:clientId`, `:fileId`, `:approvalId`, `:workflowId`, `:token` routes. Tenant-owned lookups use Company. Public Approval uses hash/token chain. Cross-tenant behavior is 404.

## Storage Review

Private S3-compatible storage, server-generated key, presigned PUT/GET, 50 MB limit, finalize HEAD verification, no local disk/base64/public bucket. Storage absent returns 503 fail-closed.

## Pending Upload Strategy

`attachments:reconcile` marks PENDING rows older than 24 hours as FAILED. No scheduler or worker was created.

## Reconciliation Strategy

The same command scans up to 500 AVAILABLE metadata rows, HEADs the object and marks missing objects FAILED. It requires configured storage and fails closed otherwise.

## Storage Smoke

**Not executed:** no storage provider/bucket credentials exist in this environment. This remains an operational prerequisite, not a fabricated PASS.

## Legacy Bridge Inventory

- `/api/contents`: logical Job bridge; tenant/capability scoped.
- `/api/publications`: legacy publication projection; tenant/capability scoped.
- Dashboard legacy fields: retained for current shell, now tenant-safe.
- Job mediaUrl/mediaType: retained until frontend/attachment migration.

## Legacy Bridge Decisions

Bridges remain because current frontend still references them. No new feature was added to them. Removal trigger is Figma frontend migration to canonical APIs.

## Module Boundary Audit

- Auth/Tenant → capabilities → domain services.
- Dashboard reads domains; domains do not read Dashboard.
- Calendar reads Job dates; Job does not depend on Calendar.
- Approval may authorize Attachment; Files does not depend on Approval.
- Storage is infrastructure-only.
- No Dashboard persistence or analytics state.

## Import / Coupling Review

No new cyclic dependency requiring a container. Reconciliation is an operational service/CLI. Storage has no domain imports. Public Approval reuses storage service rather than duplicating S3 logic.

## Environment Validation

`validateEnv` checks DATABASE_URL, PORT, wildcard CORS and storage TTL. Storage credentials remain feature-specific; absence does not break health but causes file operations to return 503.

## Health / Readiness

- `/health`: process-only.
- `/health/ready`: DB dependency.
- Storage readiness is a separate deployment gate; no storage HEAD per health request.

## Logging / PII Review

Structured logger redacts passwords, tokens, cookies, authorization, secrets and API keys. Approval public path redaction was added. No request bodies or signed URLs are logged by B12 code.

## Dependency Audit

- Backend runtime: `npm audit --omit=dev` → 0 vulnerabilities.
- Full backend audit: 1 critical Vitest dev-tool advisory, plus Vite/esbuild/vite-node transitive dev findings. No forced major upgrade applied; Vitest UI is not production runtime.
- Frontend runtime: 2 moderate React Router advisories. Frontend is explicit zero-change scope; upgrade deferred to compatibility/Figma work.
- No `npm audit fix --force`.

## Migration Audit

- `prisma migrate status`: up to date.
- `prisma validate`: PASS.
- Schema diff: empty.
- No B12 migration.

## DB Invariant Checks

Read-only checks confirmed:

- Client.companyId NOT NULL;
- Job.companyId NOT NULL;
- Approval.companyId NOT NULL;
- JobAttachment.companyId NOT NULL;
- tokenHash unique;
- storageKey unique;
- no orphan Approval company links;
- no orphan Job company links.

## Query Limits

- Jobs list: 100.
- Board: bounded projection/current cap.
- Calendar: 90 days/500 events.
- Dashboard recent/attention/activity: 10.
- Approval decisions/files: 100.
- Attachments: 100 per Job.
- Upload: 50 MB.
- Presigned URL: 60–900 seconds.
- Reconciliation: 500 objects per run.

## Security Audit

`.dev-reports/security-audit-b12-2026-08-14.md`:

- Critical: 0.
- High: 0.
- Medium: 0.
- Low: 2 accepted/documented.

## Performance Audit

`.dev-reports/performance-audit-b12-2026-08-14.md`:

- No new N+1.
- Bounded reads preserved.
- Reconciliation bounded.
- Storage calls only on explicit operations.

## Full Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (141/141, 20 files) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `npm --prefix backend audit --omit=dev` | 0 | PASS (0 runtime vulnerabilities) |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Integrated Smoke Test

Existing B1–B11 targeted integration suites remained green. B12-specific smoke:

- foreign Origin mutation → 403;
- same Origin mutation reaches auth validation;
- public Approval token path bypasses cookie CSRF and redacts token log;
- Approval/Invitation limits → 429 after threshold;
- tenant/capability/dashboard/calendar/approval/storage fake flows remain green;
- reconciliation fake flow marks stale/missing metadata.

Full production smoke was not executed because storage/Nginx/HTTPS credentials are absent.

## Code Review

1. CSRF is origin-based and does not affect public token auth.
2. Rate limiter keys hash token material and returns standard 429.
3. Trust proxy is explicit, not implicit.
4. No global Dashboard aggregates remain.
5. Reconciliation is bounded and command-only.
6. No frontend feature, new domain, cache, queue, Redis or deployment was added.
7. Full dependency audit findings were classified by runtime/dev scope; no force upgrade was run.

## Changed Files

- `backend/src/middleware/csrf.ts`
- `backend/src/lib/rateLimit.ts`
- `backend/src/lib/errors.ts`
- `backend/src/lib/env.ts`
- `backend/src/app.ts`
- `backend/src/routes/approvals.ts`
- `backend/src/routes/invitations.ts`
- `backend/src/routes/auth.ts`
- `backend/src/services/memberService.ts`
- `backend/src/services/approvalService.ts`
- `backend/src/services/attachmentService.ts`
- `backend/src/services/attachmentReconciliationService.ts`
- `backend/src/scripts/reconcileAttachments.ts`
- `backend/tests/hardening.test.ts`
- `backend/tests/reconciliation.test.ts`
- `backend/package.json`
- `docs/engineering/13-hardening-production-readiness.md`
- `.dev-reports/looply-b12-hardening-production-readiness.md`
- `.dev-reports/security-audit-b12-2026-08-14.md`
- `.dev-reports/performance-audit-b12-2026-08-14.md`

**Frontend: zero changes.**

## Preexisting Dirty Files

Todos os frontend/reports preexistentes permaneceram fora do stage e não foram revertidos.

## Remaining Operational Prerequisites

- HTTPS reverse proxy.
- Exact production CORS origin.
- `TRUST_PROXY` conforme topologia.
- Private storage bucket/credentials.
- Real storage PUT/HEAD/GET/DELETE smoke.
- Backup/restore procedure.
- Nginx access log policy preventing plaintext Approval tokens.
- Figma frontend integration and compatible frontend dependency upgrade.

## Accepted Risks

- In-memory limits são single-node.
- Dev-only vulnerabilities permanecem enquanto upgrade major não for aprovado.
- Frontend React Router moderate advisory permanece fora do escopo frontend zero-change.
- Cleanup/reconciliation é command-only.
- Bounded caps não são cursor pagination.

## Final Production Readiness

**READY WITH OPERATIONAL PREREQUISITES**

Código, testes, schema, segurança e boundaries estão verdes para staging. Produção ainda exige HTTPS/proxy, storage privado configurado e smoke real, backup/restore e integração frontend/Figma.

## Suggested Commit

`chore(v1): harden module boundaries and readiness`

## Next Step

Frontend/Figma integration + staging readiness/deploy preparation.
