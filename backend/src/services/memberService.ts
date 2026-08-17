import type { DB } from "../lib/db";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { hashPassword, hashToken } from "../lib/password";
import { randomToken } from "../lib/token";
import { MIN_PASSWORD_LENGTH } from "./onboardingService";

type MemberRoleName = "OWNER" | "ADMIN" | "MEMBER";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Members ──────────────────────────────────────────────────────────────
export async function listMembers(db: DB, companyId: string) {
  return db.companyMember.findMany({
    where: { companyId },
    select: {
      id: true,
      role: true,
      isActive: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true, active: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// Role-change / deactivate rules (smallest safe model):
// - Only OWNERS manage roles and OWNER status.
// - A company must always keep at least one active OWNER.
export async function updateMember(
  db: DB,
  companyId: string,
  memberRecordId: string,
  actorRole: string,
  patch: { role?: string; isActive?: boolean },
) {
  const member = await db.companyMember.findFirst({ where: { id: memberRecordId, companyId } });
  if (!member) throw notFound("Membro não encontrado");
  if (actorRole !== "OWNER") throw forbidden("Apenas OWNER gerencia membros");

  const demotingSelf =
    (patch.role !== undefined && patch.role !== "OWNER" && member.role === "OWNER") ||
    patch.isActive === false;

  if (demotingSelf) {
    const activeOwners = await db.companyMember.count({
      where: { companyId, role: "OWNER", isActive: true },
    });
    // If this member is the last active OWNER, refuse.
    if (member.role === "OWNER" && member.isActive && activeOwners <= 1) {
      throw conflict("A empresa precisa de pelo menos um OWNER ativo");
    }
  }

  const data: { role?: MemberRoleName; isActive?: boolean } = {};
  if (patch.role !== undefined) {
    if (!["OWNER", "ADMIN", "MEMBER"].includes(patch.role)) throw badRequest("Role inválida");
    data.role = patch.role as MemberRoleName;
  }
  if (patch.isActive !== undefined) data.isActive = patch.isActive;

  const updated = await db.companyMember.updateMany({ where: { id: memberRecordId, companyId }, data });
  if (updated.count === 0) throw notFound("Membro não encontrado");
  return db.companyMember.findFirst({ where: { id: memberRecordId, companyId } });
}

// ── Invitations ──────────────────────────────────────────────────────────
export async function createInvitation(
  db: DB,
  auth: { userId: string; companyId: string; role: string },
  input: { email: string; role: MemberRoleName },
): Promise<{ invitationId: string; token: string; expiresAt: Date }> {
  if (auth.role !== "OWNER" && auth.role !== "ADMIN") throw forbidden();
  if (!["ADMIN", "MEMBER"].includes(input.role)) throw badRequest("Role inválida");
  // ADMINs can only invite MEMBERs; OWNER invites any.
  if (auth.role === "ADMIN" && input.role === "ADMIN") {
    throw forbidden("Apenas OWNER pode convidar ADMIN");
  }
  if (auth.role !== "OWNER" && input.role !== "MEMBER") throw forbidden();

  const email = input.email.toLowerCase();
  const company = await db.company.findUnique({
    where: { id: auth.companyId },
    select: { onboardedAt: true, isActive: true },
  });
  if (!company || !company.isActive || !company.onboardedAt) {
    throw conflict("Workspace precisa estar ativo para convidar");
  }

  const existingMember = await db.companyMember.findFirst({
    where: { companyId: auth.companyId, user: { email } },
  });
  if (existingMember) throw conflict("Usuário já é membro");

  const pending = await db.invitation.findFirst({
    where: { companyId: auth.companyId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending) throw conflict("Convite pendente já existe para este e-mail");

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invitation = await db.invitation.create({
    data: {
      companyId: auth.companyId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedByUserId: auth.userId,
      expiresAt,
    },
  });
  // Token plaintext returned ONCE; only the hash is stored.
  return { invitationId: invitation.id, token, expiresAt };
}

export async function revokeInvitation(db: DB, companyId: string, actorRole: string, invitationId: string) {
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") throw forbidden();
  const invitation = await db.invitation.findFirst({ where: { id: invitationId, companyId } });
  if (!invitation) throw notFound("Convite não encontrado");
  if (invitation.acceptedAt || invitation.revokedAt) throw conflict("Convite já finalizado");
  await db.invitation.updateMany({ where: { id: invitationId, companyId }, data: { revokedAt: new Date() } });
}

export async function listInvitations(db: DB, companyId: string, actorRole: string) {
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") throw forbidden();
  return db.invitation.findMany({
    where: { companyId },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Accept invitation (invitation-scoped signup — NOT public) ────────────
// token identifies company/email/role. Two paths:
//  a) user does not exist yet → name + newPassword required → user created;
//  b) user already exists → must be authenticated as that exact email.
export async function acceptInvitation(
  db: DB,
  input: { token: string; name?: string; password?: string; authUserId?: string },
): Promise<{ userId: string; companyId: string; role: string; email: string }> {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });
  if (!invitation) throw badRequest("Convite inválido");
  if (invitation.revokedAt) throw badRequest("Convite revogado");
  if (invitation.acceptedAt) throw badRequest("Convite já utilizado");
  if (invitation.expiresAt < new Date()) throw badRequest("Convite expirado");

  const company = await db.company.findUnique({
    where: { id: invitation.companyId },
    select: { onboardedAt: true, isActive: true },
  });
  if (!company || !company.isActive || !company.onboardedAt) {
    throw badRequest("Workspace não está ativo");
  }

  const existing = await db.user.findUnique({ where: { email: invitation.email } });

  let userId: string;
  if (existing) {
    if (!input.authUserId || input.authUserId !== existing.id) {
      throw forbidden("Faça login com o e-mail do convite para aceitá-lo");
    }
    userId = existing.id;
  } else {
    if (!input.name || !input.password) throw badRequest("Nome e senha são obrigatórios");
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
    }
    const created = await db.user.create({
      data: {
        name: input.name,
        email: invitation.email,
        active: true,
        passwordHash: await hashPassword(input.password),
        mustChangePassword: false, // they just chose their own password
      },
    });
    userId = created.id;
  }

  const already = await db.companyMember.findFirst({
    where: { companyId: invitation.companyId, userId },
  });
  if (already) throw conflict("Usuário já é membro");

  await db.companyMember.create({
    data: { userId, companyId: invitation.companyId, role: invitation.role, isActive: true },
  });
  await db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });

  return { userId, companyId: invitation.companyId, role: invitation.role, email: invitation.email };
}

// ── Reset Member Password (Administrative credential reset) ───────────────
export async function resetMemberPassword(
  db: DB,
  companyId: string,
  actorUserId: string,
  actorRole: string,
  memberRecordId: string,
): Promise<{ temporaryPassword: string; user: { id: string; name: string; email: string } }> {
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") throw forbidden("Sem permissão para redefinir senha");

  const member = await db.companyMember.findFirst({
    where: { id: memberRecordId, companyId },
    include: { user: true },
  });
  if (!member) throw notFound("Membro não encontrado");

  // Prevent self-reset via administrative endpoint (must use /api/auth/change-password)
  if (member.userId === actorUserId) {
    throw badRequest("Para alterar sua própria senha, utilize a alteração de senha do perfil.");
  }

  // ADMIN cannot reset password for OWNER or ADMIN
  if (actorRole === "ADMIN" && (member.role === "OWNER" || member.role === "ADMIN")) {
    throw forbidden("Administradores não podem redefinir senha de outros administradores ou proprietários");
  }

  // Generate secure 12-char temporary password (alphanumeric)
  const tempPassword = randomToken(12);

  // Update passwordHash and force change on next login
  await db.user.update({
    where: { id: member.userId },
    data: {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    },
  });

  // Revoke all active sessions for target user
  await db.session.updateMany({
    where: { userId: member.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return {
    temporaryPassword: tempPassword,
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
    },
  };
}
