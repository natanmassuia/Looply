import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler, unauthorized, badRequest } from "../lib/errors";
import { z } from "zod";
import { parse } from "../lib/parse";
import { setSessionCookie, clearSessionCookie, cookiesFromReq, SESSION_COOKIE } from "../lib/session";
import { login, logout, switchCompany } from "../services/authService";
import { checkLoginRate } from "../lib/loginLimiter";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(200),
});

const switchSchema = z.object({ companyId: z.string().min(1).max(64) });

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = parse(loginSchema, req.body);
    const key = `${req.ip ?? "?"}|${input.email.toLowerCase()}`;
    if (!checkLoginRate(key)) {
      throw badRequest("Muitas tentativas. Tente novamente em alguns minutos.");
    }
    const result = await login(prisma, input.email, input.password);
    setSessionCookie(res, result.token);
    res.json({ user: result.user, memberships: result.memberships });
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await logout(prisma, cookiesFromReq(req)[SESSION_COOKIE]);
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = cookiesFromReq(req)[SESSION_COOKIE];
    const auth = req.auth;
    if (!auth || !token) throw unauthorized();
    const [user, memberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, name: true, email: true, active: true },
      }),
      prisma.companyMember.findMany({
        where: { userId: auth.userId, isActive: true, company: { isActive: true } },
        select: {
          companyId: true,
          role: true,
          company: { select: { name: true, isActive: true } },
        },
      }),
    ]);
    if (!user || !user.active) throw unauthorized();
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      activeCompanyId: auth.companyId,
      memberships: memberships.map((m) => ({
        companyId: m.companyId,
        companyName: m.company.name,
        role: m.role,
      })),
    });
  }),
);

router.post(
  "/switch-company",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = cookiesFromReq(req)[SESSION_COOKIE];
    if (!token) throw unauthorized();
    const { companyId } = parse(switchSchema, req.body);
    const auth = await switchCompany(prisma, token, companyId);
    res.json({ activeCompanyId: auth.companyId, role: auth.role });
  }),
);

export default router;
