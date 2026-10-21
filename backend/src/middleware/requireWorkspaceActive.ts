import type { RequestHandler } from "express";
import { prisma } from "../lib/db";
import { forbidden } from "../lib/errors";

// Normal domain operation requires a fully activated workspace:
// password changed + onboarding completed (onboardedAt set).
export const requireWorkspaceActive: RequestHandler = (req, _res, next) => {
  const auth = req.auth;
  if (!auth) {
    next(forbidden());
    return;
  }
  if (auth.workspaceTemplate !== undefined && auth.onboardedAt !== undefined) {
    if (!auth.onboardedAt || !auth.workspaceTemplate) {
      next(forbidden("Onboarding do workspace pendente"));
      return;
    }
    next();
    return;
  }
  prisma.company
    .findUnique({ where: { id: auth.companyId }, select: { onboardedAt: true, workspaceTemplate: true } })
    .then((company) => {
      if (!company || !company.onboardedAt || !company.workspaceTemplate) {
        next(forbidden("Onboarding do workspace pendente"));
        return;
      }
      next();
    })
    .catch(next);
};
