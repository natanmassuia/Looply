// Test-only fixtures for the DB-gated suites. NOT imported by application code
// and NOT part of the dev seed.
//
// - Tenant B ("Teste Corp") is a fixture needed by tenant-isolation tests. It
//   is created at runtime via the real provisioning service and its password is
//   generated per test run (never hardcoded, never committed).
// - Session cleanup: the suites create sessions via login(); teardownFixtureSessions
//   revokes the rows left behind so the dev DB does not accumulate residue.
import { randomBytes } from "node:crypto";
import { prisma, type DB } from "../src/lib/db";
import { login } from "../src/services/authService";
import { hashPassword } from "../src/lib/password";
import { provisionWorkspace } from "../src/services/onboardingService";

const TENANT_B_EMAIL = "dono@testecorp.com";
const TENANT_B_MEMBER_EMAIL = "membro@testecorp.com";
const TENANT_B_COMPANY = "Teste Corp";

export interface TenantBFixture {
  email: string;
  password: string;
  memberEmail: string;
  companyId: string;
  ownerUserId: string;
  memberUserId: string;
}

let tenantBCached: TenantBFixture | undefined;

// Provision the second tenant used to prove tenant isolation. Idempotent per
// process and self-healing across runs: the owner/member password is a fresh
// runtime value each run, the workspace is activated (template + onboarded).
export async function getTenantB(): Promise<TenantBFixture> {
  if (tenantBCached) return tenantBCached;

  const password = `fixture-${randomBytes(9).toString("base64url")}`;
  const passwordHash = await hashPassword(password);

  let owner = await prisma.user.findUnique({ where: { email: TENANT_B_EMAIL } });
  let companyId: string | undefined;
  if (!owner) {
    const prov = await provisionWorkspace(db(), {
      ownerName: "Teste Corp Owner",
      ownerEmail: TENANT_B_EMAIL,
      companyName: TENANT_B_COMPANY,
    });
    owner = await prisma.user.findUnique({ where: { email: TENANT_B_EMAIL } });
    companyId = prov.companyId;
  } else {
    const membership = await prisma.companyMember.findFirst({
      where: { userId: owner.id, company: { name: TENANT_B_COMPANY } },
    });
    companyId = membership?.companyId;
  }
  if (!owner) throw new Error("fixture: tenant B owner not resolvable");
  if (!companyId) {
    const company = await prisma.company.create({ data: { name: TENANT_B_COMPANY, isActive: true } });
    await prisma.companyMember.create({
      data: { userId: owner.id, companyId: company.id, role: "OWNER", isActive: true },
    });
    companyId = company.id;
  }

  // Self-heal the owner and activate the workspace (idempotent across runs).
  await prisma.user.update({
    where: { id: owner.id },
    data: { passwordHash, mustChangePassword: false, active: true },
  });
  await prisma.company.update({
    where: { id: companyId },
    data: { workspaceTemplate: "HIGH_TICKET", onboardedAt: new Date() },
  });

  let member = await prisma.user.findUnique({ where: { email: TENANT_B_MEMBER_EMAIL } });
  if (!member) {
    member = await prisma.user.create({
      data: { name: "Teste Corp Member", email: TENANT_B_MEMBER_EMAIL, role: "EDITOR", active: true, passwordHash },
    });
  } else {
    await prisma.user.update({ where: { id: member.id }, data: { passwordHash, active: true } });
  }
  const existingMembership = await prisma.companyMember.findFirst({ where: { userId: member.id, companyId } });
  if (!existingMembership) {
    await prisma.companyMember.create({
      data: { userId: member.id, companyId, role: "MEMBER", isActive: true },
    });
  }

  // The dashboard isolation contract expects the fixture tenant to own exactly
  // one active client and no jobs. Create it if missing.
  const existingClient = await prisma.client.findFirst({ where: { companyId, name: "Cliente Teste Corp" } });
  if (!existingClient) {
    await prisma.client.create({ data: { companyId, name: "Cliente Teste Corp", status: "ACTIVE" } });
  }

  tenantBCached = {
    email: TENANT_B_EMAIL,
    password,
    memberEmail: TENANT_B_MEMBER_EMAIL,
    companyId,
    ownerUserId: owner.id,
    memberUserId: member.id,
  };
  return tenantBCached;
}

// Login helper for the fixture tenant using its runtime credentials.
export async function tenantBLogin(database: DB) {
  const b = await getTenantB();
  return login(database, b.email, b.password);
}

// Revoke every session created by the suites for the fixture companies
// (Looply Studio from the seed + Teste Corp from getTenantB).
export async function teardownFixtureSessions(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { name: { in: ["Looply Studio", TENANT_B_COMPANY] } },
  });
  const memberships = await prisma.companyMember.findMany({
    where: { companyId: { in: companies.map((c) => c.id) } },
  });
  const userIds = memberships.map((m) => m.userId);
  if (userIds.length === 0) return;
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
}

// Re-exported here so test files can import fixtures only.
export { seedCredentials } from "./seedCredentials";

function db(): DB {
  return prisma;
}