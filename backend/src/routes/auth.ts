import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler, unauthorized, badRequest, conflict, tooManyRequests } from "../lib/errors";
import { z } from "zod";
import { parse } from "../lib/parse";
import { httpsUrl } from "../lib/validation";
import { setSessionCookie, clearSessionCookie, cookiesFromReq, SESSION_COOKIE } from "../lib/session";
import { login, logout, switchCompany } from "../services/authService";
import { checkLoginRate } from "../lib/loginLimiter";
import { PASSWORD_RESET_LIMIT } from "../lib/rateLimit";
import { requireAuth } from "../middleware/requireAuth";
import { demoGuard } from "../middleware/demoGuard";
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

const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(160).optional(),
  phone: z.string().max(40).nullable().optional(),
  avatarUrl: httpsUrl(500).nullable().optional(),
});

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
      workspace: result.workspace,
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
  demoGuard,
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
        select: { id: true, name: true, email: true, phone: true, avatarUrl: true, active: true },
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
          logoUrl: true,
          timezone: true,
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
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

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    const input = parse(updateProfileSchema, req.body);

    if (input.name !== undefined && !input.name.trim()) {
      throw badRequest("Nome não pode ser vazio");
    }

    if (input.email !== undefined) {
      const normalizedEmail = input.email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: { email: normalizedEmail, NOT: { id: auth.userId } },
      });
      if (existing) {
        throw conflict("Já existe um usuário cadastrado com este e-mail");
      }
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.toLowerCase().trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ? input.phone.trim() : null } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true },
    });

    res.json({ user: updated });
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

// ── Password Recovery & Reset ──────────────────────────────────────────────
const recoverySchema = z.object({
  email: z.string().email().max(160),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(256),
  password: z.string().min(1).max(200),
});

router.post(
  "/password-recovery",
  asyncHandler(async (req, res) => {
    const input = parse(recoverySchema, req.body);
    const { mailService } = await import("../services/mailService");
    const { requestPasswordRecovery } = await import("../services/recoveryService");
    const result = await requestPasswordRecovery(prisma, mailService, input.email, req.ip);
    res.json(result);
  }),
);

router.post(
  "/password-reset",
  PASSWORD_RESET_LIMIT,
  asyncHandler(async (req, res) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    const { resetPasswordWithToken } = await import("../services/recoveryService");
    const result = await resetPasswordWithToken(prisma, token, password);
    res.json(result);
  }),
);

export default router;
