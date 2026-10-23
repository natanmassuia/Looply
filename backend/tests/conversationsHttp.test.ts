import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { makeConversationsRouter } from "../src/routes/conversations";
import { errorHandler } from "../src/lib/errors";

// The human-reply endpoint dispatches via the WhatsApp provider; stub it so the
// test never touches the network.
vi.mock("../src/lib/assistantRuntime", () => ({
  getWhatsAppProvider: () => ({
    sendText: async () => ({ providerMessageId: "wamid_test" }),
  }),
}));

function makeApp(auth = { userId: "usr_1", companyId: "comp_1", role: "ADMIN" }) {
  const app = express();
  app.use(express.json());

  const state = {
    clients: [
      { id: "cli_1", companyId: "comp_1", name: "Client 1" },
      { id: "cli_other", companyId: "comp_other", name: "Other Client" },
    ],
    conversations: [
      {
        id: "conv_1",
        companyId: "comp_1",
        provider: "whatsapp",
        remotePhone: "+5511999991111",
        contactName: "Carlos Aluno",
        contactAvatarUrl: null,
        clientId: "cli_1",
        lastMessagePreview: "Olá, tenho dúvidas",
        lastMessageAt: new Date("2026-08-23T15:00:00Z"),
        unreadCount: 2,
        aiStatus: "ACTIVE",
        createdAt: new Date("2026-08-23T10:00:00Z"),
        updatedAt: new Date("2026-08-23T15:00:00Z"),
      },
      {
        id: "conv_2",
        companyId: "comp_1",
        provider: "whatsapp",
        remotePhone: "+5511999992222",
        contactName: "Ana Beatriz",
        contactAvatarUrl: null,
        clientId: null,
        lastMessagePreview: "Obrigada!",
        lastMessageAt: new Date("2026-08-23T14:00:00Z"),
        unreadCount: 0,
        aiStatus: "PAUSED",
        createdAt: new Date("2026-08-23T09:00:00Z"),
        updatedAt: new Date("2026-08-23T14:00:00Z"),
      },
      {
        id: "conv_other",
        companyId: "comp_other",
        provider: "whatsapp",
        remotePhone: "+5511999993333",
        contactName: "Secret",
        contactAvatarUrl: null,
        clientId: null,
        lastMessagePreview: "Other message",
        lastMessageAt: new Date("2026-08-23T16:00:00Z"),
        unreadCount: 1,
        aiStatus: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    messages: [
      {
        id: "msg_1",
        conversationId: "conv_1",
        companyId: "comp_1",
        provider: "whatsapp",
        direction: "INBOUND",
        senderType: "CONTACT",
        senderUserId: null,
        type: "TEXT",
        body: "Olá, tenho dúvidas",
        deliveryStatus: "DELIVERED",
        createdAt: new Date("2026-08-23T15:00:00Z"),
      },
    ],
  };

  const db: any = {
    client: {
      findFirst: async ({ where }: any) => {
        return state.clients.find((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.companyId && c.companyId !== where.companyId) return false;
          return true;
        }) ?? null;
      },
    },
    conversation: {
      findFirst: async ({ where, include }: any) => {
        const found = state.conversations.find((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.companyId && c.companyId !== where.companyId) return false;
          return true;
        });
        if (!found) return null;
        if (include?.client) {
          const client = state.clients.find((cl) => cl.id === found.clientId) ?? null;
          return { ...found, client };
        }
        return found;
      },
      findMany: async ({ where, take, cursor, skip }: any) => {
        let list = state.conversations.filter((c) => {
          if (where.companyId && c.companyId !== where.companyId) return false;
          if (where.aiStatus && c.aiStatus !== where.aiStatus) return false;
          if (where.OR) {
            const match = where.OR.some((clause: any) => {
              if (clause.contactName?.contains) {
                return (c.contactName || "").toLowerCase().includes(clause.contactName.contains.toLowerCase());
              }
              if (clause.remotePhone?.contains) {
                return (c.remotePhone || "").includes(clause.remotePhone.contains);
              }
              return false;
            });
            if (!match) return false;
          }
          return true;
        });

        list.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

        if (cursor) {
          const cIdx = list.findIndex((c) => c.id === cursor.id);
          if (cIdx !== -1) list = list.slice(cIdx + (skip ?? 0));
        }
        if (take) list = list.slice(0, take);

        return list.map((item) => {
          const client = state.clients.find((cl) => cl.id === item.clientId) ?? null;
          return { ...item, client };
        });
      },
      update: async ({ where, data, include }: any) => {
        const idx = state.conversations.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error("not found");
        const current = state.conversations[idx];
        const updated = { ...current, ...data, updatedAt: new Date() };
        state.conversations[idx] = updated;
        if (include?.client) {
          const client = state.clients.find((cl) => cl.id === updated.clientId) ?? null;
          return { ...updated, client };
        }
        return updated;
      },
    },
    conversationMessage: {
      findMany: async ({ where }: any) => {
        const list = state.messages.filter((m) => {
          if (where.conversationId && m.conversationId !== where.conversationId) return false;
          if (where.companyId && m.companyId !== where.companyId) return false;
          return true;
        });
        return list.map((item) => ({ ...item, senderUser: null }));
      },
      create: async ({ data, include }: any) => {
        const row: any = {
          id: `msg_${state.messages.length + 1}`,
          ...data,
          senderUser:
            include?.senderUser && data.senderUserId
              ? { id: data.senderUserId, name: "Operador" }
              : null,
        };
        state.messages.push(row);
        return row;
      },
    },
    companyMember: {
      findUnique: async () => ({ id: "mem_1" }),
    },
  };

  // Mock auth middleware
  app.use((req: any, _res, next) => {
    req.auth = auth;
    next();
  });

  app.use("/api/conversations", makeConversationsRouter(db));
  app.use(errorHandler);

  return { app, state };
}

