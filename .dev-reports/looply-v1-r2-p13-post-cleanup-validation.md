# R2.P13 — Post-Cleanup Validation

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** ffe3f82

Independent validation after the approved Loyal Tech demo-tenant deletion (R2.P12). Read-only — no DB/Redis/storage/source/schema/migration modified.

## 1. Demo tenant absence (companyId `cmsszpame000014etfdtm1ezx`)

| Metric | Remaining |
|---|---|
| DEMO_COMPANY | 0 |
| DEMO_MEMBERS | 0 |
| DEMO_USERS (natan/lucas/marina/joao/ana) | 0 |
| DEMO_CLIENTS | 0 |
| DEMO_CONTENTS | 0 |
| DEMO_APPOINTMENTS | 0 |
| DEMO_ACTIVITIES | 0 |
| DEMO_APPROVALS | 0 |
| DEMO_CONTENT_VERSIONS | 0 |
| DEMO_SESSIONS (for deleted users) | 0 |
| DEMO_RESET_TOKENS (for deleted users) | 0 |
| DEMO_WORKFLOWS | 0 |

All zero — demo tenant fully absent.

## 2. Non-demo preservation

All 4 companies that existed before cleanup still exist (matching R2.P12 pre-delete evidence):
- Teste Corp LTDA: 2 members, 1 client, 0 contents, 0 appointments
- LegacyCo 1786719162068 / 1786719266621 / 1786719280200: 1 member each

No unexpected non-demo reduction. **NON_DEMO_COMPANIES_PRESERVED: YES · NON_DEMO_DATA_INTEGRITY: PASS**

## 3. Functional proof (existing non-demo tenant: Teste Corp LTDA / dono@testecorp.com)

- NON_DEMO_LOGIN: PASS — HTTP 200, role OWNER (via active backend)
- PROTECTED_API_READ: PASS — `GET /api/clients` 200 (1 client "B5 Smoke Tenant B"), `GET /api/workflows` 200 (1 workflow), `GET /api/auth/me` 200 (workspace Teste Corp LTDA)
- BACKEND_HEALTH: PASS — `/health` = `{status:ok, db:configured}`
- BACKEND_READINESS: PASS — `/health` reports db configured; authenticated routes respond correctly (no `/ready` route exists in this app — health is the readiness contract)

No product data created or mutated (all reads).

## 4. Backup

- BACKUP_PRESENT: YES — `/opt/looply/.backups/20260819T180531Z` (gitignored; postgres.dump + manifest + 4 objects)
- BACKUP_VERIFICATION: PASS — re-ran `ops/backup/verify.sh`: postgres.dump OK, manifest OK, all 4 object checksums OK
- Not restored (correct).

## 5. Storage / Redis integrity

- ACTIVE_STORAGE_INTEGRITY: PASS — MinIO health HTTP 200 (operational). The cleanup was DB-only; storage was never written by the deletion (only the backup mirror read from it). P11/P12 confirmed 0 job-attachment storage keys for the demo tenant.
- ACTIVE_REDIS_INTEGRITY: PASS — the cleanup issued only Prisma DB deletes, never Redis commands; active backend fully functional (login + protected reads) which depends on core auth.

## 6. Git

- SOURCE_CHANGE: NO
- SCHEMA_CHANGE: NO
- MIGRATION: NO
- HEAD unchanged: `ffe3f82`
- Only cleanup/dev reports remain untracked (M1/M2, P9/P9-rerun, P10, P11, P12 + this)
- DIFF_CHECK: PASS

## Result

RESULT: PASS
DEMO_COMPANY_REMAINING: 0
DEMO_MEMBERS_REMAINING: 0
DEMO_USERS_REMAINING: 0
DEMO_CLIENTS_REMAINING: 0
DEMO_CONTENTS_REMAINING: 0
DEMO_APPOINTMENTS_REMAINING: 0
DEMO_ACTIVITIES_REMAINING: 0
DEMO_APPROVALS_REMAINING: 0
DEMO_CONTENT_VERSIONS_REMAINING: 0
DEMO_SESSIONS_REMAINING: 0
DEMO_RESET_TOKENS_REMAINING: 0
DEMO_WORKFLOWS_REMAINING: 0

NON_DEMO_COMPANIES_PRESERVED: YES
NON_DEMO_DATA_INTEGRITY: PASS

NON_DEMO_LOGIN: PASS
PROTECTED_API_READ: PASS
BACKEND_HEALTH: PASS
BACKEND_READINESS: PASS

BACKUP_PRESENT: YES
BACKUP_VERIFICATION: PASS

ACTIVE_STORAGE_INTEGRITY: PASS
ACTIVE_REDIS_INTEGRITY: PASS

SOURCE_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
DIFF_CHECK: PASS

POST_CLEANUP_STATUS: PASS
NEXT_STATUS: READY_FOR_EMAIL_DELIVERY_READINESS
REPORT: .dev-reports/looply-v1-r2-p13-post-cleanup-validation.md
GIT_STATE: no source/schema/migration changes; reports untracked; HEAD ffe3f82
KORE_TOUCHED: NO

LOOPLY R2.P13 POST CLEANUP VALIDATION — PASS