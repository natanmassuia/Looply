# R2.P12 — Active Demo Tenant Cleanup (Destructive)

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

## Explicit user approval

User explicitly approved permanent deletion of the active demo tenant **Loyal Tech** (company id `cmsszpame000014etfdtm1ezx`) and all records exclusively belonging to it.

## Active DB identity

- `DATABASE_URL` host: `127.0.0.1:5432` — the active Looply DB (intended target, confirmed before any delete).

## Pre-delete inventory (re-query, read-only)

Confirmed exact match to R2.P11 (no drift):
- Company: 1 (Loyal Tech, slug `looply-studio`, ACTIVE)
- Members: 5 · Shared users outside demo: **0**
- Clients: 6 · Contents: 187 · Appointments: 638 · Activities: 1338 · Approvals: 110 · ContentVersions: 189
- Sessions: 4431 · PasswordResetTokens: 2 · Workflows: 1 · WorkflowStages: 7
- Invitations: 0 · Attachments: 0 · WhatsApp identities: 0 · Storage keys (job attachments): 0

**PREDELETE_INVENTORY_MATCH: YES · SHARED_USERS_CONFIRMED_ZERO: YES**

## Backup gate

- Created immediate pre-delete backup using verified R2.1 tooling (`ops/backup/backup.sh`).
- **BACKUP_PATH: `/opt/looply/.backups/20260819T180531Z`** (PostgreSQL dump + 4 object-storage objects + manifest).
- **BACKUP_VERIFIED: YES** — `ops/backup/verify.sh`: `postgres.dump` checksum OK, `manifest.json` OK, all 4 object checksums OK.
- Restore capability already proven by R2.1D.

## Destructive execution

Ran a single Prisma `$transaction` (atomic, all-or-nothing), tenant-scoped to `cmsszpame000014etfdtm1ezx`, child-first. No TRUNCATE, no CASCADE/disable-FK, no schema change, no `db push`, no `migrate reset`.

Deletion sequence and rows deleted by model:
| Model | Rows deleted |
|---|---|
| Approval (cascades decisions/attachments) | 110 |
| Activity | 1338 |
| JobAttachment | 0 |
| Job/Content (cascades versions/activities/approvals/attachments) | 187 |
| Appointment | 638 |
| WorkflowDefinition (cascades WorkflowStage) | 1 |
| Client | 6 |
| Invitation | 0 |
| WhatsAppIdentity | 0 |
| Session (demo users, before users) | 4431 |
| PasswordResetToken (demo users) | 2 |
| CompanyMember | 5 |
| User (5 exclusive demo users, after proving zero other memberships) | 5 |
| Company | 1 |

**TRANSACTIONAL_CLEANUP: PASS** (committed; no FK error; no broad/unscoped deleteMany).

## Post-delete proofs (all zero)

- COMPANY_REMAINING: 0
- MEMBERS_REMAINING: 0
- DEMO_USERS_REMAINING: 0
- CLIENTS_REMAINING: 0
- CONTENTS_REMAINING: 0
- APPOINTMENTS_REMAINING: 0
- ACTIVITIES_REMAINING: 0
- APPROVALS_REMAINING: 0
- CONTENT_VERSIONS_REMAINING: 0
- SESSIONS_REMAINING (for deleted users): 0
- RESET_TOKENS_REMAINING (for deleted users): 0
- WORKFLOWS_REMAINING: 0
- WORKFLOW_STAGES_REMAINING: 0

## Non-demo preservation proof

- NON_DEMO_COMPANIES_PRESERVED: YES — 4 companies remain (Teste Corp LTDA + 3 LegacyCo), each with members intact; row counts not unexpectedly reduced.
- NON_DEMO_DATA_INTEGRITY: PASS — Teste Corp LTDA retains 1 client / 2 members; LegacyCos retain members.
- NON_DEMO_AUTH_READABLE: PASS — `dono@testecorp.com` (active, OWNER of Teste Corp LTDA) logs in via the active backend (HTTP 200). (An initial 403 was the CSRF origin guard correctly rejecting a wrong `Origin` header; retry with the configured origin succeeded.)
- BACKEND_HEALTH: PASS (`/health` = `{status:ok, db:configured}`)
- BACKEND_READINESS: PASS (auth routes respond; 401 unauthenticated / 200 authenticated)

## Scope / safety

- ACTIVE_STORAGE_MODIFIED: NO — storage not touched (per authorized scope). Note: the demo tenant's identity-media logos (2 client logos, 1 company logo, 1 user avatar) remain in object storage as orphans; captured in the backup set for rollback/reference. Job-attachment storage keys were 0.
- ACTIVE_REDIS_MODIFIED: NO
- SOURCE_CHANGE: NO · SCHEMA_CHANGE: NO · MIGRATION: NO
- No code files changed; `git diff --check` PASS; HEAD unchanged `ffe3f82`.

## Rollback

- ROLLBACK_READY: YES — restore from verified backup `/opt/looply/.backups/20260819T180531Z` (PostgreSQL dump + object storage) using R2.1 `restore.sh` (isolated-test default, or `FORCE_DESTRUCTIVE` only on explicit separate approval). Because this was a single committed transaction with a verified pre-delete backup, the entire demo tenant is fully restorable.

## Result

RESULT: PASS
TARGET_COMPANY: Loyal Tech
TARGET_COMPANY_ID: cmsszpame000014etfdtm1ezx
PREDELETE_INVENTORY_MATCH: YES
SHARED_USERS_CONFIRMED_ZERO: YES
BACKUP_CREATED: YES
BACKUP_VERIFIED: YES
BACKUP_PATH: /opt/looply/.backups/20260819T180531Z
TRANSACTIONAL_CLEANUP: PASS
ROWS_DELETED_BY_MODEL: approvals 110, activities 1338, attachments 0, contents 187, appointments 638, workflows 1, clients 6, invitations 0, whatsapp 0, sessions 4431, resetTokens 2, members 5, users 5, company 1
COMPANY_REMAINING: 0
MEMBERS_REMAINING: 0
DEMO_USERS_REMAINING: 0
CLIENTS_REMAINING: 0
CONTENTS_REMAINING: 0
APPOINTMENTS_REMAINING: 0
ACTIVITIES_REMAINING: 0
APPROVALS_REMAINING: 0
CONTENT_VERSIONS_REMAINING: 0
SESSIONS_REMAINING: 0
RESET_TOKENS_REMAINING: 0
WORKFLOWS_REMAINING: 0
WORKFLOW_STAGES_REMAINING: 0
NON_DEMO_COMPANIES_PRESERVED: YES
NON_DEMO_DATA_INTEGRITY: PASS
BACKEND_HEALTH: PASS
BACKEND_READINESS: PASS
ACTIVE_STORAGE_MODIFIED: NO
ACTIVE_REDIS_MODIFIED: NO
SOURCE_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
ROLLBACK_READY: YES
R2_P12_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_POST_CLEANUP_VALIDATION
REPORT: .dev-reports/looply-v1-r2-p12-active-demo-data-cleanup.md
GIT_STATE: no source changes; report untracked + not staged/committed; HEAD ffe3f82
KORE_TOUCHED: NO

LOOPLY R2.P12 ACTIVE DEMO DATA CLEANUP — COMPLETE