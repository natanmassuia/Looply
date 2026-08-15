-- WhatsApp actor identity: explicit sender → (user, company) authorization mapping.
-- Additive only. No existing table is altered.
CREATE TABLE "WhatsAppIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'whatsapp',
    "phoneNumber" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppIdentity_provider_phoneNumber_key" ON "WhatsAppIdentity"("provider", "phoneNumber");

-- CreateIndex
CREATE INDEX "WhatsAppIdentity_companyId_idx" ON "WhatsAppIdentity"("companyId");

-- CreateIndex
CREATE INDEX "WhatsAppIdentity_userId_idx" ON "WhatsAppIdentity"("userId");

-- AddForeignKey
ALTER TABLE "WhatsAppIdentity" ADD CONSTRAINT "WhatsAppIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppIdentity" ADD CONSTRAINT "WhatsAppIdentity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
