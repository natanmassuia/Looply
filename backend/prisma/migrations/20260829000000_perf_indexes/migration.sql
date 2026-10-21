-- CreateIndex
CREATE INDEX "ConversationMessage_provider_providerMessageId_idx" ON "ConversationMessage"("provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "Content_companyId_updatedAt_idx" ON "Content"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "Content_companyId_status_updatedAt_idx" ON "Content"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Content_companyId_lifecycleStatus_idx" ON "Content"("companyId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "WhatsAppChannel_provider_sourcePhoneNumber_idx" ON "WhatsAppChannel"("provider", "sourcePhoneNumber");

-- CreateIndex
CREATE INDEX "Client_companyId_primaryContactPhone_idx" ON "Client"("companyId", "primaryContactPhone");

-- CreateIndex
CREATE INDEX "Approval_companyId_status_idx" ON "Approval"("companyId", "status");
