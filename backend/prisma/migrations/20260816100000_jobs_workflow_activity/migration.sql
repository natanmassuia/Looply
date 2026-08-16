-- B6: generalize the physical Content table into the canonical Job model.
-- The table names and row IDs stay unchanged; Prisma maps Job/JobVersion to
-- Content/ContentVersion for safe incremental compatibility with Approval.

CREATE TYPE "JobLifecycleStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActivityType" AS ENUM ('JOB_CREATED', 'JOB_UPDATED', 'JOB_STAGE_CHANGED', 'JOB_COMPLETED', 'JOB_CANCELLED');

ALTER TABLE "Content" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Content" ADD COLUMN "lifecycleStatus" "JobLifecycleStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Content" ADD COLUMN "workflowId" TEXT;
ALTER TABLE "Content" ADD COLUMN "currentStageId" TEXT;

-- Deterministic ownership: B5 already made Client.companyId mandatory.
UPDATE "Content" j
SET "companyId" = c."companyId"
FROM "Client" c
WHERE c."id" = j."clientId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Content" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'Backfill incompleto: existem Jobs sem Company derivável do Client';
  END IF;
END
$$;

ALTER TABLE "Content" ALTER COLUMN "companyId" SET NOT NULL;

CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" "WorkspaceTemplate" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "terminal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "ActivityType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- One deterministic default workflow per configured workspace.
INSERT INTO "WorkflowDefinition" ("id", "companyId", "name", "template", "active", "createdAt", "updatedAt")
SELECT md5(c."id" || ':default-workflow'), c."id",
  CASE c."workspaceTemplate"
    WHEN 'LOCAL_BUSINESS' THEN 'Operação simples'
    WHEN 'HIGH_TICKET' THEN 'Operação de alto ticket'
    ELSE 'Operação de agência'
  END,
  c."workspaceTemplate", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
WHERE c."workspaceTemplate" IS NOT NULL;

INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':0'), w."id", 'Novo', 0, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'LOCAL_BUSINESS';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':1'), w."id", 'Em andamento', 1, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'LOCAL_BUSINESS';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':2'), w."id", 'Concluído', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'LOCAL_BUSINESS';

INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':0'), w."id", 'Novo', 0, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'HIGH_TICKET';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':1'), w."id", 'Em andamento', 1, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'HIGH_TICKET';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':2'), w."id", 'Revisão', 2, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'HIGH_TICKET';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':3'), w."id", 'Concluído', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'HIGH_TICKET';

INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':0'), w."id", 'Backlog', 0, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'MARKETING_AGENCY';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':1'), w."id", 'Em produção', 1, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'MARKETING_AGENCY';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':2'), w."id", 'Revisão', 2, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'MARKETING_AGENCY';
INSERT INTO "WorkflowStage" ("id", "workflowId", "name", "position", "terminal", "active", "createdAt", "updatedAt")
SELECT md5(w."id" || ':3'), w."id", 'Concluído', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "WorkflowDefinition" w WHERE w."template" = 'MARKETING_AGENCY';

UPDATE "Content" j
SET "workflowId" = w."id", "currentStageId" = s."id"
FROM "WorkflowDefinition" w
JOIN "WorkflowStage" s ON s."workflowId" = w."id" AND s."position" = 0
WHERE w."companyId" = j."companyId";

CREATE UNIQUE INDEX "WorkflowDefinition_companyId_key" ON "WorkflowDefinition"("companyId");
CREATE INDEX "WorkflowDefinition_companyId_idx" ON "WorkflowDefinition"("companyId");
CREATE UNIQUE INDEX "WorkflowStage_workflowId_position_key" ON "WorkflowStage"("workflowId", "position");
CREATE INDEX "WorkflowStage_workflowId_idx" ON "WorkflowStage"("workflowId");
CREATE INDEX "Activity_companyId_jobId_idx" ON "Activity"("companyId", "jobId");
CREATE INDEX "Activity_jobId_createdAt_idx" ON "Activity"("jobId", "createdAt");
CREATE INDEX "Content_companyId_idx" ON "Content"("companyId");
CREATE INDEX "Content_workflowId_idx" ON "Content"("workflowId");
CREATE INDEX "Content_currentStageId_idx" ON "Content"("currentStageId");

ALTER TABLE "Content" ADD CONSTRAINT "Content_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Content" ADD CONSTRAINT "Content_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Content" ADD CONSTRAINT "Content_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "WorkflowStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
