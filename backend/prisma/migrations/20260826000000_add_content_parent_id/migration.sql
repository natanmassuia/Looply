-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Content_parentId_idx" ON "Content"("parentId");