describe("Conversations HTTP Endpoints (F15.2)", () => {
  it("GET /api/conversations returns list of conversations for tenant", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/conversations");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].id).toBe("conv_1");
    expect(res.body.items[0].contactName).toBe("Carlos Aluno");
    expect(res.body.items[0].client.name).toBe("Client 1");
    expect(res.body.items[1].id).toBe("conv_2");
  });

  it("GET /api/conversations?search filters by contact name", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/conversations?search=Ana");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].contactName).toBe("Ana Beatriz");
  });

  it("GET /api/conversations?aiStatus filters by aiStatus", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/conversations?aiStatus=PAUSED");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe("conv_2");
  });

  it("GET /api/conversations/:id returns conversation detail", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/conversations/conv_1");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("conv_1");
    expect(res.body.remotePhone).toBe("+5511999991111");
    expect(res.body.unreadCount).toBe(2);
  });

  it("GET /api/conversations/:id returns 404 for cross-tenant conversation", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/conversations/conv_other");

    expect(res.status).toBe(404);
  });

  it("GET /api/conversations/:id/messages returns messages", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/conversations/conv_1/messages");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].body).toBe("Olá, tenho dúvidas");
    expect(res.body.items[0].direction).toBe("INBOUND");
  });

  it("PATCH /api/conversations/:id/read marks unreadCount = 0", async () => {
    const { app } = makeApp();
    const res = await request(app).patch("/api/conversations/conv_1/read");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.unreadCount).toBe(0);
  });

  it("PATCH /api/conversations/:id/ai-status updates aiStatus and validates enum", async () => {
    const { app } = makeApp();
    const resValid = await request(app)
      .patch("/api/conversations/conv_1/ai-status")
      .send({ aiStatus: "PAUSED" });

    expect(resValid.status).toBe(200);
    expect(resValid.body.aiStatus).toBe("PAUSED");

    // Invalid enum (e.g. HANDOFF which is forbidden in V1)
    const resInvalid = await request(app)
      .patch("/api/conversations/conv_1/ai-status")
      .send({ aiStatus: "HANDOFF" });

    expect(resInvalid.status).toBe(400);
  });

  it("POST /api/conversations/:id/messages auto-pauses the AI (human takeover)", async () => {
    const { app, state } = makeApp();
    // conv_1 starts ACTIVE
    const res = await request(app)
      .post("/api/conversations/conv_1/messages")
      .send({ body: "Oi, aqui é o atendente humano" });

    expect(res.status).toBe(201);
    const conv = state.conversations.find((c) => c.id === "conv_1");
    expect(conv?.aiStatus).toBe("PAUSED");
  });

  it("POST /api/conversations/:id/messages keeps an already-paused conversation paused", async () => {
    const { app, state } = makeApp();
    // conv_2 starts PAUSED
    const res = await request(app)
      .post("/api/conversations/conv_2/messages")
      .send({ body: "Seguindo o atendimento" });

    expect(res.status).toBe(201);
    const conv = state.conversations.find((c) => c.id === "conv_2");
    expect(conv?.aiStatus).toBe("PAUSED");
  });

  it("PATCH /api/conversations/:id/client binds client and rejects cross-tenant client", async () => {
    const { app } = makeApp();
    const resValid = await request(app)
      .patch("/api/conversations/conv_2/client")
      .send({ clientId: "cli_1" });

    expect(resValid.status).toBe(200);
    expect(resValid.body.client.id).toBe("cli_1");

    const resCrossTenant = await request(app)
      .patch("/api/conversations/conv_2/client")
      .send({ clientId: "cli_other" });

    expect(resCrossTenant.status).toBe(404);
  });
});
