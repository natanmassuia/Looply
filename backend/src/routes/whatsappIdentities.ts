import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { provisionWhatsAppIdentity } from "../services/whatsappActorService";
import type { DB } from "../lib/db";

// Controlled provisioning of WhatsApp actor identities (A3.0).
// Auth/password/workspace guards come from the app-level /api middleware
// chain (same as /api/assistant). OWNER/ADMIN only, enforced in the service;
// companyId comes exclusively from auth context; the target user must be an
// active member of the same company. No role/capability input is accepted.
const createSchema = z.object({
  userId: z.string().min(1).max(64),
  phoneNumber: z.string().min(8).max(24),
  label: z.string().max(100).optional(),
}).strict();

export function makeWhatsAppIdentitiesRouter(db: DB) {
  const router = Router();

  router.post("/", asyncHandler(async (req, res) => {
    const input = parse(createSchema, req.body);
    const identity = await provisionWhatsAppIdentity(db, {
      companyId: req.auth!.companyId,
      role: req.auth!.role,
    }, input);
    res.status(201).json(identity);
  }));

  return router;
}

export default makeWhatsAppIdentitiesRouter(prisma);
