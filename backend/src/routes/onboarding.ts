import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, badRequest } from "../lib/errors";
import { parse } from "../lib/parse";
import { requireAuth } from "../middleware/requireAuth";
import { updateAppearanceSchema } from "../lib/validation";
import { updateAppearance } from "../services/workspaceAppearanceService";
import {
  getOnboardingStatus,
  selectTemplate,
  completeOnboarding,
} from "../services/onboardingService";

const router = Router();
router.use(requireAuth);

// Status works in every first-login state.
router.get(
  "/status",
  asyncHandler(async (req, res) => {
    res.json(await getOnboardingStatus(prisma, req.auth!));
  }),
);

const companySchema = z.object({
  name: z.string().min(1).max(160),
  legalName: z.string().max(200).optional(),
  document: z.string().max(40).optional(),
  email: z.string().email().max(160).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(200).optional(),
  timezone: z.string().min(1).max(64),
  locale: z.enum(["pt-BR", "en-US"]),
});

router.patch(
  "/company",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const existing = await prisma.company.findUnique({
      where: { id: auth.companyId },
      select: { onboardedAt: true },
    });
    if (!existing) throw badRequest("Workspace inválido");
    if (existing.onboardedAt) throw badRequest("Workspace já ativado");
    const input = parse(companySchema, req.body);
    const company = await prisma.company.update({
      where: { id: auth.companyId },
      data: input,
    });
    res.json({
      name: company.name,
      timezone: company.timezone,
      locale: company.locale,
    });
  }),
);

router.post(
  "/template",
  asyncHandler(async (req, res) => {
    const { template } = parse(
      z.object({ template: z.enum(["LOCAL_BUSINESS", "HIGH_TICKET", "MARKETING_AGENCY"]) }),
      req.body,
    );
    await selectTemplate(prisma, req.auth!.companyId, template);
    res.json({ template });
  }),
);

// Appearance step (F4C). Pre-activation write: /api/settings/appearance is
// gated by requireWorkspaceActive, so onboarding exposes the same validated
// service here. Tenant always from the session.
router.patch(
  "/appearance",
  asyncHandler(async (req, res) => {
    const input = parse(updateAppearanceSchema, req.body);
    res.json({ appearance: await updateAppearance(prisma, req.auth!.companyId, input) });
  }),
);

router.post(
  "/complete",
  asyncHandler(async (req, res) => {
    res.json(await completeOnboarding(prisma, req.auth!));
  }),
);

export default router;
