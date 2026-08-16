-- CreateEnum
CREATE TYPE "AppearancePreset" AS ENUM ('AURA', 'FLUX', 'PULSE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AppearanceMode" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "appearanceCustomAccent" TEXT,
ADD COLUMN     "appearanceCustomBorder" TEXT,
ADD COLUMN     "appearanceCustomPrimary" TEXT,
ADD COLUMN     "appearanceCustomSecondary" TEXT,
ADD COLUMN     "appearanceCustomSurface" TEXT,
ADD COLUMN     "appearanceCustomText" TEXT,
ADD COLUMN     "appearanceMode" "AppearanceMode",
ADD COLUMN     "appearancePreset" "AppearancePreset";
