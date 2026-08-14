-- CreateEnum
CREATE TYPE "WorkspaceTemplate" AS ENUM ('LOCAL_BUSINESS', 'HIGH_TICKET', 'MARKETING_AGENCY');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "workspaceTemplate" "WorkspaceTemplate";