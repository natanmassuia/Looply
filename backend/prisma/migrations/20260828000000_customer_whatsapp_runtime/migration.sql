-- CreateEnum
CREATE TYPE "WhatsAppChannelPurpose" AS ENUM ('CUSTOMER_AI', 'INTERNAL_ASSISTANT');

-- CreateEnum
CREATE TYPE "AudioTranscriptionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "WhatsAppChannel" ADD COLUMN "purpose" "WhatsAppChannelPurpose" NOT NULL DEFAULT 'CUSTOMER_AI';

-- AlterTable
ALTER TABLE "ConversationMessage" ADD COLUMN "transcriptionStatus" "AudioTranscriptionStatus";
