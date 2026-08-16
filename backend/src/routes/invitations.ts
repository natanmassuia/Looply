import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { requireAuth } from "../middleware/requireAuth";
import { requireWorkspaceActive } from "../middleware/requireWorkspaceActive";
import {
  createInvitation,
  revokeInvitation,
  listInvitations,
  acceptInvitation,
} from "../services/memberService";
import { INVITATION_ACCEPT_LIMIT } from "../lib/rateLimit";

const router = Router();

// Accept: invitation-scoped signup/attach — must work WITHOUT a session when
// the user does not exist yet (the 256-bit single-use token IS the
// credential); an existing user must be logged in as the invited email.
const acceptSchema = z.object({
  token: z.string().min(32).max(128),
  name: z.string().min(1).max(160).optional(),
  password: z.string().min(1).max(200).optional(),
});

router.post(
  "/accept",
  INVITATION_ACCEPT_LIMIT,
  asyncHandler(async (req: Request, res: Response) => {
    const input = parse(acceptSchema, req.body);
    // Optional authentication: resolveAuth via requireAuth when cookie exists.
    await optionalAuth(req);
    const result = await acceptInvitation(prisma, {
      token: input.token,
      name: input.name,
      password: input.password,
      authUserId: (req as { auth?: { userId: string } }).auth?.userId,
    });
    res.json({ userId: result.userId, companyId: result.companyId, role: result.role });
  }),
);

// Everything below: authenticated tenant members + active workspace.
router.use(requireAuth, requireWorkspaceActive);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(
      z.object({ email: z.string().email().max(160), role: z.enum(["ADMIN", "MEMBER"]) }),
      req.body,
    );
    const result = await createInvitation(prisma, req.auth!, input);
    // Token returned ONCE to the inviter (email delivery is a later battery).
    res.status(201).json({
      invitationId: result.invitationId,
      expiresAt: result.expiresAt.toISOString(),
      token: result.token,
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ invitations: await listInvitations(prisma, req.auth!.companyId, req.auth!.role) });
  }),
);

router.post(
  "/:id/revoke",
  asyncHandler(async (req, res) => {
    await revokeInvitation(prisma, req.auth!.companyId, req.auth!.role, req.params.id);
    res.json({ ok: true });
  }),
);

// Attach req.auth when a valid session cookie exists; otherwise stay anon.
async function optionalAuth(req: Request) {
  const { cookiesFromReq, SESSION_COOKIE } = await import("../lib/session");
  const { resolveAuth } = await import("../services/authService");
  const token = cookiesFromReq(req)[SESSION_COOKIE];
  const result = await resolveAuth(prisma, token);
  if (result) req.auth = result.auth;
}

export default router;
