import { Router } from "express";
import { prisma } from "../lib/db";
import { listTeam } from "../services/teamService";
import { asyncHandler } from "../lib/errors";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const team = await listTeam(prisma);
    res.json({ team });
  }),
);

export default router;
