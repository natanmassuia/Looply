import { withTransaction } from "../lib/withTransaction";
import type { DB } from "../lib/db";
import { badRequest, tooManyRequests } from "../lib/errors";
import { hashPassword, hashToken } from "../lib/password";
import { randomToken } from "../lib/token";
import { checkLoginRate } from "../lib/loginLimiter";
import { assertNewPasswordOk } from "./onboardingService";
import type { MailService } from "./mailService";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordRecovery(
  db: DB,
  mail: MailService,
  rawEmail: string,
  clientIp?: string,
): Promise<{ ok: boolean; message: string; simulated?: boolean }> {
  const email = (rawEmail || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    throw badRequest("E-mail inválido.");
  }

  const key = `recovery|${clientIp ?? "?"}|${email}`;
  if (!checkLoginRate(key)) {
    throw tooManyRequests("Muitas tentativas. Tente novamente em alguns minutos.");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, active: true },
  });

  if (user && user.active) {
    // Invalidate existing unused tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomToken(32);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt,
        usedAt: null,
      },
    });

    try {
      await mail.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token: rawToken,
      });
    } catch {
      // Mail service failures shouldn't leak account state
    }
  }

  // Always return neutral success message (zero enumeration)
  return {
    ok: true,
    message: "Se o e-mail estiver cadastrado, você receberá as instruções em poucos minutos.",
  };
}

export async function resetPasswordWithToken(
  db: DB,
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  if (!token || typeof token !== "string" || !token.trim()) {
    throw badRequest("Token de recuperação inválido.");
  }

  assertNewPasswordOk(newPassword);

  const tokenHash = hashToken(token.trim());
  const resetRecord = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
    throw badRequest("Link de recuperação inválido ou expirado.");
  }

  if (!resetRecord.user || !resetRecord.user.active) {
    throw badRequest("Usuário inativo ou não encontrado.");
  }

  const passwordHash = await hashPassword(newPassword);

  // Update password, consume reset token, and invalidate all active sessions
  // atomically: a failure must not leave a reusable token with a new password.
  await withTransaction(db, async (tx) => {
    await tx.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await tx.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });
    await tx.session.updateMany({
      where: { userId: resetRecord.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  return {
    ok: true,
    message: "Senha redefinida com sucesso. Faça login com sua nova senha.",
  };
}
