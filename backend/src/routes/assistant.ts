import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { capabilitiesForTemplate } from "../domain/capabilities";
import { assistantHttpStatus, executeAssistantCommand } from "../services/assistantCommandService";
import type { AssistantDomainServices } from "../services/assistantCommandService";
import { assistantMessageRequestSchema, interpretAssistantMessage } from "../services/assistantLanguageAdapter";
import { OpenAICompatibleLanguageModel, type AssistantLanguageModel } from "../services/assistantLanguageModel";
import { env } from "../lib/env";
import type { DB } from "../lib/db";

const defaultLanguageModel = new OpenAICompatibleLanguageModel({
  baseUrl: env.ASSISTANT_LLM_BASE_URL,
  apiKey: env.ASSISTANT_LLM_API_KEY,
  model: env.ASSISTANT_LLM_MODEL,
});

export function makeAssistantRouter(db: DB, services?: AssistantDomainServices, languageModel: AssistantLanguageModel = defaultLanguageModel) {
  const router = Router();
  router.post("/commands", asyncHandler(async (req, res) => {
    const company = await db.company.findUnique({
      where: { id: req.auth!.companyId },
      select: { workspaceTemplate: true },
    });
    const result = await executeAssistantCommand(db, {
      companyId: req.auth!.companyId,
      userId: req.auth!.userId,
      capabilities: capabilitiesForTemplate(company?.workspaceTemplate),
    }, req.body, services);
    res.status(assistantHttpStatus(result)).json(result);
  }));
  router.post("/messages", asyncHandler(async (req, res) => {
    const parsed = assistantMessageRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: { code: "validation_error", message: "Erro de validação" } });
      return;
    }
    const company = await db.company.findUnique({
      where: { id: req.auth!.companyId },
      select: { timezone: true, workspaceTemplate: true },
    });
    if (!company) {
      res.status(500).json({ ok: false, error: { code: "internal_error", message: "Erro interno do servidor" } });
      return;
    }
    const interpreted = await interpretAssistantMessage(languageModel, parsed.data.message, {
      currentTimestamp: new Date(),
      timezone: company.timezone,
    });
    if (interpreted.kind !== "command") {
      const status = interpreted.kind === "clarification" ? 409 : interpreted.kind === "unsupported" ? 400 : 502;
      res.status(status).json({ ok: false, error: { code: interpreted.code, message: interpreted.message } });
      return;
    }
    const result = await executeAssistantCommand(db, {
      companyId: req.auth!.companyId,
      userId: req.auth!.userId,
      capabilities: capabilitiesForTemplate(company.workspaceTemplate),
    }, { ...interpreted.command, confirmed: parsed.data.confirmed }, services);
    res.status(assistantHttpStatus(result)).json(result);
  }));
  return router;
}

export default makeAssistantRouter(prisma);
