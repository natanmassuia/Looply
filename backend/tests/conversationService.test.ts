import { describe, expect, it } from "vitest";
import {
  appendInboundMessage,
  appendOutboundMessage,
  bindConversationClient,
  getConversation,
  getOrCreateConversation,
  listConversations,
  listMessages,
  markConversationRead,
  persistNormalizedInboundMessage,
  resolveCompanyForChannel,
  setConversationAiStatus,
} from "../src/services/conversationService";

function makeInMemoryDb(seed?: {
  companies?: any[];
  clients?: any[];
  members?: any[];
  channels?: any[];
  conversations?: any[];
  messages?: any[];
}) {
  const state = {
    companies: seed?.companies ?? [{ id: "comp_1", name: "Company 1" }, { id: "comp_2", name: "Company 2" }],
    clients: seed?.clients ?? [
      { id: "cli_1", companyId: "comp_1", name: "Client A" },
      { id: "cli_2", companyId: "comp_2", name: "Client B" },
    ],
    members: seed?.members ?? [
      { id: "m_1", userId: "usr_1", companyId: "comp_1", isActive: true },
    ],
    channels: seed?.channels ?? [],
    conversations: seed?.conversations ?? [],
    messages: seed?.messages ?? [],
  };

  const db: any = {
    whatsAppChannel: {
      findUnique: async ({ where }: any) => {
        if (where.provider_externalAccountId) {
          const { provider, externalAccountId } = where.provider_externalAccountId;
          return state.channels.find((c) => c.provider === provider && c.externalAccountId === externalAccountId) ?? null;
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        return state.channels.find((c) => {
          if (where.provider && c.provider !== where.provider) return false;
          if (where.sourcePhoneNumber && c.sourcePhoneNumber !== where.sourcePhoneNumber) return false;
          if (where.isActive !== undefined && c.isActive !== where.isActive) return false;
          return true;
        }) ?? null;
      },
    },
    client: {
      findFirst: async ({ where }: any) => {
        return state.clients.find((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.companyId && c.companyId !== where.companyId) return false;
          return true;
        }) ?? null;
      },
    },
    companyMember: {
      findUnique: async ({ where }: any) => {
        if (where.userId_companyId) {
          const { userId, companyId } = where.userId_companyId;
          return state.members.find((m) => m.userId === userId && m.companyId === companyId) ?? null;
        }
        return null;
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
      update: async ({ where, data, include }: any) => {
        const idx = state.conversations.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error("not found");
        const current = state.conversations[idx];
        const updated = {
          ...current,
          ...data,
          unreadCount: data.unreadCount?.increment
            ? current.unreadCount + data.unreadCount.increment
            : data.unreadCount !== undefined
            ? data.unreadCount
            : current.unreadCount,
          updatedAt: new Date(),
        };
        state.conversations[idx] = updated;
        if (include?.client) {
          const client = state.clients.find((cl) => cl.id === updated.clientId) ?? null;
          return { ...updated, client };
        }
        return updated;
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

        list.sort((a, b) => {
          const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return timeB - timeA;
        });

        if (cursor) {
          const cIdx = list.findIndex((c) => c.id === cursor.id);
          if (cIdx !== -1) {
            list = list.slice(cIdx + (skip ?? 0));
          }
        }

        if (take) {
          list = list.slice(0, take);
        }

        return list.map((item) => {
          const client = state.clients.find((cl) => cl.id === item.clientId) ?? null;
          return { ...item, client };
        });
      },
    },
    conversationMessage: {
      findFirst: async ({ where, include }: any) => {
        const found = state.messages.find((m) => {
          if (where.companyId && m.companyId !== where.companyId) return false;
          if (where.provider && m.provider !== where.provider) return false;
          if (where.providerMessageId && m.providerMessageId !== where.providerMessageId) return false;
          return true;
        });
        if (!found) return null;
        if (include?.senderUser) {
          const senderUser = mSender(found.senderUserId);
          return { ...found, senderUser };
        }
        return found;
      },
      findMany: async ({ where, take, cursor, skip, include }: any) => {
        let list = state.messages.filter((m) => {
          if (where.conversationId && m.conversationId !== where.conversationId) return false;
          if (where.companyId && m.companyId !== where.companyId) return false;
          return true;
        });

        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (cursor) {
          const cIdx = list.findIndex((m) => m.id === cursor.id);
          if (cIdx !== -1) {
            list = list.slice(cIdx + (skip ?? 0));
          }
        }

        if (take) {
          list = list.slice(0, take);
        }

        return list.map((item) => {
          if (include?.senderUser) {
            const senderUser = mSender(item.senderUserId);
            return { ...item, senderUser };
          }
          return item;
        });
      },
      create: async ({ data, include }: any) => {
        const row = {
          id: `msg_${state.messages.length + 1}`,
          createdAt: new Date(),
          deliveryStatus: "PENDING",
          type: "TEXT",
          ...data,
        };
        state.messages.push(row);
        if (include?.senderUser) {
          const senderUser = mSender(row.senderUserId);
          return { ...row, senderUser };
        }
        return row;
      },
    },
  };

  function mSender(userId?: string) {
    if (!userId) return null;
    return { id: userId, name: "Operator User" };
  }

  return { db, state };
}

describe("Conversation Service (F15.2 Foundation)", () => {
  it("creates a conversation with normalized phone and returns it", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "11987654321",
      contactName: "João Silva",
    });

    expect(conv.id).toBeDefined();
    expect(conv.remotePhone).toBe("+5511987654321");
    expect(conv.contactName).toBe("João Silva");
    expect(conv.aiStatus).toBe("ACTIVE");
    expect(conv.unreadCount).toBe(0);
  });

  it("reuses existing conversation for the same tenant + phone", async () => {
    const { db, state } = makeInMemoryDb();
    const c1 = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511987654321",
      contactName: "João",
    });

    const c2 = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "11987654321",
      contactName: "João Atualizado",
    });

    expect(c1.id).toBe(c2.id);
    expect(state.conversations.length).toBe(1);
    expect(c2.contactName).toBe("João Atualizado");
  });

  it("appends inbound message, updates preview, increments unreadCount", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990001",
    });

    const msg = await appendInboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      body: "Olá, gostaria de agendar uma consulta",
      providerMessageId: "wamid_inbound_1",
    });

    expect(msg.direction).toBe("INBOUND");
    expect(msg.senderType).toBe("CONTACT");
    expect(msg.body).toBe("Olá, gostaria de agendar uma consulta");

    const updatedConv = await getConversation(db, "comp_1", conv.id);
    expect(updatedConv.unreadCount).toBe(1);
    expect(updatedConv.lastMessagePreview).toBe("Olá, gostaria de agendar uma consulta");
    expect(updatedConv.lastMessageAt).toBeDefined();
  });

  it("durable idempotency: duplicate providerMessageId returns existing message without duplicate append or unread bump", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990002",
    });

    const msg1 = await appendInboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      body: "Primeiro envio",
      providerMessageId: "wamid_dedupe_123",
    });

    const msg2 = await appendInboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      body: "Primeiro envio repetido",
      providerMessageId: "wamid_dedupe_123",
    });

    expect(msg1.id).toBe(msg2.id);
    const updatedConv = await getConversation(db, "comp_1", conv.id);
    expect(updatedConv.unreadCount).toBe(1);
  });

  it("appends outbound message from AI without incrementing unreadCount", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990003",
    });

    const outMsg = await appendOutboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      senderType: "AI",
      body: "Olá! Como posso te ajudar?",
      providerMessageId: "wamid_out_1",
    });

    expect(outMsg.direction).toBe("OUTBOUND");
    expect(outMsg.senderType).toBe("AI");

    const updatedConv = await getConversation(db, "comp_1", conv.id);
    expect(updatedConv.unreadCount).toBe(0);
    expect(updatedConv.lastMessagePreview).toBe("Olá! Como posso te ajudar?");
  });

  it("markConversationRead resets unreadCount to 0", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990004",
    });

    await appendInboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      body: "Msg 1",
    });
    await appendInboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      body: "Msg 2",
    });

    let state = await getConversation(db, "comp_1", conv.id);
    expect(state.unreadCount).toBe(2);

    await markConversationRead(db, "comp_1", conv.id);
    state = await getConversation(db, "comp_1", conv.id);
    expect(state.unreadCount).toBe(0);
  });

  it("bindConversationClient binds valid client from same company and rejects cross-company client", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990005",
    });

    // Valid client in comp_1
    const updated = await bindConversationClient(db, "comp_1", conv.id, "cli_1");
    expect(updated.client?.id).toBe("cli_1");
    expect(updated.client?.name).toBe("Client A");

    // Client from comp_2 must fail
    await expect(bindConversationClient(db, "comp_1", conv.id, "cli_2")).rejects.toThrow("Cliente não encontrado");

    // Unbind client
    const unlinked = await bindConversationClient(db, "comp_1", conv.id, null);
    expect(unlinked.client).toBeNull();
  });

  it("setConversationAiStatus updates aiStatus with enum validation", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990006",
    });

    const paused = await setConversationAiStatus(db, "comp_1", conv.id, "PAUSED");
    expect(paused.aiStatus).toBe("PAUSED");

    const attention = await setConversationAiStatus(db, "comp_1", conv.id, "NEEDS_ATTENTION");
    expect(attention.aiStatus).toBe("NEEDS_ATTENTION");
  });

  it("records AI action correlation on message (CONFIRMATION, APPOINTMENT, JOB)", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990007",
    });

    const msgWithAction = await appendInboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      body: "Quero marcar amanhã às 14h",
      actionType: "APPOINTMENT_CREATED",
      actionMetadata: {
        appointmentId: "apt_123",
        summary: "Consulta agendada para amanhã 14:00",
      },
    });

    expect(msgWithAction.action).toBeDefined();
    expect(msgWithAction.action?.type).toBe("APPOINTMENT_CREATED");
    expect(msgWithAction.action?.metadata.appointmentId).toBe("apt_123");
  });

  it("records audio message metadata and transcription on message", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, {
      companyId: "comp_1",
      remotePhone: "+5511999990008",
    });

    const audioMsg = await appendInboundMessage(db, {
      companyId: "comp_1",
      conversationId: conv.id,
      type: "AUDIO",
      mediaStorageKey: "audios/audio_1.ogg",
      mediaMimeType: "audio/ogg",
      mediaSizeBytes: 10240,
      mediaFilename: "voice.ogg",
      transcription: "Olá, quero fazer um orçamento.",
    });

    expect(audioMsg.type).toBe("AUDIO");
    expect(audioMsg.media?.mimeType).toBe("audio/ogg");
    expect(audioMsg.media?.sizeBytes).toBe(10240);
    expect(audioMsg.transcription).toBe("Olá, quero fazer um orçamento.");
  });

  it("resolves company by WhatsApp channel binding (Meta phoneNumberId)", async () => {
    const { db } = makeInMemoryDb({
      channels: [
        { id: "ch_1", companyId: "comp_1", provider: "whatsapp", externalAccountId: "meta_phone_123", isActive: true },
        { id: "ch_2", companyId: "comp_2", provider: "whatsapp", externalAccountId: "meta_phone_456", isActive: true },
      ],
    });

    const compMeta1 = await resolveCompanyForChannel(db, "whatsapp", "meta_phone_123");
    expect(compMeta1).toBe("comp_1");

    const compMeta2 = await resolveCompanyForChannel(db, "whatsapp", "meta_phone_456");
    expect(compMeta2).toBe("comp_2");

    const compUnknown = await resolveCompanyForChannel(db, "whatsapp", "nonexistent");
    expect(compUnknown).toBeNull();
  });

  it("persistNormalizedInboundMessage handles end-to-end inbound normalization pipeline", async () => {
    const { db } = makeInMemoryDb();
    const msg = await persistNormalizedInboundMessage(db, {
      companyId: "comp_1",
      provider: "whatsapp",
      remotePhone: "+5511998877665",
      contactName: "Maria Souza",
      type: "TEXT",
      body: "Olá!",
      providerMessageId: "wamid_norm_1",
      receivedAt: new Date("2026-08-23T10:00:00Z"),
    });

    expect(msg.id).toBeDefined();
    expect(msg.body).toBe("Olá!");
    const conv = await getConversation(db, "comp_1", msg.conversationId);
    expect(conv.remotePhone).toBe("+5511998877665");
    expect(conv.contactName).toBe("Maria Souza");
    expect(conv.lastMessageAt).toBe("2026-08-23T10:00:00.000Z");
  });

  it("lists conversations with pagination and search", async () => {
    const { db } = makeInMemoryDb();
    await getOrCreateConversation(db, { companyId: "comp_1", remotePhone: "+5511911110001", contactName: "Alice" });
    await getOrCreateConversation(db, { companyId: "comp_1", remotePhone: "+5511911110002", contactName: "Bob" });

    const list = await listConversations(db, "comp_1", { limit: 10 });
    expect(list.items.length).toBe(2);

    const searchAlice = await listConversations(db, "comp_1", { search: "Alice" });
    expect(searchAlice.items.length).toBe(1);
    expect(searchAlice.items[0].contactName).toBe("Alice");
  });

  it("lists messages of a conversation in chronological order", async () => {
    const { db } = makeInMemoryDb();
    const conv = await getOrCreateConversation(db, { companyId: "comp_1", remotePhone: "+5511911110003" });
    await appendInboundMessage(db, { companyId: "comp_1", conversationId: conv.id, body: "Primeira" });
    await appendOutboundMessage(db, { companyId: "comp_1", conversationId: conv.id, senderType: "AI", body: "Segunda" });

    const msgs = await listMessages(db, "comp_1", conv.id);
    expect(msgs.items.length).toBe(2);
    expect(msgs.items[0].body).toBe("Primeira");
    expect(msgs.items[1].body).toBe("Segunda");
  });
});
