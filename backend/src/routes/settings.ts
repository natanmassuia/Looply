import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, badRequest, notFound } from "../lib/errors";
import { parse } from "../lib/parse";
import { updateAppearanceSchema, httpsUrl } from "../lib/validation";
import { getAppearance, updateAppearance } from "../services/workspaceAppearanceService";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { requireWorkspaceActive } from "../middleware/requireWorkspaceActive";

const router = Router();
router.use(requireAuth, requireWorkspaceActive);

// ── Appearance ──────────────────────────────────────────────────────────────
// Appearance is read by every active workspace member (the UI needs the theme);
// only OWNER/ADMIN may mutate it. Tenant is always taken from the session.
router.get(
  "/appearance",
  asyncHandler(async (req, res) => {
    res.json({ appearance: await getAppearance(prisma, req.auth!.companyId) });
  }),
);

router.patch(
  "/appearance",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const input = parse(updateAppearanceSchema, req.body);
    res.json({ appearance: await updateAppearance(prisma, req.auth!.companyId, input) });
  }),
);

// ── Company Settings ───────────────────────────────────────────────────────
export function isValidTimezone(tz: string): boolean {
  if (typeof tz !== "string" || !tz.trim() || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const updateCompanySchema = z.object({
  name: z.string().min(1).max(160).optional(),
  timezone: z.string().min(1).max(64).optional(),
  logoUrl: httpsUrl(500).nullable().optional(),
  legalName: z.string().max(200).nullable().optional(),
  document: z.string().max(40).nullable().optional(),
  email: z.string().email().max(160).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  businessContext: z.string().max(5000).nullable().optional(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").nullable().optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").nullable().optional(),
  businessDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});

router.get(
  "/company",
  asyncHandler(async (req, res) => {
    const company = await prisma.company.findUnique({
      where: { id: req.auth!.companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        timezone: true,
        locale: true,
        legalName: true,
        document: true,
        email: true,
        phone: true,
        website: true,
        businessContext: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        businessDays: true,
        onboardedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!company) throw notFound("Workspace não encontrado");
    res.json({ company });
  }),
);

router.patch(
  "/company",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const input = parse(updateCompanySchema, req.body);

    if (input.name !== undefined && !input.name.trim()) {
      throw badRequest("Nome da empresa não pode ser vazio");
    }

    if (input.timezone !== undefined) {
      if (!isValidTimezone(input.timezone)) {
        throw badRequest("Fuso horário inválido");
      }
    }

    const data: {
      name?: string;
      timezone?: string;
      logoUrl?: string | null;
      legalName?: string | null;
      document?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      businessContext?: string | null;
      businessHoursStart?: string | null;
      businessHoursEnd?: string | null;
      businessDays?: number[];
    } = {};

    if (input.name !== undefined) data.name = input.name.trim();
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.legalName !== undefined) data.legalName = input.legalName;
    if (input.document !== undefined) data.document = input.document;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.website !== undefined) data.website = input.website;
    if (input.businessContext !== undefined) data.businessContext = input.businessContext;
    if (input.businessHoursStart !== undefined) data.businessHoursStart = input.businessHoursStart;
    if (input.businessHoursEnd !== undefined) data.businessHoursEnd = input.businessHoursEnd;
    if (input.businessDays !== undefined) data.businessDays = input.businessDays;

    // Reject an inverted window so scheduling isn't silently blocked for all slots.
    const finalStart = input.businessHoursStart !== undefined ? input.businessHoursStart : undefined;
    const finalEnd = input.businessHoursEnd !== undefined ? input.businessHoursEnd : undefined;
    if (finalStart && finalEnd && finalEnd <= finalStart) {
      throw badRequest("Horário de fechamento deve ser maior que o de abertura");
    }

    const company = await prisma.company.update({
      where: { id: req.auth!.companyId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        timezone: true,
        locale: true,
        legalName: true,
        document: true,
        email: true,
        phone: true,
        website: true,
        businessContext: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        businessDays: true,
        onboardedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ company });
  }),
);

export default router;