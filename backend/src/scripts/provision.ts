// Verbum Lab provisioning CLI — operator tool, NOT an HTTP endpoint.
// Usage:
//   npx tsx src/scripts/provision.ts "Owner Name" owner@email.com "Company Name"
// Prints the temporary password ONCE. Never logged by the app.
import { PrismaClient } from "@prisma/client";
import { provisionWorkspace } from "../services/onboardingService";

const db = new PrismaClient();

async function main() {
  const [name, email, companyName] = process.argv.slice(2);
  if (!name || !email || !companyName) {
    console.error('Uso: provision.ts "<nome>" "<email>" "<empresa>"');
    process.exit(1);
  }
  const result = await provisionWorkspace(db, { ownerName: name, ownerEmail: email, companyName });
  console.log("Workspace provisionado.");
  console.log(`Company ID: ${result.companyId}`);
  console.log(`Login:      ${result.email}`);
  console.log(`Senha temporária (exibida uma única vez): ${result.temporaryPassword}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
