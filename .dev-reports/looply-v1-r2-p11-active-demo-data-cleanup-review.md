# R2.P11 — Active Demo Data Cleanup Review

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

Read-only review. **Nothing deleted, updated, or modified.** DB/storage/source untouched.

## Demo tenant identity

- DEMO_COMPANY: **Loyal Tech**
- DEMO_COMPANY_ID: `cmsszpame000014etfdtm1ezx`
- DEMO_COMPANY_SLUG: `looply-studio` (seed origin)
- DEMO_COMPANY_ACTIVE: true

## Row inventory (read-only counts)

| Model | Count | Notes |
|---|---|---|
| CompanyMember (members) | 5 | demo users' memberships |
| User (demo users) | 5 | natan@, lucas@, marina@, joao@, ana@ |
| Shared users (multi-company) | **0** | none of the 5 demo users belong to another company |
| Client | 6 | Clínica Vitta, Studio Norte, Bistrô Onze, Academia Move, Restaurante Aurora, Restaurante do Gordão |
| Job (Content) | 187 | |
| JobVersion | 189 | children of Content |
| Appointment | 638 | |
| Invitation | 0 | |
| WorkflowDefinition | 1 | |
| WorkflowStage | 7 | children of the workflow |
| Activity | 1338 | |
| Approval | 110 | + ApprovalDecision/ApprovalAttachment children |
| JobAttachment | 0 | |
| WhatsAppIdentity | 0 | |
| Session (demo users) | 4431 | FK on user → **must precede user deletion** |
| PasswordResetToken (demo users) | 2 | cascade with user |

## FK / cascade analysis (from schema.prisma)

- All tenant-owned models reference `Company` with **`onDelete: Restrict`**: Client, Job, JobAttachment, Approval, Appointment, WorkflowDefinition, CompanyMember, Activity (tenant-scoped), Invitation (default Restrict).
- `WorkflowStage.workflow` → Cascade; `ApprovalDecision/ApprovalAttachment` → Cascade from Approval; `JobVersion/Activity/JobAttachment/Approval` → Cascade from Job; `PasswordResetToken.user` → Cascade.
- `Session.user` → **no Cascade (default Restrict)** → sessions must be deleted **before** the demo users.
- **COMPANY_DELETE_CASCADE_SAFE: NO** — deleting the Company would be blocked by the many Restrict FKs.
- **MANUAL_DELETE_ORDER_REQUIRED: YES** — tenant-scoped child-first deletion is required.

## Storage

- DEMO_ATTACHMENT_STORAGE_KEYS: 0
- Storage-backed media URLs: 0 (all 189 content-media URLs are external picsum links)
- **STORAGE_OBJECTS: NONE** for the demo tenant → **STORAGE_DELETE_CLASSIFICATION: NONE** (no storage deletion needed; no shared bucket objects).

## Proposed deletion order (for a later explicit cleanup task — NOT executed here)

Tenant-scoped, children before parents (companyId = `cmsszpame000014etfdtm1ezx`; demoUserIds = the 5 demo users):

1. `Approval.deleteMany({ companyId })` — cascades ApprovalDecision + ApprovalAttachment
2. `Activity.deleteMany({ companyId })`
3. `JobAttachment.deleteMany({ companyId })` (0 rows)
4. `Job.deleteMany({ companyId })` — cascades JobVersion, activities, approvals, attachments, JobGroup children
5. `Appointment.deleteMany({ companyId })`
6. `WorkflowDefinition.deleteMany({ companyId })` — cascades WorkflowStage
7. `Client.deleteMany({ companyId })`
8. `Invitation.deleteMany({ companyId })` (0 rows)
9. `WhatsAppIdentity.deleteMany({ companyId })` (0 rows)
10. `Session.deleteMany({ userId: { in: demoUserIds } })` — **must precede user delete (Restrict FK)**
11. `CompanyMember.deleteMany({ companyId })`
12. `User.deleteMany({ id: { in: demoUserIds } })` — now safe (no shared users, sessions removed, password-reset tokens cascade)
13. `Company.deleteMany({ id })` — last; no Restrict references remain

## Shared resources / do-not-delete

- SHARED_RESOURCES_FOUND: NO — no demo user belongs to another company; no shared storage objects.
- DO_NOT_DELETE: any user that is a member of a non-demo company (none found for these 5); shared storage objects (none); the active/production tenant (not in scope).

## Backup & rollback

- **BACKUP_REQUIRED: YES** — a current backup must be taken immediately before the destructive cleanup task (repo has backup tooling per R2.1D).
- ROLLBACK_PLAN: restore from the pre-delete backup if the cleanup is wrong/partial. Do not run the cleanup without a verified, recent backup.

## Classification summary

- SAFE_TO_DELETE_WITH_DEMO_TENANT: all listed demo-tenant rows + the 5 demo users (no shared membership).
- REQUIRES_PRE_DELETE_HANDLING: Session rows (delete before users).
- SHARED_RESOURCE_DO_NOT_DELETE: none found.
- UNKNOWN: none.

## Scope to delete (exact)

Everything owned by company `cmsszpame000014etfdtm1ezx` + the 5 demo users' non-company-owned child rows (sessions, password-reset tokens). Nothing else.

## Validation

- ACTIVE_DB_MODIFIED: NO
- ACTIVE_STORAGE_MODIFIED: NO
- BACKEND_TESTS / typecheck / build / DIFF_CHECK: unchanged (no code change; git diff --check PASS)

## Result

RESULT: PASS
DEMO_COMPANY: Loyal Tech
DEMO_COMPANY_ID: cmsszpame000014etfdtm1ezx

DEMO_MEMBERS: 5
DEMO_USERS: 5
SHARED_USERS: 0
DEMO_CLIENTS: 6
DEMO_CONTENTS: 187
DEMO_APPOINTMENTS: 638
DEMO_MEDIA: 0 (no storage objects; 189 external picsum media)
DEMO_INVITATIONS: 0
DEMO_WORKFLOWS: 1
DEMO_ACTIVITIES: 1338
OTHER_TENANT_ROWS: 110 approvals, 189 content versions, 4431 sessions, 2 password-reset tokens, 7 workflow stages, 0 attachments, 0 whatsapp identities

COMPANY_DELETE_CASCADE_SAFE: NO
MANUAL_DELETE_ORDER_REQUIRED: YES

SHARED_RESOURCES_FOUND: NO
STORAGE_OBJECTS: NONE
STORAGE_DELETE_CLASSIFICATION: NONE

BACKUP_REQUIRED: YES
ROLLBACK_PLAN: restore from immediate pre-delete backup

ACTIVE_DB_MODIFIED: NO
ACTIVE_STORAGE_MODIFIED: NO

SAFE_TO_DELETE: demo tenant rows + 5 demo users (no shared membership)
REQUIRES_PRE_DELETE_HANDLING: sessions (before users)
DO_NOT_DELETE: non-demo tenants, shared storage (none)

R2_P11_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_DESTRUCTIVE_CLEANUP_APPROVAL
REPORT: .dev-reports/looply-v1-r2-p11-active-demo-data-cleanup-review.md
GIT_STATE: no source/DB/storage changes; reports (M1/M2/P9/P9-rerun/P10 + this) untracked; HEAD ffe3f82
KORE_TOUCHED: NO

LOOPLY R2.P11 ACTIVE DEMO DATA CLEANUP REVIEW — COMPLETE