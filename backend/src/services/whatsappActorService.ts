import type { DB } from "../lib/db";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { capabilitiesForTemplate, type Capability } from "../domain/capabilities";
import { normalizePhoneNumber } from "../lib/phone";

// ── WhatsApp actor resolution (A3.0) ─────────────────────────────────────
// A WhatsAppIdentity row NEVER grants access by itself. Resolution proves:
// identity exists AND enabled AND user active AND active CompanyMember for
// (userId, companyId) AND company active with a workspace template. Only then
// are capabilities derived from the canonical company template. Client contact
// phones are never consulted.

export interface WhatsAppActor {
  userId: string;
  companyId: string;
  capabilities: Capability[];
}

export async function resolveWhatsAppActor(
  db: DB,
  provider: string,
  senderPhone: string,
): Promise<WhatsAppActor | null> {
  const phoneNumber = normalizePhoneNumber(senderPhone);
  if (!phoneNumber) return null;

  const identity = await db.whatsAppIdentity.findUnique({
    where: { provider_phoneNumber: { provider, phoneNumber } },
    select: {
      userId: true,
      companyId: true,
      enabled: true,
      user: { select: { id: true, active: true } },
      company: { select: { id: true, isActive: true, workspaceTemplate: true } },
    },
  });
  if (!identity || !identity.enabled) return null;
  if (!identity.user || !identity.user.active) return null;
  if (!identity.company || !identity.company.isActive || !identity.company.workspaceTemplate) return null;

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: identity.userId, companyId: identity.companyId } },
    select: { isActive: true },
  });
  if (!membership || !membership.isActive) return null;

  return {
    userId: identity.userId,
    companyId: identity.companyId,
    capabilities: capabilitiesForTemplate(identity.company.workspaceTemplate),
  };
}

export const WHATSAPP_IDENTITY_PROVIDER = "whatsapp";

export interface ProvisionWhatsAppIdentityInput {
  userId: string;
  phoneNumber: string;
  label?: string;
}

// Controlled provisioning: OWNER/ADMIN of the authenticated company only.
// companyId comes exclusively from the auth context; the target user must
// hold an active membership in that same company. Callers cannot supply any
// role/capability authority.
export async function provisionWhatsAppIdentity(
  db: DB,
  auth: { companyId: string; role: string },
  input: ProvisionWhatsAppIdentityInput,
) {
  if (auth.role === "MEMBER") throw forbidden();
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  if (!phoneNumber) throw badRequest("Telefone inválido");

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: input.userId, companyId: auth.companyId } },
    select: { id: true, isActive: true },
  });
  if (!membership || !membership.isActive) throw notFound("Usuário não encontrado neste workspace");

  const duplicate = await db.whatsAppIdentity.findUnique({
    where: { provider_phoneNumber: { provider: WHATSAPP_IDENTITY_PROVIDER, phoneNumber } },
    select: { id: true },
  });
  if (duplicate) throw conflict("Este telefone já está mapeado");

  return db.whatsAppIdentity.create({
    data: {
      userId: input.userId,
      companyId: auth.companyId,
      provider: WHATSAPP_IDENTITY_PROVIDER,
      phoneNumber,
      label: input.label ?? null,
      enabled: true,
    },
    select: { id: true, userId: true, companyId: true, provider: true, phoneNumber: true, enabled: true, label: true, createdAt: true },
  });
}
