# R2.P9A — Content.parentId Migration Drift — Independent Audit

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** c0b8812

## Audit scope

- `.dev-reports/looply-v1-r2-p9a-content-parentid-migration-drift.md`
- `prisma/schema.prisma` Job/Content relation
- new migration `20260826000000_add_content_parent_id/migration.sql`
- No broad schema audit; only the directly relevant Content relation.

## 1. Schema parity

| Aspect | Migration | schema.prisma | Match |
|---|---|---|---|
| Type | `parentId TEXT` | `parentId String?` (Prisma String = TEXT) | YES |
| Nullability | nullable, no NOT NULL, no default | `String?` nullable | YES |
| Self-relation | FK `Content_parentId_fkey → Content(id)` | `parent Job? @relation("JobGroup", fields:[parentId], references:[id])` | YES |
| FK behavior | `ON DELETE SET NULL ON UPDATE CASCADE` | Prisma optional relation default = SetNull/Cascade | YES (SET_NULL_CASCADE) |
| Index | `Content_parentId_idx btree(parentId)` | `@@index([parentId])` | YES |

**MIGRATION_MATCHES_SCHEMA: YES**

## 2. Migration safety

- Forward-only (`ALTER TABLE ADD COLUMN` + `ADD CONSTRAINT` + `CREATE INDEX`). **FORWARD_ONLY: YES**
- No destructive statements (no DROP/truncate/rewrite). **DESTRUCTIVE_CHANGE: NO**
- `ADD COLUMN ... TEXT` nullable, no default → existing rows get NULL and remain valid. **EXISTING_CONTENT_PRESERVED: YES**
- Historical migrations untouched (only this new file added). **HISTORICAL_MIGRATION_CHANGED: NO**
- Name `20260826000000` sorts after latest `20260825000000` — valid ordering. **NAME_VALID: YES**

## 3. Upgrade path (evidence reused from R2.P9A, diff unchanged)

- Old-state (15 migrations) DB → applied new migration → existing `c_old` row preserved, `parentId` available. **OLD_STATE_UPGRADE: PASS**

## 4. Fresh install (evidence reused + re-verified)

- Fresh disposable PG → all 16 migrations apply from zero. **EMPTY_DB_MIGRATE_DEPLOY: PASS**
- Ordinary Content creation works (`status=DRAFT`, `parentId=null`). **CONTENT_CREATE: PASS**
- Child Content with `parentId` via `groupContent`. **PARENT_CHILD_CREATE: PASS**
- **PARENT_DELETE_SET_NULL: PASS** — independently re-verified this audit: grouped child's `parentId` becomes NULL when the parent row is deleted (FK ON DELETE SET NULL).

## 5. Drift closure

A database created exclusively from the 16 committed migrations now contains `Content.parentId` (column + FK + index), so the original failure `The column Content.parentId does not exist` is no longer possible. **ORIGINAL_DRIFT_CLOSED: YES**

## 6. Scope

- ACTIVE_DB_TOUCHED: NO (disposable containers only, torn down)
- DB_PUSH_USED: NO
- SCHEMA_FILE_CHANGED: NO (schema.prisma already declared parentId; only the missing migration added)
- APP_CODE_CHANGED: NO

## Validation (evidence reused — diff unchanged)

- BACKEND_TESTS: 481/481_PASS
- BACKEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- DIFF_CHECK: PASS

## Result

RESULT: PASS
ROOT_CAUSE_CONFIRMED: YES
MIGRATION_MATCHES_SCHEMA: YES
PARENT_ID_TYPE: TEXT
PARENT_ID_NULLABILITY: NULLABLE
FOREIGN_KEY_BEHAVIOR: SET_NULL_CASCADE
INDEX_PRESENT: YES

FORWARD_ONLY: YES
DESTRUCTIVE_CHANGE: NO
HISTORICAL_MIGRATION_CHANGED: NO

EMPTY_DB_MIGRATE_DEPLOY: PASS
OLD_STATE_UPGRADE: PASS
EXISTING_CONTENT_PRESERVED: YES
CONTENT_CREATE: PASS
PARENT_CHILD_CREATE: PASS
PARENT_DELETE_SET_NULL: PASS

ORIGINAL_DRIFT_CLOSED: YES

ACTIVE_DB_TOUCHED: NO
DB_PUSH_USED: NO
SCHEMA_FILE_CHANGED: NO
APP_CODE_CHANGED: NO

BACKEND_TESTS: 481/481_PASS
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

R2_P9A_CONSOLIDATION: PASS
NEXT_STATUS: READY_FOR_CONSOLIDATION
REPORT: .dev-reports/looply-v1-r2-p9a-content-parentid-independent-audit.md
GIT_STATE: new migration untracked (not staged); reports (M1/M2/P9/P9A + this) untracked; HEAD c0b8812
KORE_TOUCHED: NO

LOOPLY R2.P9A CONTENT PARENTID INDEPENDENT AUDIT — PASS