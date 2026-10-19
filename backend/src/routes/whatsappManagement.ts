import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import {
  listPhoneNumbers,
  listMessageTemplates,
  sendTemplateMessage,
} from "../services/whatsappManagementService";

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
  res.json(result);
}));

export default router;
