import { describe, it, expect } from "vitest";
import type { DB } from "../src/lib/db";
import { createContent, sendForApproval } from "../src/services/contentService";
import type { CreateContentInput } from "../src/lib/validation";

// Minimal in-memory Prisma-like stub implementing ONLY the surface touched by
// createContent + sendForApproval. Keeps these tests runnable without a live DB.
function makeFakeDB(): DB {
  const state: {
    clients: any[];
    users: any[];
    contents: any[];
    versions: any[];
    approvals: any[];
  } = { clients: [], users: [], contents: [], versions: [], approvals: [] };
  let n = 0;
  const id = () => `id_${++n}`;

  const db: any = {
    client: {
      findUnique: async ({ where }: any) =>
        state.clients.find((c) => c.id === where.id || c.name === where.name) ?? null,
    },
    user: {
      findUnique: async ({ where }: any) =>
        state.users.find((u) => u.id === where.id || u.email === where.email) ?? null,
    },
    content: {
      findUnique: async ({ where }: any) =>
        state.contents.find((c) => c.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const { versions: vCreate, ...rest } = data;
        const content = { id: id(), createdAt: new Date(), updatedAt: new Date(), ...rest };
        state.contents.push(content);
        let versions: any[] = [];
        if (vCreate?.create) {
          const v = { id: id(), contentId: content.id, createdAt: new Date(), ...vCreate.create };
          state.versions.push(v);
          versions = [v];
        }
        return { ...content, versions };
      },
      update: async ({ where, data }: any) => {
        const c = state.contents.find((x) => x.id === where.id);
        Object.assign(c, data);
        return c;
      },
    },
    contentVersion: {
      findFirst: async ({ where, orderBy }: any) => {
        let vs = state.versions.filter((v) => v.contentId === where.contentId);
        if (orderBy?.versionNumber === "desc") vs = [...vs].sort((a, b) => b.versionNumber - a.versionNumber);
        return vs[0] ?? null;
      },
      create: async ({ data }: any) => {
        const v = { id: id(), createdAt: new Date(), ...data };
        state.versions.push(v);
        return v;
      },
    },
    approval: {
      create: async ({ data }: any) => {
        const a = { id: id(), createdAt: new Date(), ...data };
        state.approvals.push(a);
        return a;
      },
    },
    async $transaction(arg: any) {
      return typeof arg === "function" ? arg(db) : Promise.all(arg);
    },
    __state: state,
  };
  return db as unknown as DB;
}

const baseInput: CreateContentInput = {
  title: "Campanha Dia dos Pais",
  clientId: "client_1",
  format: "REELS",
  channel: "Instagram",
  responsibleId: "user_1",
  caption: "Legenda inicial v1",
  mediaUrl: "https://picsum.photos/seed/x/900/900",
  mediaType: "image/jpeg",
};

describe("contentService.createContent", () => {
  it("creates the content and an initial version #1 with status DRAFT", async () => {
    const db = makeFakeDB();
    (db as any).__state.clients.push({ id: "client_1", name: "Restaurante Aurora" });
    (db as any).__state.users.push({ id: "user_1", name: "Lucas" });

    const created = (await createContent(db, baseInput)) as any;
    const versions = (db as any).__state.versions as any[];

    expect(created.status).toBe("DRAFT");
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].contentId).toBe(created.id);
    expect(versions[0].caption).toBe("Legenda inicial v1");
  });

  it("rejects when the client does not exist", async () => {
    const db = makeFakeDB();
    await expect(createContent(db, baseInput)).rejects.toThrow();
  });
});

describe("contentService.sendForApproval", () => {
  it("creates a PENDING approval bound to the LATEST version and moves to AWAITING_CLIENT", async () => {
    const db = makeFakeDB();
    (db as any).__state.clients.push({ id: "client_1", name: "Aurora" });
    (db as any).__state.users.push({ id: "user_1", name: "Lucas" });

    const created = (await createContent(db, baseInput)) as any;
    // bring to IN_REVIEW (legal prerequisite for send-approval)
    (db as any).__state.contents[0].status = "IN_REVIEW";

    const result = (await sendForApproval(db, created.id)) as any;
    const approvals = (db as any).__state.approvals as any[];
    const versions = (db as any).__state.versions as any[];

    expect(result.token).toBeTruthy();
    expect(result.token).not.toMatch(/^\d+$/); // not a plain numeric id
    expect(approvals).toHaveLength(1);
    // approval references the expected content version (v1)
    expect(approvals[0].contentVersionId).toBe(versions[0].id);
    expect(approvals[0].contentId).toBe(created.id);
    expect(approvals[0].status).toBe("PENDING");
    // content transitioned
    expect((db as any).__state.contents[0].status).toBe("AWAITING_CLIENT");
  });
});
