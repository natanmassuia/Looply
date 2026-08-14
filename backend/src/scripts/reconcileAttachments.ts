// Operational B12 command. It never creates local files or exposes secrets.
// Run with configured private object storage:
//   npx dotenv -e ../.env -- tsx src/scripts/reconcileAttachments.ts
import { PrismaClient } from "@prisma/client";
import { getObjectStorage } from "../lib/storage";
import { cleanupPendingAttachments, reconcileAvailableAttachments } from "../services/attachmentReconciliationService";

const db = new PrismaClient();

async function main() {
  const pending = await cleanupPendingAttachments(db, new Date(Date.now() - 24 * 60 * 60 * 1000));
  const storage = getObjectStorage();
  const available = await reconcileAvailableAttachments(db, storage);
  console.log(JSON.stringify({ pendingMarkedFailed: pending.count, available }));
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exit(1);
});
