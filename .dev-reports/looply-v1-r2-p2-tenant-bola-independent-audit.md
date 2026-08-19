# Looply — V1-R2.P2 Tenant BOLA Independent Audit

Date: 2026-08-19 · Branch: `main` @ `b7f9d76` · Audit only — no source modified, no commit, no push, no stage. `KORE_TOUCHED: NO`.

Purpose: independently audit the R2.P2 tenant/BOLA sweep classification, confirm the highest-risk
tenant boundaries are safe, and confirm the sweep is sound. Ignore unrelated untracked M1/M2 reports.

## Baseline

- HEAD `b7f9d76fe6559753b195c37e226024bb336d1ed9` (unchanged, == origin/main).
- No source modifications (R2.P2 was a sweep-only). `git diff --check`: PASS (exit 0).

## Tenant authority: CONFIRMED

- Canonical authority is `req.auth.companyId`, set by `requireAuth` from the authenticated session
  via `resolveAuth` (`AuthContext { userId, companyId, role }`). `resolveAuth` derives companyId
  from the validated session → user → active CompanyMember (`userId_companyId` unique) → active
  company. It is revalidated on every request.
- **No client-supplied company identifier** (body/query/header) can override `req.auth.companyId` in
  any inspected path. `switchCompany` operates through the same validated membership.
- `TENANT_AUTHORITY: AUTHENTICATED_COMPANY_ID`.

## Direct ID access (independently re-verified): SAFE

Scanned all `findUnique/findFirst/update/delete/updateMany/deleteMany({ where: { id ... } })` across
services/routes. Every tenant-owned-object access is either:
- scoped in the same query: `findFirst({ where: { id, companyId } })`,
  `updateMany({ where: { id, companyId } })`, `deleteMany({ where: { id, companyId } })` — Client,
  Job, Appointment, CompanyMember, Invitation (list/revoke), Approval, JobAttachment, Activity (via
  job check); or
- tenant-validated by context:
  - `authService` session/user/company lookups — derived from hashed session token + membership
    (not client input).
  - `memberService:197` invitation `update({ id })` — the invitation was resolved by `tokenHash`
    (single-use 256-bit token); no client-supplied id.
  - `workflowService:252` stage lookup — scoped by tenant-owned `workflowId` (workflow verified
    against companyId first).
  - `identityMediaService` self lookups — `userId = auth.userId`, `companyId = auth.companyId`.
  - `attachmentReconciliationService` — internal maintenance script, not a route.

`DIRECT_ID_ACCESS_SAFE: YES`.

## Foreign-key injection (independently re-verified): SAFE

- `clientId` (job/content/appointment/client-logo): validated via `findFirst({ id, companyId })`
  before association.
- `jobId/contentId` (approvals/attachments/activities): job must belong to companyId.
- `versionId` / `attachmentIds` (approval): scoped to companyId + validated jobId.
- `workflowStageId` (transition): `assertStageInWorkflow` requires the stage's workflow to belong to
  companyId.
- `userId` (whatsapp identity): active membership in companyId required
  (`whatsappActorService.provisionWhatsAppIdentity`).
- `memberId` (member update/reset): membership in companyId required.
- `responsibleId` (content): active membership in companyId (R2.3B).
- `parentId` (group): `groupContent` validates BOTH child and parent via `loadOr404({ id, companyId })`
  before setting `parentId` (verified).
- Invitation accept: membership bound to `invitation.companyId` (token-derived), never client input.

`FOREIGN_KEY_VALIDATION_SAFE: YES`.

## Read / update / delete isolation: BLOCKED (confirmed)

Representative tenant-owned resources: Tenant A object + Tenant B request →
- Client: detail/patch/delete → 404 (`clientsTenantHttp.test.ts`).
- Job: read/activity/transition → 404 (`jobsWorkflow.test.ts`).
- Appointment: read → 404 (`appointmentsRoute.test.ts`).
- Attachment: list/download/delete → 404 (`attachments.test.ts`).
- Approval: revoke/read → 404 (`approval.test.ts`).
- Media: read → 403 (`identityMedia.test.ts`).

