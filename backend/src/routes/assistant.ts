import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { capabilitiesForTemplate } from "../domain/capabilities";
import { assistantHttpStatus, executeAssistantCommand } from "../services/assistantCommandService";
import type { AssistantDomainServices } from "../services/assistantCommandService";
import type { DB } from "../lib/db";

export function makeAssistantRouter(db: DB, services?: AssistantDomainServices) {
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
  return router;
}

export default makeAssistantRouter(prisma);
