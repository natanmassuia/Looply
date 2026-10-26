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

const SEED_COMPANY = "Looply Studio";
const DEMO_CLIENT = "Cliente Demo";
const DEMO_JOB = "Demanda Demo";
// A fixed demo publication date; the calendar suite derives its query window
// from the job's own dates, so the exact value is irrelevant as long as it is
// stable across runs.
const DEMO_PUBLICATION_TARGET = new Date("2026-09-15T12:00:00.000Z");

export interface SeedWorkspaceData {
  companyId: string;
  clientId: string;
  jobId: string;
}

let seedWorkspaceCached: SeedWorkspaceData | undefined;

// The DB-gated integration suites (clients, dashboard, calendar, approval,
// jobs/workflow) assert that the seeded workspace ("Looply Studio") owns demo
// data. The base seed (src/seed.ts) only creates the tenant + admin + workflow,
// so these fixtures provision one active client and one job (with a publication
// target) at runtime — idempotently, like getTenantB. Never part of the dev/
// prod seed.
export async function ensureSeedWorkspaceData(): Promise<SeedWorkspaceData> {
  if (seedWorkspaceCached) return seedWorkspaceCached;

  const company = await prisma.company.findFirst({ where: { name: SEED_COMPANY } });
  if (!company) {
    throw new Error(
      `fixture: seed company "${SEED_COMPANY}" not found — run the seed (SEED_ADMIN_* + tsx src/seed.ts) first`,
    );
  }

  const workflow = await prisma.workflowDefinition.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const firstStage = workflow
    ? await prisma.workflowStage.findFirst({
        where: { workflowId: workflow.id, active: true },
        orderBy: { position: "asc" },
        select: { id: true },
      })
    : null;

  let client = await prisma.client.findFirst({
    where: { companyId: company.id, name: DEMO_CLIENT },
  });
  if (!client) {
    client = await prisma.client.create({
      data: { companyId: company.id, name: DEMO_CLIENT, status: "ACTIVE", channels: [] },
    });
  }

  let job = await prisma.job.findFirst({
    where: { companyId: company.id, clientId: client.id, title: DEMO_JOB },
  });
  if (!job) {
    job = await prisma.job.create({
      data: {
        companyId: company.id,
        clientId: client.id,
        title: DEMO_JOB,
        format: "POST",
        workflowId: workflow?.id ?? null,
        currentStageId: firstStage?.id ?? null,
        publicationTarget: DEMO_PUBLICATION_TARGET,
      },
    });
  }

  // Approvals are created against a JobVersion; ensure the demo job has one.
  const existingVersion = await prisma.jobVersion.findFirst({ where: { contentId: job.id } });
  if (!existingVersion) {
    await prisma.jobVersion.create({
      data: { contentId: job.id, versionNumber: 1, caption: "Versão demo" },
    });
  }

  seedWorkspaceCached = { companyId: company.id, clientId: client.id, jobId: job.id };
  return seedWorkspaceCached;
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