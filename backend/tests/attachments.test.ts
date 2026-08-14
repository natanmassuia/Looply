import { describe, it, expect } from "vitest";
import type { DB } from "../src/lib/db";
import type { ObjectStorage } from "../src/lib/storage";
import {
  MAX_FILE_SIZE_BYTES,
  completeUpload,
  createDownloadUrl,
  createUploadIntent,
  deleteAttachment,
  listJobAttachments,
} from "../src/services/attachmentService";

function makeWorld() {
  const state = {
    jobs: [{ id: "job-a", companyId: "company-a" }, { id: "job-b", companyId: "company-b" }],
    files: [] as any[],
  };
  let next = 0;
  const storage: ObjectStorage & { deleted: string[] } = {
    deleted: [],
    createUploadUrl: async ({ key }) => ({ url: `https://storage.test/put/${key}`, expiresAt: new Date(Date.now() + 600_000) }),
    headObject: async (key) => {
      const file = state.files.find((f) => f.storageKey === key);
      return file?.head ?? null;
    },
    createDownloadUrl: async ({ key }) => ({ url: `https://storage.test/get/${key}`, expiresAt: new Date(Date.now() + 600_000) }),
    deleteObject: async (key) => { storage.deleted.push(key); },
  };
  const db: any = {
    job: {
      findFirst: async ({ where }: any) => state.jobs.find((j) => j.id === where.id && j.companyId === where.companyId) ?? null,
    },
    jobAttachment: {
      create: async ({ data }: any) => {
        const file = { id: `file-${++next}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.files.push(file);
        return file;
      },
      findFirst: async ({ where }: any) => state.files.find((f) => f.id === where.id && f.companyId === where.companyId) ?? null,
      findMany: async ({ where }: any) => state.files.filter((f) => f.companyId === where.companyId && f.jobId === where.jobId),
      updateMany: async ({ where, data }: any) => {
        const file = state.files.find((f) => f.id === where.id && f.companyId === where.companyId && (!where.status || f.status === where.status));
        if (!file) return { count: 0 };
        Object.assign(file, data);
        return { count: 1 };
      },
      deleteMany: async ({ where }: any) => {
        const index = state.files.findIndex((f) => f.id === where.id && f.companyId === where.companyId);
        if (index < 0) return { count: 0 };
        state.files.splice(index, 1);
        return { count: 1 };
      },
    },
  };
  return { db: db as unknown as DB, storage, state };
}

describe("JobAttachment", () => {
  it("creates a pending intent with server-owned opaque key", async () => {
    const { db, storage, state } = makeWorld();
    const result = await createUploadIntent(db, storage, {
      companyId: "company-a",
      jobId: "job-a",
      uploadedByUserId: "user-a",
      originalName: " ../invoice\n.pdf ",
      contentType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(result.file.status).toBe("PENDING");
    expect(result.file.originalName).toBe("../invoice.pdf");
    expect(result.file).not.toHaveProperty("storageKey");
    expect(state.files[0].storageKey).toMatch(/^company\/company-a\/jobs\/job-a\/[^/]+$/);
    expect(result.uploadUrl).toContain("storage.test");
  });

  it("rejects foreign Job and oversized metadata before signing", async () => {
    const { db, storage } = makeWorld();
    await expect(createUploadIntent(db, storage, {
      companyId: "company-a", jobId: "job-b", uploadedByUserId: "user-a",
      originalName: "x.txt", contentType: "text/plain", sizeBytes: 10,
    })).rejects.toMatchObject({ status: 404 });
    await expect(createUploadIntent(db, storage, {
      companyId: "company-a", jobId: "job-a", uploadedByUserId: "user-a",
      originalName: "x.txt", contentType: "text/plain", sizeBytes: MAX_FILE_SIZE_BYTES + 1,
    })).rejects.toMatchObject({ status: 400 });
  });

  it("complete verifies object existence, size and type; repeated complete is idempotent", async () => {
    const { db, storage, state } = makeWorld();
    const result = await createUploadIntent(db, storage, {
      companyId: "company-a", jobId: "job-a", uploadedByUserId: "user-a",
      originalName: "x.txt", contentType: "text/plain", sizeBytes: 10,
    });
    await expect(completeUpload(db, storage, "company-a", result.file.id)).rejects.toMatchObject({ status: 409 });
    state.files[0].head = { sizeBytes: 10, contentType: "text/plain", etag: "etag-1" };
    const available = await completeUpload(db, storage, "company-a", result.file.id);
    expect(available.status).toBe("AVAILABLE");
    expect(available.etag).toBe("etag-1");
    expect(await completeUpload(db, storage, "company-a", result.file.id)).toEqual(available);
  });

  it("rejects object mismatch and keeps file pending", async () => {
    const { db, storage, state } = makeWorld();
    const result = await createUploadIntent(db, storage, {
      companyId: "company-a", jobId: "job-a", uploadedByUserId: "user-a",
      originalName: "x.txt", contentType: "text/plain", sizeBytes: 10,
    });
    state.files[0].head = { sizeBytes: 11, contentType: "text/plain" };
    await expect(completeUpload(db, storage, "company-a", result.file.id)).rejects.toMatchObject({ status: 400 });
    expect(state.files[0].status).toBe("PENDING");
  });

  it("lists minimal metadata, signs only available download, and blocks pending", async () => {
    const { db, storage, state } = makeWorld();
    const result = await createUploadIntent(db, storage, {
      companyId: "company-a", jobId: "job-a", uploadedByUserId: "user-a",
      originalName: "x.txt", contentType: "text/plain", sizeBytes: 10,
    });
    const listed = await listJobAttachments(db, "company-a", "job-a");
    expect(listed[0]).not.toHaveProperty("storageKey");
    await expect(createDownloadUrl(db, storage, "company-a", result.file.id)).rejects.toMatchObject({ status: 409 });
    state.files[0].status = "AVAILABLE";
    const download = await createDownloadUrl(db, storage, "company-a", result.file.id);
    expect(download.url).toContain("storage.test/get");
  });

  it("cross-tenant download/delete and unknown IDs return 404", async () => {
    const { db, storage } = makeWorld();
    await expect(listJobAttachments(db, "company-a", "job-b")).rejects.toMatchObject({ status: 404 });
    await expect(createDownloadUrl(db, storage, "company-b", "missing")).rejects.toMatchObject({ status: 404 });
    await expect(deleteAttachment(db, storage, "company-b", "missing")).rejects.toMatchObject({ status: 404 });
  });

  it("deletes object first and then scoped metadata", async () => {
    const { db, storage, state } = makeWorld();
    const result = await createUploadIntent(db, storage, {
      companyId: "company-a", jobId: "job-a", uploadedByUserId: "user-a",
      originalName: "x.txt", contentType: "text/plain", sizeBytes: 10,
    });
    await deleteAttachment(db, storage, "company-a", result.file.id);
    expect(storage.deleted).toHaveLength(1);
    expect(state.files).toHaveLength(0);
  });
});
