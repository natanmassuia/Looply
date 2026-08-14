import { Router } from "express";
import { prisma } from "../lib/db";
import { getDashboardForCompany } from "../services/dashboardService";
import { asyncHandler } from "../lib/errors";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";

const router = Router();
router.use(requireCapability(Capability.DASHBOARD));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await getDashboardForCompany(prisma, req.auth!.companyId);
    res.json(data);
  }),
);

export default router;
