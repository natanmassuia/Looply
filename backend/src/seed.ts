// Development seed for Looply.
// Run: npm --prefix backend run seed   (needs DATABASE_URL)
// Creates the initial tenant, admin user, and default workflow.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./lib/password";
import { assertSeedAllowed } from "./lib/seedGuard";
import { ensureDefaultWorkflow } from "./services/workflowService";

const db = new PrismaClient();

async function main() {
  assertSeedAllowed();
  // ── Company (tenant) ────────────────────────────────────────────────
  const company = await db.company.upsert({
    where: { slug: "looply-studio" },
    update: { workspaceTemplate: "MARKETING_AGENCY", onboardedAt: new Date() },
      create: {
        name: "Looply Studio",
        slug: "looply-studio",
        isActive: true,
        workspaceTemplate: "MARKETING_AGENCY",
        onboardedAt: new Date(),
      },
  });

  // Admin credentials come from env — the seed refuses to run with a
  // hardcoded fallback password.
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedAdminEmail || !seedAdminPassword) {
    throw new Error(
      "Seed refused: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required (no fallback credentials). Set them in .env before running the seed.",
    );
  }
  const demoHash = await hashPassword(seedAdminPassword);

  // ── Admin user (bootstrap) ──────────────────────────────────────────
  const adminName = seedAdminEmail.split("@")[0];
  const admin = await db.user.upsert({
    where: { email: seedAdminEmail },
    update: { name: adminName },
    create: { name: adminName, email: seedAdminEmail, role: "ADMIN", active: true, passwordHash: demoHash },
  });

  // ── Membership ──────────────────────────────────────────────────────
  await db.companyMember.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: company.id } },
    update: { role: "OWNER" },
    create: { userId: admin.id, companyId: company.id, role: "OWNER", isActive: true },
  });

  // ── Default workflow ────────────────────────────────────────────────
  await ensureDefaultWorkflow(db, company.id);

  console.log("\n── Looply seed concluído ──");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
