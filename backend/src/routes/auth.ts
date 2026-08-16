import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler, unauthorized } from "../lib/errors";
import { tooManyRequests } from "../lib/errors";
import { z } from "zod";
import { parse } from "../lib/parse";
import { setSessionCookie, clearSessionCookie, cookiesFromReq, SESSION_COOKIE } from "../lib/session";
import { login, logout, switchCompany } from "../services/authService";
import { checkLoginRate } from "../lib/loginLimiter";
import { requireAuth } from "../middleware/requireAuth";
import { resolveWorkspaceContext } from "../domain/capabilities";
import { assertNewPasswordOk } from "../services/onboardingService";
import { hashPassword, newSessionToken, hashToken } from "../lib/password";
import { SESSION_TTL_MS } from "../lib/session";

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
      throw tooManyRequests("Muitas tentativas. Tente novamente em alguns minutos.");
    }
    const result = await login(prisma, input.email, input.password);
    setSessionCookie(res, result.token);
    res.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        companyId: result.user.companyId,
        role: result.user.role,
      },
      mustChangePassword: result.user.mustChangePassword,
      memberships: result.memberships,
    });
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

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { newPassword } = parse(
      z.object({ newPassword: z.string().min(1).max(200) }),
      req.body,
    );
    assertNewPasswordOk(newPassword);
    const auth = req.auth!;
    const userId = auth.userId;

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    // Invalidate ALL sessions (old temp-password sessions die), then issue a
    // fresh session for the current login.
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const token = newSessionToken();
    await prisma.session.create({
      data: {
        id: hashToken(token),
        userId,
        companyId: auth.companyId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    setSessionCookie(res, token);
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
    const [user, memberships, company] = await Promise.all([
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
      prisma.company.findUnique({
        where: { id: auth.companyId },
        select: {
          id: true,
          name: true,
          workspaceTemplate: true,
          appearancePreset: true,
          appearanceMode: true,
          appearanceCustomPrimary: true,
          appearanceCustomSecondary: true,
          appearanceCustomAccent: true,
          appearanceCustomSurface: true,
          appearanceCustomText: true,
          appearanceCustomBorder: true,
        },
      }),
    ]);
    if (!user || !user.active) throw unauthorized();
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      activeCompanyId: auth.companyId,
      mustChangePassword: req.mustChangePassword === true,
      memberships: memberships.map((m) => ({
        companyId: m.companyId,
        companyName: m.company.name,
        role: m.role,
      })),
      workspace: company ? resolveWorkspaceContext(company) : null,
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
