import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { updateAppearanceSchema } from "../lib/validation";
import { getAppearance, updateAppearance } from "../services/workspaceAppearanceService";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { requireWorkspaceActive } from "../middleware/requireWorkspaceActive";

const router = Router();
router.use(requireAuth, requireWorkspaceActive);

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

export default router;