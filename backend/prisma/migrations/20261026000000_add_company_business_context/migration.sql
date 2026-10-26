-- Free-text business description for the customer AI (nullable, no backfill).
ALTER TABLE "Company" ADD COLUMN "businessContext" TEXT;
