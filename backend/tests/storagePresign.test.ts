import { describe, it, expect, beforeAll, vi } from "vitest";
import type { ObjectStorage } from "../src/lib/storage";

// F14: presigned URLs must be signed against the browser-reachable endpoint,
// never the internal MinIO loopback address.
describe("S3ObjectStorage presign host", () => {
  let storage: ObjectStorage;

  beforeAll(async () => {
    process.env.STORAGE_ENDPOINT = "http://127.0.0.1:9100";
    process.env.STORAGE_PUBLIC_ENDPOINT = "https://looply.verbumlab.com.br/storage";
    process.env.STORAGE_BUCKET = "looply-media";
    process.env.STORAGE_ACCESS_KEY = "test-access";
    process.env.STORAGE_SECRET_KEY = "test-secret";
    process.env.STORAGE_REGION = "us-east-1";
    process.env.STORAGE_FORCE_PATH_STYLE = "true";
    vi.resetModules();
    const mod = await import("../src/lib/storage");
    storage = mod.getObjectStorage();
  });

  it("createUploadUrl returns the public endpoint host, not loopback", async () => {
    const { url } = await storage.createUploadUrl({
      key: "users/usr-1/avatar/abc.png",
      contentType: "image/png",
      sizeBytes: 100,
    });
    expect(url.startsWith("https://looply.verbumlab.com.br/storage/looply-media/")).toBe(true);
    expect(url).not.toContain("127.0.0.1");
    expect(url).toContain("X-Amz-Signature");
  });

  it("createDownloadUrl returns the public endpoint host, not loopback", async () => {
    const { url } = await storage.createDownloadUrl({ key: "company/co-1/logo/abc.png", filename: "logo.png" });
    expect(url.startsWith("https://looply.verbumlab.com.br/storage/looply-media/")).toBe(true);
    expect(url).not.toContain("127.0.0.1");
  });
});
