import { describe, it, expect } from "vitest";
import type { DB } from "../src/lib/db";
import type { ObjectStorage } from "../src/lib/storage";
import { cleanupPendingAttachments, reconcileAvailableAttachments } from "../src/services/attachmentReconciliationService";

describe("attachment reconciliation", () => {
  it("marks stale PENDING rows as FAILED", async () => {
    let updated = 0;
    const db: any = { jobAttachment: { updateMany: async ({ where }: any) => { updated = where.status === "PENDING" ? 2 : 0; return { count: updated }; } } };
    const result = await cleanupPendingAttachments(db as DB, new Date());
    expect(result.count).toBe(2);
  });

  it("marks AVAILABLE metadata missing from storage as FAILED", async () => {
    const files = [{ id: "f1", storageKey: "missing" }, { id: "f2", storageKey: "present" }];
    const failed: string[] = [];
    const db: any = {
      jobAttachment: {
        findMany: async () => files,
        updateMany: async ({ where }: any) => (failed.push(where.id), { count: 1 }),
      },
    };
    const storage: ObjectStorage = {
      createUploadUrl: async () => ({ url: "", expiresAt: new Date() }),
      putObject: async () => undefined,
      headObject: async (key) => key === "present" ? { sizeBytes: 1 } : null,
      createDownloadUrl: async () => ({ url: "", expiresAt: new Date() }),
      deleteObject: async () => undefined,
    };
    expect(await reconcileAvailableAttachments(db as DB, storage)).toEqual({ scanned: 2, missing: 1 });
    expect(failed).toEqual(["f1"]);
  });
});
