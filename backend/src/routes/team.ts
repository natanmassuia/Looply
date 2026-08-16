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

// B4 remediation: legacy arbitrary User creation removed. New users enter
// ONLY via Verbum provisioning CLI or invitation acceptance. Explicit 410 so
// old callers get a clear contract instead of a silent 404.
router.post("/", (_req, res) => {
  res.status(410).json({
    error: {
      code: "gone",
      message: "Criação de usuários por esta rota foi removida. Use convites (/api/invitations).",
    },
  });
});

export default router;
