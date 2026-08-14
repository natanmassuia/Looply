import type { DB } from "../lib/db";
import type { ObjectStorage } from "../lib/storage";

export async function cleanupPendingAttachments(db: DB, olderThan: Date) {
  return db.jobAttachment.updateMany({
    where: { status: "PENDING", createdAt: { lt: olderThan } },
    data: { status: "FAILED" },
  });
}

export async function reconcileAvailableAttachments(db: DB, storage: ObjectStorage, limit = 500) {
  const files = await db.jobAttachment.findMany({
    where: { status: "AVAILABLE" },
    take: Math.min(500, Math.max(1, limit)),
    select: { id: true, storageKey: true },
  });
  let missing = 0;
  for (const file of files) {
    const object = await storage.headObject(file.storageKey);
    if (!object) {
      await db.jobAttachment.updateMany({ where: { id: file.id, status: "AVAILABLE" }, data: { status: "FAILED" } });
      missing += 1;
    }
  }
  return { scanned: files.length, missing };
}
