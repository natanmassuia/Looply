-- B8: metadata-only Job attachments. Bytes remain in private object storage.
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'AVAILABLE', 'FAILED');

CREATE TABLE "JobAttachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "etag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobAttachment_storageKey_key" ON "JobAttachment"("storageKey");
CREATE INDEX "JobAttachment_companyId_jobId_idx" ON "JobAttachment"("companyId", "jobId");
CREATE INDEX "JobAttachment_jobId_status_idx" ON "JobAttachment"("jobId", "status");

ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
