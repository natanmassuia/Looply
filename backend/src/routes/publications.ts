import { Router } from "express";
import { prisma } from "../lib/db";
import { listPublications } from "../services/contentService";
import { asyncHandler } from "../lib/errors";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";

const router = Router();
router.use(requireCapability(Capability.JOBS));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const publications = await listPublications(prisma, req.auth!.companyId);
    res.json({ publications });
  }),
);

export default router;
