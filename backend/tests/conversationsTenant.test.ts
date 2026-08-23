import { describe, expect, it } from "vitest";
import {
  bindConversationClient,
  getConversation,
  getOrCreateConversation,
  listConversations,
  listMessages,
  markConversationRead,
  setConversationAiStatus,
} from "../src/services/conversationService";

describe("Conversation Tenant Isolation (F15.2)", () => {
  function makeMultiTenantDb() {
    const state = {
      clients: [
        { id: "cli_A1", companyId: "company_A", name: "Client A1" },
        { id: "cli_B1", companyId: "company_B", name: "Client B1" },
      ],
      conversations: [
        {
          id: "conv_A",
          companyId: "company_A",
          provider: "whatsapp",
          remotePhone: "+5511999990001",
          contactName: "Contact Company A",
          clientId: "cli_A1",
          unreadCount: 3,
          aiStatus: "ACTIVE",
          lastMessageAt: new Date("2026-08-23T12:00:00Z"),
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: "conv_B",
          companyId: "company_B",
          provider: "whatsapp",
          remotePhone: "+5511999990002",
          contactName: "Contact Company B",
          clientId: "cli_B1",
          unreadCount: 1,
          aiStatus: "PAUSED",
          lastMessageAt: new Date("2026-08-23T11:00:00Z"),
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ],
      messages: [
        {
          id: "msg_A1",
          conversationId: "conv_A",
          companyId: "company_A",
          provider: "whatsapp",
          direction: "INBOUND",
          senderType: "CONTACT",
          type: "TEXT",
          body: "Secret A message",
          createdAt: new Date(),
        },
        {
          id: "msg_B1",
          conversationId: "conv_B",
          companyId: "company_B",
          provider: "whatsapp",
          direction: "INBOUND",
          senderType: "CONTACT",
          type: "TEXT",
          body: "Secret B message",
          createdAt: new Date(),
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
        findUnique: async ({ where, include }: any) => {
          if (where.companyId_provider_remotePhone) {
            const { companyId, provider, remotePhone } = where.companyId_provider_remotePhone;
            const found = state.conversations.find(
              (c) => c.companyId === companyId && c.provider === provider && c.remotePhone === remotePhone,
            );
            if (!found) return null;
            if (include?.client) {
              const client = state.clients.find((cl) => cl.id === found.clientId) ?? null;
              return { ...found, client };
            }
            return found;
          }
          return null;
        },
        create: async ({ data, include }: any) => {
          const row = {
            id: `conv_${state.conversations.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMessagePreview: null,
            lastMessageAt: null,
            unreadCount: 0,
            aiStatus: "ACTIVE",
            clientId: null,
            ...data,
          };
          state.conversations.push(row);
          if (include?.client) {
            const client = state.clients.find((cl) => cl.id === row.clientId) ?? null;
            return { ...row, client };
          }
          return row;
        },
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
        findMany: async ({ where }: any) => {
          const list = state.conversations.filter((c) => {
            if (where.companyId && c.companyId !== where.companyId) return false;
            return true;
          });
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
          return state.messages.filter((m) => {
            if (where.conversationId && m.conversationId !== where.conversationId) return false;
            if (where.companyId && m.companyId !== where.companyId) return false;
            return true;
          });
        },
      },
    };

    return { db, state };
  }

  it("Company A cannot list conversations belonging to Company B", async () => {
    const { db } = makeMultiTenantDb();
    const resultA = await listConversations(db, "company_A");
    expect(resultA.items.length).toBe(1);
    expect(resultA.items[0].id).toBe("conv_A");
    expect(resultA.items[0].contactName).toBe("Contact Company A");

    const resultB = await listConversations(db, "company_B");
    expect(resultB.items.length).toBe(1);
    expect(resultB.items[0].id).toBe("conv_B");
    expect(resultB.items[0].contactName).toBe("Contact Company B");
  });

  it("Company A cannot read conversation detail belonging to Company B", async () => {
    const { db } = makeMultiTenantDb();
    await expect(getConversation(db, "company_A", "conv_B")).rejects.toThrow("Conversa não encontrada");
  });

  it("Company A cannot read messages of a conversation belonging to Company B", async () => {
    const { db } = makeMultiTenantDb();
    await expect(listMessages(db, "company_A", "conv_B")).rejects.toThrow("Conversa não encontrada");
  });

  it("Company A cannot markRead a conversation belonging to Company B", async () => {
    const { db } = makeMultiTenantDb();
    await expect(markConversationRead(db, "company_A", "conv_B")).rejects.toThrow("Conversa não encontrada");
  });

  it("Company A cannot set aiStatus on a conversation belonging to Company B", async () => {
    const { db } = makeMultiTenantDb();
    await expect(setConversationAiStatus(db, "company_A", "conv_B", "PAUSED")).rejects.toThrow("Conversa não encontrada");
  });

  it("Company A cannot bind a client of Company B to its own conversation", async () => {
    const { db } = makeMultiTenantDb();
    await expect(bindConversationClient(db, "company_A", "conv_A", "cli_B1")).rejects.toThrow("Cliente não encontrado");
  });

  it("same phone interacting with two different companies creates two isolated conversations", async () => {
    const { db } = makeMultiTenantDb();
    const phone = "+5511988887777";

    const convA = await getOrCreateConversation(db, {
      companyId: "company_A",
      remotePhone: phone,
      contactName: "Lead in A",
    });

    const convB = await getOrCreateConversation(db, {
      companyId: "company_B",
      remotePhone: phone,
      contactName: "Lead in B",
    });

    expect(convA.id).not.toBe(convB.id);
    expect(convA.companyId).toBe("company_A");
    expect(convB.companyId).toBe("company_B");
  });
});
