import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, forbidden } from "../lib/errors";
import { parse } from "../lib/parse";
import { requireAuth } from "../middleware/requireAuth";
import { requireWorkspaceActive } from "../middleware/requireWorkspaceActive";
import { listMembers, updateMember, resetMemberPassword } from "../services/memberService";

const router = Router();
router.use(requireAuth, requireWorkspaceActive);

// OWNER and ADMIN can list; MEMBER cannot manage members at all.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.auth!.role === "MEMBER") throw forbidden();
    res.json({ members: await listMembers(prisma, req.auth!.companyId) });
  }),
);

const patchSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(patchSchema, req.body);
    res.json(
      await updateMember(prisma, req.auth!.companyId, req.params.id, req.auth!.role, input),
    );
  }),
);

router.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const result = await resetMemberPassword(
      prisma,
      req.auth!.companyId,
      req.auth!.userId,
      req.auth!.role,
      req.params.id,
    );
    res.json({
      ok: true,
      temporaryPassword: result.temporaryPassword,
      user: result.user,
      message: "Senha temporária gerada com sucesso. O usuário deverá alterá-la no próximo acesso.",
    });
  }),
);

export default router;
