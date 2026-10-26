// Verbum Lab provisioning CLI — operator tool, NOT an HTTP endpoint.
// Usage:
//   npx tsx src/scripts/provision.ts "Owner Name" owner@email.com "Company Name" \
//     [--phone-number-id <meta_phone_number_id>] [--source-phone <+E164>]
// With --phone-number-id, also creates the company's CUSTOMER_AI WhatsApp
// channel so the new company has a working number in one command.
// Prints the temporary password ONCE. Never logged by the app.
import { PrismaClient } from "@prisma/client";
import { normalizePhoneNumber } from "../lib/phone";
import { provisionWorkspace } from "../services/onboardingService";

const db = new PrismaClient();

export interface ParsedProvisionArgs {
  positionals: string[];
  phoneNumberId?: string;
  sourcePhone?: string;
}

// Pulls out the --phone-number-id / --source-phone flags (each takes the next
// token as its value) and returns the remaining positional arguments.
export function parseProvisionArgs(argv: string[]): ParsedProvisionArgs {
  const positionals: string[] = [];
  let phoneNumberId: string | undefined;
  let sourcePhone: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--phone-number-id") phoneNumberId = argv[++i];
    else if (arg === "--source-phone") sourcePhone = argv[++i];
    else positionals.push(arg);
  }
  return { positionals, phoneNumberId, sourcePhone };
}

async function main() {
  const { positionals, phoneNumberId, sourcePhone } = parseProvisionArgs(process.argv.slice(2));
  const [name, email, companyName] = positionals;
  if (!name || !email || !companyName) {
    console.error('Uso: provision.ts "<nome>" "<email>" "<empresa>" [--phone-number-id <id>] [--source-phone <+E164>]');
    process.exit(1);
  }

  let sourcePhoneNumber: string | null = null;
  if (sourcePhone) {
    sourcePhoneNumber = normalizePhoneNumber(sourcePhone);
    if (!sourcePhoneNumber) {
      console.error(`--source-phone inválido: ${sourcePhone}`);
      process.exit(1);
    }
  }

  const result = await provisionWorkspace(db, { ownerName: name, ownerEmail: email, companyName });
  console.log("Workspace provisionado.");
  console.log(`Company ID: ${result.companyId}`);
  console.log(`Login:      ${result.email}`);
  console.log(`Senha temporária (exibida uma única vez): ${result.temporaryPassword}`);

  if (phoneNumberId) {
    const channel = await db.whatsAppChannel.create({
      data: {
        companyId: result.companyId,
        purpose: "CUSTOMER_AI",
        externalAccountId: phoneNumberId,
        sourcePhoneNumber,
        isActive: true,
      },
      select: { id: true, externalAccountId: true, sourcePhoneNumber: true },
    });
    console.log(`Canal WhatsApp:   ${channel.id} (phone_number_id=${channel.externalAccountId}${channel.sourcePhoneNumber ? `, ${channel.sourcePhoneNumber}` : ""})`);
  }

  await db.$disconnect();
}

if (require.main === module) {
  main().catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await db.$disconnect();
    process.exit(1);
  });
}
