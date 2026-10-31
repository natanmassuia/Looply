// One-off operator tool: create a review account for visual QA (read-only use
// by the Visant harness). Adds the user as OWNER of the EXISTING company so the
// screens show real data. Prints the password ONCE. Delete after use:
//   DELETE FROM "CompanyMember" WHERE "userId" = (SELECT id FROM "User" WHERE email='claude-review@looply.local');
//   DELETE FROM "User" WHERE email='claude-review@looply.local';
// Run from backend/:  dotenv -e ../.env -- tsx src/scripts/createVisualUser.ts
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/password";

const db = new PrismaClient();
const EMAIL = "claude-review@looply.local";

async function main() {
  const company = await db.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("No company found — nothing to join.");

  const password = randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(password);

  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, active: true },
    create: { name: "Claude Review", email: EMAIL, role: "ADMIN", active: true, passwordHash },
  });

  await db.companyMember.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role: "OWNER", isActive: true },
    create: { userId: user.id, companyId: company.id, role: "OWNER", isActive: true },
  });

  console.log("\n── Conta de review criada ──");
  console.log(`Company:  ${company.name} (${company.id})`);
  console.log(`Email:    ${EMAIL}`);
  console.log(`Senha (uma única vez): ${password}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await db.$disconnect();
    process.exit(1);
  });
