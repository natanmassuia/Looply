import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { logger } from "../lib/logger";
import { parse } from "../lib/parse";
import {
  listPhoneNumbers,
  listMessageTemplates,
  sendTemplateMessage,
} from "../services/whatsappManagementService";
import {
  appendOutboundMessage,
  getOrCreateConversation,
} from "../services/conversationService";

// ── WhatsApp Management routes (whatsapp_business_management) ───────────
// Authenticated routes for listing phone numbers, message templates, and
// sending template messages via the Meta Graph API.

const sendTemplateSchema = z.object({
  to: z.string().min(1).max(20),
  templateName: z.string().min(1).max(512),
  languageCode: z.string().min(2).max(10),
  components: z.array(z.unknown()).optional(),
}).strict();

const router = Router();

router.get("/phone-numbers", asyncHandler(async (_req, res) => {
  const numbers = await listPhoneNumbers();
  res.json({ phoneNumbers: numbers });
}));

router.get("/templates", asyncHandler(async (_req, res) => {
  const templates = await listMessageTemplates();
  res.json({ templates });
}));

router.post("/templates/send", asyncHandler(async (req, res) => {
  const input = parse(sendTemplateSchema, req.body);
  const result = await sendTemplateMessage(
    input.to,
    input.templateName,
    input.languageCode,
    input.components,
  );

  // Record the sent template in the recipient's conversation timeline so it
  // shows in the panel. Never fail the send if persistence has a hiccup.
  try {
    const companyId = req.auth!.companyId;
    const conversation = await getOrCreateConversation(prisma, {
      companyId,
      remotePhone: input.to,
      provider: "whatsapp",
    });
    await appendOutboundMessage(prisma, {
      companyId,
      conversationId: conversation.id,
      senderType: "USER",
      senderUserId: req.auth!.userId,
      provider: "whatsapp",
      providerMessageId: result?.messages?.[0]?.id ?? null,
      type: "TEXT",
      body: `Template enviado: ${input.templateName}`,
      deliveryStatus: "SENT",
    });
  } catch (err) {
    logger.warn("whatsapp_template_persist_failed", {
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  res.json(result);
}));

export default router;
