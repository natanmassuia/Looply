import { Router } from "express";
import { prisma } from "../lib/db";
import { listPublications } from "../services/contentService";
import { asyncHandler } from "../lib/errors";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const publications = await listPublications(prisma);
    res.json({ publications });
  }),
);

export default router;
