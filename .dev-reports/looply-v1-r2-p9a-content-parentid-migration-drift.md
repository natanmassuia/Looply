# R2.P9A — Content.parentId Migration Drift

**Date:** 2026-08-19
**Repo:** /opt/looply
**Branch:** main
**HEAD:** c0b8812

## Root cause

`prisma/schema.prisma` `Job` model declares `parentId String?` (self-relation `JobGroup`, `@@index([parentId])`, mapped to DB table `Content`), but **no committed migration created the `Content.parentId` column**. A fresh `prisma migrate deploy` therefore produced a table incompatible with the generated Prisma client, so every content/job creation failed with `The column Content.parentId does not exist`. The dev DB only worked because `parentId` existed from historical `db push`/manual drift.

**ROOT_CAUSE: MIGRATION_HISTORY_DRIFT**

## Fix

Created one forward-only migration that brings a DB created from all existing committed migrations to the current schema:

- Path: `backend/prisma/migrations/20260826000000_add_content_parent_id/migration.sql`
- Name: `20260826000000_add_content_parent_id`

```sql
ALTER TABLE "Content" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Content" ADD CONSTRAINT "Content_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Content_parentId_idx" ON "Content"("parentId");
```

- PARENT_ID_TYPE: TEXT
- PARENT_ID_NULLABILITY: NULLABLE (no NOT NULL, no default — matches `String?`)
- FOREIGN_KEY: `Content_parentId_fkey` → `Content(id)`, ON DELETE SET NULL ON UPDATE CASCADE (matches Prisma optional self-relation default)
- INDEX: `Content_parentId_idx` btree(parentId) — matches `@@index([parentId])`

## Proof (disposable PostgreSQL only)

### Empty DB — migrate deploy from zero
Fresh disposable PG (`looply_p9a`), `prisma migrate deploy`:
- All **16** migrations applied including the new one. **EMPTY_DB_MIGRATE_DEPLOY: PASS**
- Migrated `Content` table confirmed: `parentId text` (nullable), `Content_parentId_fkey` FK, `Content_parentId_idx` index — schema/DB agree.
- Content creation via `createContent` → `status=DRAFT`, `parentId=null`. **CONTENT_CREATE: PASS**
- `groupContent(child, parent)` set child `parentId` → parent id, persisted; parent stays null. **PARENT_CHILD_CONTRACT: PASS**

### Old-state upgrade path
Fresh disposable PG (`looply_up`), deployed with the new migration temporarily excluded (old state = Content without parentId), inserted an existing Content row `c_old` ("Existing Old Content"), then applied the new migration:
- Existing row preserved (verified `c_old` still present with `parentId` now available/null). **OLD_STATE_UPGRADE: PASS · EXISTING_CONTENT_PRESERVED: YES**
- Content creation works after upgrade (`status=DRAFT`, parentId null); total rows = old + new. **CONTENT_CREATE: PASS**

## Safety

- ACTIVE_DB_TOUCHED: NO (only disposable containers, torn down after)
- DB_PUSH_USED: NO
- HISTORICAL_MIGRATION_CHANGED: NO (historical migrations untouched; one new forward-only migration added)

## Validation

- BACKEND_TESTS: ALL_PASS (481/481)
- BACKEND_TYPECHECK: PASS
- BACKEND_BUILD: PASS
- DIFF_CHECK: PASS

- SCHEMA_CHANGE: NO (schema.prisma already declared parentId; only the missing migration was added — the committed file set is unchanged, a migration was added)
- DATA_DESTRUCTIVE_CHANGE: NO

## Result

RESULT: PASS
ROOT_CAUSE: MIGRATION_HISTORY_DRIFT
MIGRATION_CREATED: YES
MIGRATION_NAME: 20260826000000_add_content_parent_id

PARENT_ID_TYPE: TEXT
PARENT_ID_NULLABILITY: NULLABLE
FOREIGN_KEY: Content_parentId_fkey (ON DELETE SET NULL ON UPDATE CASCADE)
INDEX: Content_parentId_idx

EMPTY_DB_MIGRATE_DEPLOY: PASS
OLD_STATE_UPGRADE: PASS
EXISTING_CONTENT_PRESERVED: YES
CONTENT_CREATE: PASS
PARENT_CHILD_CONTRACT: PASS

ACTIVE_DB_TOUCHED: NO
DB_PUSH_USED: NO
HISTORICAL_MIGRATION_CHANGED: NO

BACKEND_TESTS: ALL_PASS (481/481)
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
DIFF_CHECK: PASS

SCHEMA_CHANGE: NO
DATA_DESTRUCTIVE_CHANGE: NO

R2_P9A_STATUS: COMPLETE
NEXT_STATUS: READY_FOR_INDEPENDENT_AUDIT
REPORT: .dev-reports/looply-v1-r2-p9a-content-parentid-migration-drift.md
GIT_STATE: new migration untracked (not staged); reports (M1/M2/P9 + this) untracked; HEAD c0b8812
KORE_TOUCHED: NO

LOOPLY R2.P9A CONTENT PARENTID MIGRATION DRIFT — COMPLETE