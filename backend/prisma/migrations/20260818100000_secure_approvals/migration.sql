-- B9: secure the existing Approval rows without changing IDs or links.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_CHANGES_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'APPROVAL_REVOKED';

ALTER TYPE "ApprovalStatus" ADD VALUE 'REJECTED';
ALTER TYPE "ApprovalStatus" ADD VALUE 'REVOKED';

ALTER TABLE "Approval" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Approval" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "Approval" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Approval" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "Approval" ADD COLUMN "decidedAt" TIMESTAMP(3);

-- Ownership is derived from the already tenant-owned Job.
UPDATE "Approval" a
SET "companyId" = j."companyId"
FROM "Content" j
WHERE j."id" = a."contentId";

-- Existing public links remain valid for a bounded compatibility window.
UPDATE "Approval"
SET "tokenHash" = encode(digest("token", 'sha256'), 'hex'),
    "expiresAt" = "createdAt" + INTERVAL '30 days';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Approval" WHERE "companyId" IS NULL OR "tokenHash" IS NULL OR "expiresAt" IS NULL) THEN
    RAISE EXCEPTION 'Approval backfill incompleto';
  END IF;
END
$$;

ALTER TABLE "Approval" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Approval" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "Approval" ALTER COLUMN "expiresAt" SET NOT NULL;

DROP INDEX "Approval_token_key";
ALTER TABLE "Approval" DROP COLUMN "token";

CREATE UNIQUE INDEX "Approval_tokenHash_key" ON "Approval"("tokenHash");
CREATE INDEX "Approval_companyId_contentId_idx" ON "Approval"("companyId", "contentId");

CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "comment" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalAttachment" (
    "approvalId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalAttachment_pkey" PRIMARY KEY ("approvalId", "attachmentId")
);

CREATE INDEX "ApprovalDecision_approvalId_createdAt_idx" ON "ApprovalDecision"("approvalId", "createdAt");
CREATE INDEX "ApprovalAttachment_attachmentId_idx" ON "ApprovalAttachment"("attachmentId");

ALTER TABLE "Approval" ADD CONSTRAINT "Approval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "JobAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
