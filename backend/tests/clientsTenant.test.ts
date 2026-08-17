import { describe, it, expect } from "vitest";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  normalizeChannels,
} from "../src/services/clientService";
import type { DB } from "../src/lib/db";

// ── Fake DB ──────────────────────────────────────────────────────────────
function makeFakeDB(seed: Array<Record<string, any>> = []) {
  const state = { clients: seed };
  const db: any = {
    client: {
      findMany: async ({ where }: any) =>
        state.clients.filter(
          (c) =>
            c.companyId === where.companyId &&
            (!where.status || c.status === where.status) &&
            (!where.name || c.name.toLowerCase().includes(String(where.name.contains).toLowerCase())),
        ),
      findFirst: async ({ where }: any) => {
        const notId = where.NOT?.id;
        return (
          state.clients.find(
            (c) =>
              c.companyId === where.companyId &&
              (where.id === undefined || c.id === where.id) &&
              (where.name === undefined ||
                (typeof where.name === "string"
                  ? c.name === where.name
                  : c.name.toLowerCase().includes(String(where.name.contains).toLowerCase()))) &&
              (notId === undefined || c.id !== notId),
          ) ?? null
        );
      },
      create: async ({ data }: any) => (state.clients.push({ id: `cl${state.clients.length + 1}`, createdAt: new Date(), ...data }), state.clients.at(-1)),
      update: async ({ where, data }: any) => {
        const c = state.clients.find((c) => c.id === where.id)!;
        Object.assign(c, data);
        return c;
      },
      updateMany: async ({ where, data }: any) => {
        const c = state.clients.find((c) => c.id === where.id && c.companyId === where.companyId);
        if (!c) return { count: 0 };
        Object.assign(c, data);
        return { count: 1 };
      },
      deleteMany: async ({ where }: any) => {
        const i = state.clients.findIndex((c) => c.id === where.id && c.companyId === where.companyId);
        if (i < 0) return { count: 0 };
        state.clients.splice(i, 1);
        return { count: 1 };
      },
    },
  };
  return { db: db as unknown as DB, state };
}

function world() {
  return makeFakeDB([
    { id: "a1", companyId: "cA", name: "Aurora A1", status: "ACTIVE", channels: [], _count: { jobs: 2 } },
    { id: "a2", companyId: "cA", name: "Alfa A2", status: "INACTIVE", channels: [], _count: { jobs: 0 } },
    { id: "b1", companyId: "cB", name: "Bravo B1", status: "ACTIVE", channels: [], _count: { jobs: 5 } },
  ]);
}

// ── LIST ─────────────────────────────────────────────────────────────────
describe("listClients", () => {
  it("A sees only A-clients; B sees only B-clients", async () => {
    const { db } = world();
    const a = await listClients(db, "cA");
    const b = await listClients(db, "cB");
    expect(a.map((c: any) => c.id).sort()).toEqual(["a1", "a2"]);
    expect(b.map((c: any) => c.id)).toEqual(["b1"]);
  });

  it("status filter and search stay tenant-scoped", async () => {
    const { db } = world();
    expect((await listClients(db, "cA", { status: "ACTIVE" })).map((c: any) => c.id)).toEqual(["a1"]);
    expect((await listClients(db, "cB", { search: "bravo" })).map((c: any) => c.id)).toEqual(["b1"]);
    expect((await listClients(db, "cA", { search: "bravo" }))).toEqual([]);
  });
});

// ── DETAIL ───────────────────────────────────────────────────────────────
describe("getClient", () => {
  it("A reads A1; A probing B1 → 404 (not 403, no existence leak)", async () => {
    const { db } = world();
    expect((await getClient(db, "cA", "a1")).id).toBe("a1");
    await expect(getClient(db, "cA", "b1")).rejects.toMatchObject({ status: 404 });
    await expect(getClient(db, "cB", "a1")).rejects.toMatchObject({ status: 404 });
  });
});

