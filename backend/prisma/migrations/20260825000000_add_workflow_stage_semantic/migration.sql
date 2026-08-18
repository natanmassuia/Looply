-- CreateEnum
CREATE TYPE "WorkflowStageSemantic" AS ENUM ('APPROVED', 'SCHEDULED', 'COMPLETED');

-- AlterTable
ALTER TABLE "WorkflowStage" ADD COLUMN     "semanticKey" "WorkflowStageSemantic";
