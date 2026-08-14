import type { RequestHandler } from "express";
import { prisma } from "../lib/db";
import { forbidden } from "../lib/errors";
import { hasCapability, type Capability } from "../domain/capabilities";

// Capability guard for future domain routes:
//   requireAuth → req.auth (tenant) → company template → capability?
// The company ALWAYS comes from the authenticated tenant context — never from
// body/query. Missing capability → 403 (consistent with the existing
// authorization contract; resource stays hidden behind role-style denial).
export function makeRequireCapability(db: typeof prisma, capability: Capability): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      next(forbidden());
      return;
    }
    db.company
      .findUnique({
        where: { id: auth.companyId },
        select: { workspaceTemplate: true },
      })
      .then((company) => {
        if (!company || !hasCapability(company.workspaceTemplate, capability)) {
          next(forbidden("Recurso não disponível para este workspace"));
          return;
        }
        next();
      })
      .catch(next);
  };
}

export const requireCapability = (capability: Capability) =>
  makeRequireCapability(prisma, capability);
