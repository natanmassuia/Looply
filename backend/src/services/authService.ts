import type { DB } from "../lib/db";
import { unauthorized, forbidden } from "../lib/errors";
import { hashPassword, verifyPassword, newSessionToken, hashToken } from "../lib/password";
import { SESSION_TTL_MS } from "../lib/session";
import { resolveWorkspaceContext, type WorkspaceContext } from "../domain/capabilities";

// ── AuthContext: what every authenticated handler receives ────────────────
export interface AuthContext {
  userId: string;
  companyId: string;
  role: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  role: string;
  mustChangePassword: boolean;
}

export interface MembershipInfo {
  companyId: string;
  companyName: string;
  role: string;
}

// ── Login ────────────────────────────────────────────────────────────────
// Dummy hash so verifyPassword always runs scrypt once, even for unknown
// emails — login response time does not reveal whether the email exists.
const DUMMY_HASH =
  "scrypt$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

export async function login(
  db: DB,
  email: string,
  password: string,
): Promise<{
  token: string;
  user: SessionUser;
  memberships: MembershipInfo[];
  workspace: WorkspaceContext;
}> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  // One generic failure for every bad-login case — no user enumeration.
  if (!user || !ok || !user.active) {
    throw unauthorized("Credenciais inválidas");
  }

  const memberships = await db.companyMember.findMany({
    where: { userId: user.id, isActive: true, company: { isActive: true } },
    include: {
      company: {
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
      },
    },
  });
  if (memberships.length === 0) {
    throw forbidden("Usuário sem workspace ativo");
  }

  const token = newSessionToken();
  await db.session.create({
    data: {
      id: hashToken(token),
      userId: user.id,
      companyId: memberships[0].companyId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      companyId: memberships[0].companyId,
      role: memberships[0].role,
      mustChangePassword: user.mustChangePassword,
    },
    memberships: memberships.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      role: m.role,
    })),
    // Workspace state at login time — same shape as /api/auth/me, so the
    // frontend routes to the right first-access gate immediately.
    workspace: resolveWorkspaceContext(memberships[0].company),
  };
}

// ── Session resolution (per request) ─────────────────────────────────────
// Validates session → user → membership against the DB every time, so a
// revoked session, disabled user or removed membership takes effect
// immediately. Returns null when the request is not authenticatable.
export async function resolveAuth(
  db: DB,
  token: string | undefined,
): Promise<{ auth: AuthContext; mustChangePassword: boolean } | null> {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;

  // Active company: session's stored preference, else first active membership.
  let membership = session.companyId
    ? await db.companyMember.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: session.companyId } },
      })
    : null;
  if (!membership || !membership.isActive) {
    membership = await db.companyMember.findFirst({ where: { userId: user.id, isActive: true } });
  }
  if (!membership || !membership.isActive) return null;

  const company = await db.company.findUnique({ where: { id: membership.companyId } });
  if (!company || !company.isActive) return null;

  return {
    auth: { userId: user.id, companyId: membership.companyId, role: membership.role },
    mustChangePassword: user.mustChangePassword,
  };
}

// ── Logout ───────────────────────────────────────────────────────────────
export async function logout(db: DB, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.session.update({
    where: { id: hashToken(token) },
    data: { revokedAt: new Date() },
  }).catch(() => undefined); // idempotent: unknown/expired session is fine
}

// ── Switch active workspace ──────────────────────────────────────────────
// companyId from the client is only a REQUEST; access is granted solely by
// an active membership.
export async function switchCompany(
  db: DB,
  token: string,
  companyId: string,
): Promise<AuthContext> {
  const session = await db.session.findUnique({ where: { id: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw unauthorized("Sessão inválida");
  }
  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.userId, companyId } },
  });
  if (!membership || !membership.isActive) {
    throw forbidden("Sem acesso a este workspace");
  }
  await db.session.update({
    where: { id: session.id },
    data: { companyId: membership.companyId },
  });
  return {
    userId: session.userId,
    companyId: membership.companyId,
    role: membership.role,
  };
}

export { hashPassword };
