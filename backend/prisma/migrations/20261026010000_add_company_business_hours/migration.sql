-- Single daily business-hours window for appointment scheduling (nullable;
-- businessDays defaults to empty = hours not enforced). Additive, no backfill.
ALTER TABLE "Company" ADD COLUMN "businessHoursStart" TEXT;
ALTER TABLE "Company" ADD COLUMN "businessHoursEnd" TEXT;
ALTER TABLE "Company" ADD COLUMN "businessDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