`TENANT_A_READ_BY_B: BLOCKED` · `TENANT_A_UPDATE_BY_B: BLOCKED` · `TENANT_A_DELETE_BY_B: BLOCKED` ·
`CROSS_TENANT_REFERENCE_PROOF: PASS`.

## Suspicious-path classification (independently reviewed)

All 14 paths in the R2.P2 report were re-checked: 10 SAFE, 4 FALSE_POSITIVE
(self-user lookups, tenant-owned workflow stage, onboarding self-lookup, internal maintenance script).
No path is actually vulnerable. `SUSPICIOUS_PATHS_REVIEWED: 14` · `SAFE_PATHS: 10` ·
`FALSE_POSITIVES: 4` · `CONFIRMED_BOLA: 0` · `CROSS_TENANT_REFERENCE_FINDINGS: 0`.

## Existing tenant-test coverage: MEANINGFUL

The suite contains genuine two-company cross-tenant assertions (not superficial): client detail/patch/
delete → 404, job create/read/activity/transition → 404, appointment read → 404, attachment
list/download/delete → 404, approval revoke → 404, media member/company → 403. These exercise
Tenant-A-owns / Tenant-B-attempts for read, update, delete, and reference across representative
resources. `EXISTING_TENANT_TEST_COVERAGE: GOOD`.

## Validation

- `git diff --check`: PASS (exit 0).
- HEAD unchanged (`b7f9d76`); no source modifications (verified via `git status`).
- No code changed → reuse existing evidence: backend **477/477 PASS**, backend typecheck PASS,
  backend build PASS (from R2.4A, unchanged code).

## Findings

- **CRITICAL: 0** · **HIGH: 0** · **MEDIUM: 0** · **LOW: 0**.
- No confirmed BOLA or cross-tenant reference defect. No REMEDIATION required.

## Result

```
RESULT: PASS
TENANT_AUTHORITY: AUTHENTICATED_COMPANY_ID
SUSPICIOUS_PATHS_REVIEWED: 14
SAFE_PATHS: 10
FALSE_POSITIVES: 4
CONFIRMED_BOLA: 0
CROSS_TENANT_REFERENCE_FINDINGS: 0
DIRECT_ID_ACCESS_SAFE: YES
FOREIGN_KEY_VALIDATION_SAFE: YES
TENANT_A_READ_BY_B: BLOCKED
TENANT_A_UPDATE_BY_B: BLOCKED
TENANT_A_DELETE_BY_B: BLOCKED
CROSS_TENANT_REFERENCE_PROOF: PASS
EXISTING_TENANT_TEST_COVERAGE: GOOD
CRITICAL_FINDINGS: 0
HIGH_FINDINGS: 0
MEDIUM_FINDINGS: 0
LOW_FINDINGS: 0
APPLICATION_SECURITY_STATUS: PASS
R2_P2_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
BACKEND_TESTS: 477/477_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS
REPORT: .dev-reports/looply-v1-r2-p2-tenant-bola-independent-audit.md
GIT_STATE: HEAD b7f9d76 unchanged; no source changes; nothing staged/committed
KORE_TOUCHED: NO
```

## Git state

```
HEAD:          b7f9d76fe6559753b195c37e226024bb336d1ed9 (unchanged, == origin/main)
Changed:       none
Untracked:     this report + R2.P2 report + prior M1/M2 reports (ignored/untouched)
KORE_TOUCHED:  NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- Read: R2.P2 report, requireAuth, authService, clientService, contentService (groupContent),
  jobService, appointmentService, workflowService, memberService, approvalService, attachmentService,
  activityService, whatsappActorService, identityMediaService, calendarService, and existing
  tenant/security tests (clientsTenantHttp, jobsWorkflow, appointmentsRoute, attachments, approval,
  identityMedia, hardening).
- Ran: independent greps for unscoped id access and foreign-key patterns; verified each candidate
  against its service context; `git status` / `git diff --check`.
- No secrets printed; no tenant PII printed; no source modified.

---

LOOPLY V1-R2.P2 TENANT BOLA INDEPENDENT AUDIT — PASS