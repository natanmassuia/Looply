import { describe, expect, it } from "vitest";
import type { TransientStore } from "../src/lib/transientStore";
import { transientStoreFromEnv } from "../src/lib/transientStore";
import {
  CONFIRMATION_TTL_SECONDS,
  clearPendingConfirmation,
  consumePendingConfirmation,
  getPendingConfirmation,
  savePendingConfirmation,
} from "../src/services/assistantConfirmationStore";
import {
  IDEMPOTENCY_TTL_SECONDS,
  claimInboundMessage,
} from "../src/services/whatsappIdempotencyStore";

class FakeTransientStore implements TransientStore {
  data = new Map<string, { value: string; expiresAt: number }>();
  unavailable = false;

  private guard() {
    if (this.unavailable) throw new Error("transient store unavailable");
  }

  async get(key: string) {
    this.guard();
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.guard();
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    this.guard();
    const existing = await this.get(key);
    if (existing !== null) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async getAndDelete(key: string) {
    this.guard();
    const entry = this.data.get(key);
    this.data.delete(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) return null;
    return entry.value;
  }

  async delete(key: string) {
    this.guard();
    this.data.delete(key);
  }
}

const command = { operation: "ticket.delete", payload: { jobId: "j1" } } as const;

describe("transient store abstraction", () => {
  it("supports set/get/delete with TTL semantics", async () => {
    const store = new FakeTransientStore();
    await store.set("k", "v", 60);
    expect(await store.get("k")).toBe("v");
    await store.delete("k");
    expect(await store.get("k")).toBeNull();
  });

  it("setIfAbsent succeeds once and rejects duplicates before expiry", async () => {
    const store = new FakeTransientStore();
    expect(await store.setIfAbsent("k", "v", 60)).toBe(true);
    expect(await store.setIfAbsent("k", "other", 60)).toBe(false);
    expect(await store.get("k")).toBe("v");
  });

  it("returns null for expired keys", async () => {
    const store = new FakeTransientStore();
    await store.set("k", "v", 60);
    store.data.get("k")!.expiresAt = Date.now() - 1;
    expect(await store.get("k")).toBeNull();
  });

  it("factory maps env to a Redis store or null, never to process memory", () => {
    expect(transientStoreFromEnv(undefined)).toBeNull();
    expect(transientStoreFromEnv("")).toBeNull();
    expect(transientStoreFromEnv("redis://localhost:6379")).toBeDefined();
  });
});

describe("pending confirmation state", () => {
  it("saves and reads the exact command with authority fields intact", async () => {
    const store = new FakeTransientStore();
    await savePendingConfirmation(store, { companyId: "cA", userId: "u1", command, createdAt: new Date().toISOString(), expiresAt: "", correlationId: "wamid.X" });
    const loaded = await getPendingConfirmation(store, "cA", "u1");
    expect(loaded?.companyId).toBe("cA");
    expect(loaded?.userId).toBe("u1");
    expect(loaded?.command).toEqual(command);
    expect(loaded?.correlationId).toBe("wamid.X");
  });

  it("scopes records per company and user", async () => {
    const store = new FakeTransientStore();
    await savePendingConfirmation(store, { companyId: "cA", userId: "u1", command, createdAt: "", expiresAt: "" });
    expect(await getPendingConfirmation(store, "cA", "u2")).toBeNull();
    expect(await getPendingConfirmation(store, "cB", "u1")).toBeNull();
    expect(await consumePendingConfirmation(store, "cA", "u2")).toBeNull();
    expect(await consumePendingConfirmation(store, "cB", "u1")).toBeNull();
  });

  it("consumes atomically and exactly once", async () => {
    const store = new FakeTransientStore();
    await savePendingConfirmation(store, { companyId: "cA", userId: "u1", command, createdAt: "", expiresAt: "" });
    const first = await consumePendingConfirmation(store, "cA", "u1");
    expect(first?.command).toEqual(command);
    expect(await consumePendingConfirmation(store, "cA", "u1")).toBeNull();
  });

  it("clears on negative response without side effects", async () => {
    const store = new FakeTransientStore();
    await savePendingConfirmation(store, { companyId: "cA", userId: "u1", command, createdAt: "", expiresAt: "" });
    await clearPendingConfirmation(store, "cA", "u1");
    expect(await getPendingConfirmation(store, "cA", "u1")).toBeNull();
  });

  it("expired records are unavailable", async () => {
    const store = new FakeTransientStore();
    await savePendingConfirmation(store, { companyId: "cA", userId: "u1", command, createdAt: "", expiresAt: "" });
    const key = "looply:assistant:confirmation:cA:u1";
    store.data.get(key)!.expiresAt = Date.now() - 1;
    expect(await getPendingConfirmation(store, "cA", "u1")).toBeNull();
    expect(await consumePendingConfirmation(store, "cA", "u1")).toBeNull();
  });

  it("uses a bounded TTL and safe keys", async () => {
    expect(CONFIRMATION_TTL_SECONDS).toBe(600);
    await expect(savePendingConfirmation(new FakeTransientStore(), { companyId: "c A", userId: "u1", command, createdAt: "", expiresAt: "" })).rejects.toMatchObject({ status: 400 });
  });

  it("propagates store failures instead of falling back to memory", async () => {
    const store = new FakeTransientStore();
    store.unavailable = true;
    await expect(savePendingConfirmation(store, { companyId: "cA", userId: "u1", command, createdAt: "", expiresAt: "" })).rejects.toThrow("unavailable");
    await expect(getPendingConfirmation(store, "cA", "u1")).rejects.toThrow("unavailable");
    await expect(consumePendingConfirmation(store, "cA", "u1")).rejects.toThrow("unavailable");
  });
});

describe("inbound message idempotency", () => {
  it("claims a provider message exactly once", async () => {
    const store = new FakeTransientStore();
    expect(await claimInboundMessage(store, "whatsapp", "wamid.1")).toBe(true);
    expect(await claimInboundMessage(store, "whatsapp", "wamid.1")).toBe(false);
  });

  it("keeps message ids and providers independent", async () => {
    const store = new FakeTransientStore();
    expect(await claimInboundMessage(store, "whatsapp", "wamid.1")).toBe(true);
    expect(await claimInboundMessage(store, "whatsapp", "wamid.2")).toBe(true);
    expect(await claimInboundMessage(store, "meta", "wamid.1")).toBe(true);
  });

  it("uses a bounded TTL and safe keys", async () => {
    expect(IDEMPOTENCY_TTL_SECONDS).toBe(48 * 60 * 60);
    await expect(claimInboundMessage(new FakeTransientStore(), "whatsapp", "bad id with spaces")).rejects.toMatchObject({ status: 400 });
    await expect(claimInboundMessage(new FakeTransientStore(), "bad provider", "wamid.1")).rejects.toMatchObject({ status: 400 });
  });

  it("propagates store failures instead of claiming open", async () => {
    const store = new FakeTransientStore();
    store.unavailable = true;
    await expect(claimInboundMessage(store, "whatsapp", "wamid.1")).rejects.toThrow("unavailable");
  });
});
