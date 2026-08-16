import type { DB } from "../lib/db";
import { conflict, badRequest } from "../lib/errors";
import { hashPassword } from "../lib/password";
import { randomBytes } from "node:crypto";
import { resolveAppearance, type WorkspaceAppearance } from "../domain/appearance";

// ── Verbum Lab provisioning (no public signup, no HTTP endpoint) ──────────
// Creates User (temp password), Company (UNCONFIGURED) and OWNER membership.
// The plaintext temp password is returned ONCE to the CLI operator and never
// stored/logged.
export interface ProvisionResult {
  companyId: string;
  userId: string;
  email: string;
  temporaryPassword: string;
}

export async function provisionWorkspace(
  db: DB,
  input: { ownerName: string; ownerEmail: string; companyName: string },
): Promise<ProvisionResult> {
  const email = input.ownerEmail.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw conflict("E-mail já possui conta");

  const temporaryPassword = randomBytes(12).toString("base64url"); // ~96 bits
  const passwordHash = await hashPassword(temporaryPassword);

  const [user, company] = await Promise.all([
    db.user.create({
      data: {
        name: input.ownerName,
        email,
        active: true,
        passwordHash,
        mustChangePassword: true,
      },
    }),
    db.company.create({
      data: { name: input.companyName, isActive: true }, // template/onboarding pending
    }),
  ]);

  await db.companyMember.create({
    data: { userId: user.id, companyId: company.id, role: "OWNER", isActive: true },
  });

  return {
    companyId: company.id,
    userId: user.id,
    email,
    temporaryPassword,
  };
}

// ── Forced password change ───────────────────────────────────────────────
export const MIN_PASSWORD_LENGTH = 10;

export function assertNewPasswordOk(password: unknown) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    throw badRequest(`Senha deve ter entre ${MIN_PASSWORD_LENGTH} e 200 caracteres`);
  }
}

// ── Onboarding ───────────────────────────────────────────────────────────
export interface OnboardingStatus {
  mustChangePassword: boolean;
  company: {
    name: string;
    website: string | null;
    timezone: string;
    locale: string;
    template: string | null;
    onboardedAt: string | null;
  };
  appearance: WorkspaceAppearance;
  readyToComplete: boolean;
  status: "PASSWORD_CHANGE_REQUIRED" | "ONBOARDING_REQUIRED" | "ACTIVE";
}

export async function getOnboardingStatus(
  db: DB,
  auth: { userId: string; companyId: string },
): Promise<OnboardingStatus> {
  const [user, company] = await Promise.all([
    db.user.findUnique({ where: { id: auth.userId }, select: { mustChangePassword: true } }),
    db.company.findUnique({
      where: { id: auth.companyId },
      select: {
        name: true,
        website: true,
        timezone: true,
        locale: true,
        workspaceTemplate: true,
        onboardedAt: true,
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
  if (!user || !company) throw badRequest("Workspace inválido");

  const readyToComplete =
    !user.mustChangePassword &&
    company.name.trim().length > 0 &&
    company.workspaceTemplate !== null;

  let status: OnboardingStatus["status"];
  if (company.onboardedAt) status = "ACTIVE";
  else if (user.mustChangePassword) status = "PASSWORD_CHANGE_REQUIRED";
  else status = "ONBOARDING_REQUIRED";

  return {
    mustChangePassword: user.mustChangePassword,
    company: {
      name: company.name,
      website: company.website,
      timezone: company.timezone,
      locale: company.locale,
      template: company.workspaceTemplate,
      onboardedAt: company.onboardedAt ? company.onboardedAt.toISOString() : null,
    },
    appearance: resolveAppearance(company),
    readyToComplete,
    status,
  };
}

const TEMPLATES = ["LOCAL_BUSINESS", "HIGH_TICKET", "MARKETING_AGENCY"] as const;
export type TemplateName = (typeof TEMPLATES)[number];

export async function selectTemplate(
  db: DB,
  companyId: string,
  template: string,
): Promise<TemplateName> {
  if (!TEMPLATES.includes(template as TemplateName)) {
    throw badRequest("Template inválido");
  }
  const company = await db.company.findUnique({ where: { id: companyId }, select: { onboardedAt: true } });
  if (!company) throw badRequest("Workspace inválido");
  // Governance: template selection only works BEFORE activation.
  if (company.onboardedAt) throw conflict("Workspace já ativado — troca de template é operação governada");
  await db.company.update({ where: { id: companyId }, data: { workspaceTemplate: template as TemplateName } });
  return template as TemplateName;
}

export async function completeOnboarding(db: DB, auth: { userId: string; companyId: string }) {
  const status = await getOnboardingStatus(db, auth);
  if (status.status === "ACTIVE") return status; // idempotent
  if (!status.readyToComplete) throw badRequest("Onboarding incompleto");
  await db.company.update({
    where: { id: auth.companyId },
    data: { onboardedAt: new Date() },
  });
  return getOnboardingStatus(db, auth);
}
