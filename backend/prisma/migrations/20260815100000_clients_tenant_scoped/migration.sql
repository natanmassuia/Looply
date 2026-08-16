-- B5: Client becomes tenant-owned.
-- Phase approach in one migration:
-- 1) add nullable companyId; 2) deterministic backfill (all existing Clients
--    were created in the single-tenant demo era and belong to the demo
--    workspace, selected by its unique slug); 3) enforce NOT NULL;
-- 4) tenant-scoped uniqueness + FK (RESTRICT) + index.

ALTER TABLE "Client" ADD COLUMN "companyId" TEXT;

UPDATE "Client"
SET "companyId" = (SELECT "id" FROM "Company" WHERE "slug" = 'looply-studio');

-- Dashboards/backfills must never leave a Client without a Company.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Client" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'Backfill incompleto: existem Clients sem Company determinística';
  END IF;
END
$$;

ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;

DROP INDEX "Client_name_key";

CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

CREATE UNIQUE INDEX "Client_companyId_name_key" ON "Client"("companyId", "name");

ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