// ── CREATE ───────────────────────────────────────────────────────────────
describe("createClient", () => {
  it("creates with companyId from auth context; body companyId never used", async () => {
    const { db, state } = world();
    const c = await createClient(db, "cA", { name: "Novo" }); // service only receives auth companyId
    expect(c.companyId).toBe("cA");
    expect(state.clients.at(-1)!.companyId).toBe("cA");
  });

  it("duplicate name within SAME tenant → 409; same name in other tenant allowed", async () => {
    const { db } = world();
    await expect(createClient(db, "cA", { name: "Aurora A1" })).rejects.toMatchObject({ status: 409 });
    await expect(createClient(db, "cB", { name: "Aurora A1" })).resolves.toBeTruthy();
  });
});

// ── UPDATE ───────────────────────────────────────────────────────────────
describe("updateClient", () => {
  it("updates own client; cross-tenant → 404; companyId not settable", async () => {
    const { db, state } = world();
    const c = await updateClient(db, "cA", "a1", { name: "Aurora Renomeada" });
    expect(c!.name).toBe("Aurora Renomeada");
    await expect(updateClient(db, "cA", "b1", { name: "hack" })).rejects.toMatchObject({ status: 404 });
    await expect(updateClient(db, "cA", "a1", { companyId: "cB" } as never)).resolves.toBeTruthy();
    expect(state.clients.find((x: any) => x.id === "a1")!.companyId).toBe("cA"); // immutable
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────
describe("deleteClient", () => {
  it("deletes own client without contents; 409 with contents; cross-tenant → 404", async () => {
    const { db, state } = world();
    await expect(deleteClient(db, "cA", "a1")).rejects.toMatchObject({ status: 409 }); // has contents
    await deleteClient(db, "cA", "a2"); // no contents
    expect(state.clients.find((c: any) => c.id === "a2")).toBeUndefined();
    await expect(deleteClient(db, "cA", "b1")).rejects.toMatchObject({ status: 404 });
  });
});

// ── F14 — channel normalization (server authority) ──────────────────────
describe("normalizeChannels", () => {
  it("trims whitespace, drops empties, and dedupes case-insensitively", () => {
    expect(
      normalizeChannels([" Instagram ", "TikTok", "  ", "INSTAGRAM", "Pinterest"]),
    ).toEqual(["Instagram", "TikTok", "Pinterest"]);
  });

  it("undefined / empty / null coerces to empty array", () => {
    expect(normalizeChannels(undefined)).toEqual([]);
    expect(normalizeChannels(null)).toEqual([]);
    expect(normalizeChannels([])).toEqual([]);
  });

  it("rejects more than 10 channels", () => {
    expect(() => normalizeChannels(Array(11).fill("Instagram"))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("rejects entries longer than 60 chars", () => {
    expect(() => normalizeChannels(["x".repeat(61)])).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("rejects non-string entries", () => {
    expect(() => normalizeChannels([42 as unknown as string])).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("createClient persists the normalized array", async () => {
    const { db, state } = world();
    const c = await createClient(db, "cA", {
      name: "Cliente Canais",
      channels: [" Instagram ", "INSTAGRAM", "WhatsApp"],
    });
    expect(c.channels).toEqual(["Instagram", "WhatsApp"]);
    expect(state.clients.find((x: any) => x.id === (c as any).id)!.channels).toEqual([
      "Instagram",
      "WhatsApp",
    ]);
  });

  it("updateClient replaces stored channels with the normalized array", async () => {
    const { db, state } = world();
    const c = await updateClient(db, "cA", "a1", {
      channels: ["TikTok", "TIKTOK", "E-mail"],
    });
    expect((c as any).channels).toEqual(["TikTok", "E-mail"]);
    expect(state.clients.find((x: any) => x.id === "a1")!.channels).toEqual([
      "TikTok",
      "E-mail",
    ]);
  });

  it("updateClient leaves other fields untouched when only channels change", async () => {
    const { db, state } = world();
    const before = state.clients.find((x: any) => x.id === "a1");
    await updateClient(db, "cA", "a1", { channels: ["WhatsApp"] });
    const after = state.clients.find((x: any) => x.id === "a1");
    expect(after!.name).toBe(before!.name);
    expect(after!.status).toBe(before!.status);
    expect(after!.channels).toEqual(["WhatsApp"]);
  });
});
