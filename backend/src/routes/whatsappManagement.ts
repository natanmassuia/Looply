import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { logger } from "../lib/logger";
import { parse } from "../lib/parse";
import { requireRole } from "../middleware/requireAuth";
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

// Best-effort render of a template's visible text for the conversation
// timeline: join its HEADER/BODY/FOOTER text and substitute {{n}} with the
// parameters that were sent. Falls back to the template name.
async function renderTemplateBody(
  name: string,
  language: string,
  sentComponents?: unknown[],
): Promise<string> {
  const fallback = `Template: ${name}`;
  try {
    const templates = await listMessageTemplates();
    const tpl =
      templates.find((t) => t.name === name && t.language === language) ??
      templates.find((t) => t.name === name);
    if (!tpl || !Array.isArray(tpl.components)) return fallback;
    const parts: string[] = [];
    for (const c of tpl.components as Array<{ text?: string }>) {
      if (typeof c?.text === "string" && c.text.trim()) parts.push(c.text.trim());
    }
    let text = parts.join("\n\n");
    const sent = (sentComponents ?? []) as Array<{ type?: string; parameters?: Array<{ text?: string }> }>;
    const bodyComp = sent.find((c) => (c.type ?? "").toLowerCase() === "body");
    bodyComp?.parameters?.forEach((p, i) => {
      if (typeof p?.text === "string") {
        text = text.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, "g"), p.text);
      }
    });
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

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

router.post("/templates/send", requireRole("OWNER", "ADMIN"), asyncHandler(async (req, res) => {
  const input = parse(sendTemplateSchema, req.body);
  const result = await sendTemplateMessage(
    input.to,
    input.templateName,
    input.languageCode,
    input.components,
  );

  // Record the sent template in the recipient's conversation timeline so it
  // shows in the panel, rendering the real template text when we can resolve
  // it. Never fail the send if persistence has a hiccup.
  try {
    const companyId = req.auth!.companyId;
    const body = await renderTemplateBody(input.templateName, input.languageCode, input.components);
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
      body,
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
