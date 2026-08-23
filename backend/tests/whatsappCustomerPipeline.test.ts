import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { makeWhatsAppWebhookRouter } from "../src/routes/whatsappWebhook";
import { makeGupshupWebhookRouter } from "../src/routes/whatsappGupshupWebhook";
import { makeConversationsRouter } from "../src/routes/conversations";
import {
  handleCustomerWhatsAppInbound,
  CUSTOMER_WHATSAPP_COPY,
} from "../src/services/whatsappCustomerAdapter";
import {
  dispatchWhatsAppInbound,
  handleWhatsAppStatusUpdate,
} from "../src/services/whatsappTextAdapter";
import {
  updateMessageDeliveryStatus,
  resolveWhatsAppChannelDetails,
} from "../src/services/conversationService";
import {
  savePendingConfirmation,
  getPendingConfirmation,
} from "../src/services/assistantConfirmationStore";
import { MetaWhatsAppProvider } from "../src/services/whatsappProvider";
import { GupshupWhatsAppProvider } from "../src/services/gupshupProvider";
import type {
  WhatsAppInboundEvent,
  WhatsAppMediaPayload,
  WhatsAppOutboundResult,
  WhatsAppStatusUpdateEvent,
} from "../src/services/whatsappProvider";
import type {
  AssistantLanguageModel,
  AssistantLanguageModelRequest,
} from "../src/services/assistantLanguageModel";
import type {
  AudioTranscriptionRequest,
  AudioTranscriptionService,
} from "../src/services/audioTranscriptionService";
import type { AssistantDomainServices } from "../src/services/assistantCommandService";
import type { TransientStore } from "../src/lib/transientStore";
import type { ObjectStorage } from "../src/lib/storage";
import type { DB } from "../src/lib/db";

// ── Test Fakes & Harness ─────────────────────────────────────────────────

class FakeStore implements TransientStore {
  data = new Map<string, { value: string; expiresAt: number }>();
  unavailable = false;

  private guard() {
    if (this.unavailable) throw new Error("Transient store unavailable");
  }

  async get(key: string) {
    this.guard();
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return e.value;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.guard();
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    this.guard();
    if ((await this.get(key)) !== null) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async getAndDelete(key: string) {
    this.guard();
    const e = this.data.get(key);
    this.data.delete(key);
    if (!e || e.expiresAt <= Date.now()) return null;
    return e.value;
  }

  async delete(key: string) {
    this.guard();
    this.data.delete(key);
  }
}

class FakeLanguageModel implements AssistantLanguageModel {
  public requests: AssistantLanguageModelRequest[] = [];
  public results: unknown[] = [];

  constructor(initialResult?: unknown) {
    if (initialResult !== undefined) this.results.push(initialResult);
  }

  async generateStructuredOutput(req: AssistantLanguageModelRequest): Promise<unknown> {
    this.requests.push(req);
    const res = this.results.shift();
    if (res === undefined) {
      return { kind: "clarification", message: "Como posso ajudar?" };
    }
    return res;
  }
}

class FakeTranscriptionService implements AudioTranscriptionService {
  public requests: AudioTranscriptionRequest[] = [];
  public textToReturn = "cria um agendamento amanhã às 14h";
  public fail = false;

  async transcribe(req: AudioTranscriptionRequest): Promise<{ text: string }> {
    this.requests.push(req);
    if (this.fail) throw new Error("Transcription service offline");
    return { text: this.textToReturn };
  }
}

class FakeObjectStorage implements ObjectStorage {
  public objects = new Map<string, { buffer: Buffer; contentType: string }>();

  async createUploadUrl(input: { key: string; contentType: string; sizeBytes: number }) {
    return { url: `https://storage.test/upload/${input.key}`, expiresAt: new Date(Date.now() + 60000) };
  }

  async putObject(input: { key: string; buffer: Buffer; contentType: string }): Promise<void> {
    this.objects.set(input.key, { buffer: input.buffer, contentType: input.contentType });
  }

  async headObject(key: string) {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return { sizeBytes: obj.buffer.length, contentType: obj.contentType };
  }

  async createDownloadUrl(input: { key: string; filename: string }) {
    return { url: `https://storage.test/download/${input.key}?fn=${input.filename}`, expiresAt: new Date(Date.now() + 60000) };
  }

  async deleteObject(key: string) {
    this.objects.delete(key);
  }
}

class FakeWhatsAppProvider extends MetaWhatsAppProvider {
  public outboundSent: Array<{ to: string; text: string }> = [];
  public mediaToDownload: { buffer: Buffer; contentType: string } | null = null;
  public failOutbound = false;
  public failDownload = false;

  constructor() {
    super({
      verifyToken: "test_verify_token",
      appSecret: "test_app_secret",
      accessToken: "test_access_token",
      phoneNumberId: "phone_number_id_meta_1",
    });
  }

  override async sendText(to: string, text: string): Promise<WhatsAppOutboundResult> {
    if (this.failOutbound) throw new Error("Meta outbound failure");
    this.outboundSent.push({ to, text });
    return {
      providerMessageId: `wamid.out.${this.outboundSent.length}`,
      provider: "whatsapp" as const,
      sentAt: new Date(),
    };
  }

  override async downloadMedia(_media: WhatsAppMediaPayload) {
    if (this.failDownload) throw new Error("Meta media download failure");
    if (!this.mediaToDownload) {
      return { buffer: Buffer.from("fake audio data"), contentType: "audio/ogg" };
    }
    return this.mediaToDownload;
  }
}

class FakeGupshupProvider extends GupshupWhatsAppProvider {
  public outboundSent: Array<{ to: string; text: string }> = [];
  public mediaToDownload: { buffer: Buffer; contentType: string } | null = null;
  public failOutbound = false;
  public failDownload = false;

  constructor(opts: { allowlist?: string[] } = {}) {
    super({
      apiKey: "test_gupshup_key",
      appName: "LooplyGupshupApp",
      sourceNumber: "5511999999999",
      inboundAllowlist: opts.allowlist ?? ["34.95.34.128"],
    });
  }

  override async sendText(to: string, text: string): Promise<WhatsAppOutboundResult> {
    if (this.failOutbound) throw new Error("Gupshup outbound failure");
    this.outboundSent.push({ to, text });
    return {
      providerMessageId: `gs.out.${this.outboundSent.length}`,
      provider: "gupshup" as const,
      sentAt: new Date(),
    };
  }

  override async downloadMedia(_media: WhatsAppMediaPayload) {
    if (this.failDownload) throw new Error("Gupshup media download failure");
    if (!this.mediaToDownload) {
      return { buffer: Buffer.from("fake gupshup audio data"), contentType: "audio/ogg" };
    }
    return this.mediaToDownload;
  }
}

// ── In-Memory Database Fixture ───────────────────────────────────────────

function createInMemoryDb() {
  let idCounter = 1;
  const companies = new Map<string, any>([
    ["company_a", { id: "company_a", name: "Agência Alpha", timezone: "America/Sao_Paulo", isActive: true }],
    ["company_b", { id: "company_b", name: "Agência Beta", timezone: "America/Sao_Paulo", isActive: true }],
  ]);

  const whatsAppChannels = new Map<string, any>([
    [
      "channel_a_meta",
      {
        id: "channel_a_meta",
        companyId: "company_a",
        provider: "whatsapp",
        externalAccountId: "phone_number_id_meta_1",
        sourcePhoneNumber: "+5511988881111",
        displayName: "Alpha WhatsApp",
        purpose: "CUSTOMER_AI",
        isActive: true,
      },
    ],
    [
      "channel_a_gupshup",
      {
        id: "channel_a_gupshup",
        companyId: "company_a",
        provider: "gupshup",
        externalAccountId: "LooplyGupshupApp",
        sourcePhoneNumber: "+5511999999999",
        displayName: "Alpha Gupshup",
        purpose: "CUSTOMER_AI",
        isActive: true,
      },
    ],
    [
      "channel_b_meta",
      {
        id: "channel_b_meta",
        companyId: "company_b",
        provider: "whatsapp",
        externalAccountId: "phone_number_id_meta_beta",
        sourcePhoneNumber: "+5511988882222",
        displayName: "Beta WhatsApp",
        purpose: "CUSTOMER_AI",
        isActive: true,
      },
    ],
  ]);

  const clients = new Map<string, any>([
    [
      "client_1",
      {
        id: "client_1",
        companyId: "company_a",
        name: "Restaurante Sabor",
        primaryContactPhone: "+5511977771111",
        status: "ACTIVE",
      },
    ],
  ]);

  const conversations = new Map<string, any>();
  const conversationMessages = new Map<string, any>();
  const appointments = new Map<string, any>();
  const jobs = new Map<string, any>();
  const whatsAppIdentities = new Map<string, any>();

  const db: any = {
    company: {
      findUnique: async ({ where }: any) => companies.get(where.id) ?? null,
    },
    whatsAppChannel: {
      findUnique: async ({ where }: any) => {
        if (where.provider_externalAccountId) {
          for (const ch of whatsAppChannels.values()) {
            if (
              ch.provider === where.provider_externalAccountId.provider &&
              ch.externalAccountId === where.provider_externalAccountId.externalAccountId
            ) {
              return ch;
            }
          }
        }
        return whatsAppChannels.get(where.id) ?? null;
      },
      findFirst: async ({ where }: any) => {
        for (const ch of whatsAppChannels.values()) {
          if (where.provider && ch.provider !== where.provider) continue;
          if (where.sourcePhoneNumber && ch.sourcePhoneNumber !== where.sourcePhoneNumber) continue;
          if (where.isActive !== undefined && ch.isActive !== where.isActive) continue;
          return ch;
        }
        return null;
      },
    },
    client: {
      findFirst: async ({ where }: any) => {
        for (const cl of clients.values()) {
          if (where.companyId && cl.companyId !== where.companyId) continue;
          if (where.primaryContactPhone && cl.primaryContactPhone !== where.primaryContactPhone) continue;
          if (where.status && cl.status !== where.status) continue;
          return cl;
        }
        return null;
      },
      findUnique: async ({ where }: any) => clients.get(where.id) ?? null,
    },
    conversation: {
      findUnique: async ({ where }: any) => {
        if (where.companyId_provider_remotePhone) {
          const { companyId, provider, remotePhone } = where.companyId_provider_remotePhone;
          for (const conv of conversations.values()) {
            if (conv.companyId === companyId && conv.provider === provider && conv.remotePhone === remotePhone) {
              return {
                ...conv,
                client: conv.clientId ? clients.get(conv.clientId) : null,
              };
            }
          }
          return null;
        }
        const conv = conversations.get(where.id) ?? null;
        if (!conv) return null;
        return {
          ...conv,
          client: conv.clientId ? clients.get(conv.clientId) : null,
        };
      },
      findFirst: async ({ where }: any) => {
        for (const conv of conversations.values()) {
          if (where.id && conv.id !== where.id) continue;
          if (where.companyId && conv.companyId !== where.companyId) continue;
          if (where.remotePhone && conv.remotePhone !== where.remotePhone) continue;
          if (where.provider && conv.provider !== where.provider) continue;
          return {
            ...conv,
            client: conv.clientId ? clients.get(conv.clientId) : null,
          };
        }
        return null;
      },
      create: async ({ data }: any) => {
        const id = `conv_${idCounter++}`;
        const record = {
          id,
          companyId: data.companyId,
          provider: data.provider || "whatsapp",
          remotePhone: data.remotePhone,
          contactName: data.contactName || null,
          contactAvatarUrl: data.contactAvatarUrl || null,
          clientId: data.clientId || null,
          lastMessagePreview: data.lastMessagePreview || null,
          lastMessageAt: data.lastMessageAt || null,
          unreadCount: data.unreadCount || 0,
          aiStatus: data.aiStatus || "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        conversations.set(id, record);
        return {
          ...record,
          client: record.clientId ? clients.get(record.clientId) : null,
        };
      },
      update: async ({ where, data }: any) => {
        const conv = conversations.get(where.id);
        if (!conv) throw new Error("Conversation not found");
        if (data.unreadCount?.increment) {
          conv.unreadCount = (conv.unreadCount || 0) + data.unreadCount.increment;
        } else if (data.unreadCount !== undefined) {
          conv.unreadCount = data.unreadCount;
        }
        if (data.lastMessagePreview !== undefined) conv.lastMessagePreview = data.lastMessagePreview;
        if (data.lastMessageAt !== undefined) conv.lastMessageAt = data.lastMessageAt;
        if (data.aiStatus !== undefined) conv.aiStatus = data.aiStatus;
        if (data.clientId !== undefined) conv.clientId = data.clientId;
        conv.updatedAt = new Date();
        return {
          ...conv,
          client: conv.clientId ? clients.get(conv.clientId) : null,
        };
      },
    },
    conversationMessage: {
      create: async ({ data }: any) => {
        const id = `cmsg_${idCounter++}`;
        const record = {
          id,
          conversationId: data.conversationId,
          companyId: data.companyId,
          provider: data.provider,
          direction: data.direction,
          senderType: data.senderType,
          senderUserId: data.senderUserId || null,
          type: data.type || "TEXT",
          body: data.body || null,
          providerMessageId: data.providerMessageId || null,
          mediaStorageKey: data.mediaStorageKey || null,
          mediaMimeType: data.mediaMimeType || null,
          mediaSizeBytes: data.mediaSizeBytes || null,
          mediaFilename: data.mediaFilename || null,
          transcription: data.transcription || null,
          transcriptionStatus: data.transcriptionStatus || null,
          deliveryStatus: data.deliveryStatus || "PENDING",
          actionType: data.actionType || null,
          actionMetadata: data.actionMetadata || null,
          createdAt: data.createdAt || new Date(),
        };
        conversationMessages.set(id, record);
        return {
          ...record,
          senderUser: null,
        };
      },
      findFirst: async ({ where }: any) => {
        for (const msg of conversationMessages.values()) {
          if (where.id && msg.id !== where.id) continue;
          if (where.conversationId && msg.conversationId !== where.conversationId) continue;
          if (where.companyId && msg.companyId !== where.companyId) continue;
          if (where.provider && msg.provider !== where.provider) continue;
          if (where.providerMessageId && msg.providerMessageId !== where.providerMessageId) continue;
          return {
            ...msg,
            senderUser: null,
          };
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        const msg = conversationMessages.get(where.id);
        if (!msg) throw new Error("Message not found");
        if (data.deliveryStatus !== undefined) msg.deliveryStatus = data.deliveryStatus;
        return {
          ...msg,
          senderUser: null,
        };
      },
    },
    appointment: {
      create: async ({ data }: any) => {
        const id = `apt_${idCounter++}`;
        const record = { id, ...data, createdAt: new Date() };
        appointments.set(id, record);
        return record;
      },
    },
    job: {
      create: async ({ data }: any) => {
        const id = `job_${idCounter++}`;
        const record = { id, ...data, createdAt: new Date() };
        jobs.set(id, record);
        return record;
      },
    },
    whatsAppIdentity: {
      findUnique: async ({ where }: any) => {
        return whatsAppIdentities.get(`${where.provider_phoneNumber?.provider}:${where.provider_phoneNumber?.phoneNumber}`) ?? null;
      },
    },
    companyMember: {
      findUnique: async () => ({ isActive: true }),
    },
  };

  return {
    db: db as DB,
    stores: {
      companies,
      whatsAppChannels,
      clients,
      conversations,
      conversationMessages,
      appointments,
      jobs,
      whatsAppIdentities,
    },
  };
}

function makeMockDomainServices(executed: string[]): AssistantDomainServices {
  return {
    createAppointment: (async (_db: any, _companyId: string, _actorUserId: any, input: any) => {
      executed.push(`appointment:create:${input.title}`);
      return {
        id: "apt_new_1",
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt || new Date(new Date(input.startsAt).getTime() + 3600000),
      };
    }) as any,
    listAppointments: (async () => {
      executed.push("appointment:list");
      return { appointments: [{ id: "apt_1", title: "Reunião de Alinhamento", startsAt: new Date().toISOString() }] };
    }) as any,
    getAppointment: (async () => ({ id: "apt_1", title: "Reunião" })) as any,
    updateAppointment: (async () => ({ id: "apt_1" })) as any,
    cancelAppointment: (async (_db: any, _companyId: string, appointmentId: string) => {
      executed.push(`appointment:cancel:${appointmentId}`);
      return { id: appointmentId, title: "Cancelado" };
    }) as any,
    getCalendar: (async () => ({ events: [] })) as any,
    createJob: (async (_db: any, _companyId: string, _actorUserId: any, input: any) => {
      executed.push(`job:create:${input.title}:${input.clientId}`);
      return {
        id: "job_new_1",
        title: input.title,
        clientId: input.clientId,
        format: input.format || "POST",
      };
    }) as any,
    listJobs: (async () => ({ jobs: [] })) as any,
    getJob: (async () => ({ id: "job_1", title: "Job 1" })) as any,
    updateJob: (async () => ({ id: "job_1" })) as any,
    transitionJobLifecycle: (async () => ({ id: "job_1", lifecycleStatus: "CANCELLED" })) as any,
  };
}

// ── Test Matrix ──────────────────────────────────────────────────────────

describe("F15.4 Customer WhatsApp Runtime + Conversation Pipeline", () => {
  it("Phase 1: Meta customer inbound text creates Conversation + INBOUND message + AI command + Outbound reply", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const model = new FakeLanguageModel({
      kind: "command",
        operation: "calendar.create",
        payload: {
          title: "Consulta Comercial",
          startsAt: "2026-09-01T15:00:00.000Z",
        },

    });
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const event: WhatsAppInboundEvent = {
      provider: "whatsapp",
      providerMessageId: "wamid.in.1",
      senderPhone: "+5511977771111",
      contactName: "Cliente João",
      type: "text",
      text: "Olá, gostaria de agendar uma reunião amanhã às 15h",
      externalAccountId: "phone_number_id_meta_1",
      timestamp: new Date(),
    };

    const channel = await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1");
    expect(channel).not.toBeNull();
    expect(channel!.companyId).toBe("company_a");

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel!,
      event,
    );

    expect(outcome).toBe("processed");
    expect(executed).toContain("appointment:create:Consulta Comercial");
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].to).toBe("+5511977771111");

    // Verify conversation created in DB
    expect(stores.conversations.size).toBe(1);
    const conv = Array.from(stores.conversations.values())[0];
    expect(conv.companyId).toBe("company_a");
    expect(conv.remotePhone).toBe("+5511977771111");
    expect(conv.unreadCount).toBe(1); // Customer inbound increments unread

    // Verify messages: 1 INBOUND (with text) and 1 OUTBOUND (with action APPOINTMENT_CREATED)
    expect(stores.conversationMessages.size).toBe(2);
    const messages = Array.from(stores.conversationMessages.values());
    const inbound = messages.find((m) => m.direction === "INBOUND");
    const outbound = messages.find((m) => m.direction === "OUTBOUND");

    expect(inbound).toBeDefined();
    expect(inbound.body).toBe("Olá, gostaria de agendar uma reunião amanhã às 15h");
    expect(inbound.senderType).toBe("CONTACT");

    expect(outbound).toBeDefined();
    expect(outbound.senderType).toBe("AI");
    expect(outbound.actionType).toBe("APPOINTMENT_CREATED");
    expect(outbound.deliveryStatus).toBe("SENT");
    expect(outbound.providerMessageId).toBe("wamid.out.1");
  });

  it("Phase 2: Gupshup customer inbound text creates Conversation + INBOUND message + AI command + Outbound reply", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeGupshupProvider();
    const model = new FakeLanguageModel({
      kind: "command",
        operation: "calendar.read",
        payload: { mode: "list" },
    });
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const event: WhatsAppInboundEvent = {
      provider: "gupshup",
      providerMessageId: "gs.msg.in.1",
      senderPhone: "+5511977772222",
      contactName: "Maria Gupshup",
      type: "text",
      text: "Quais são meus agendamentos?",
      externalAccountId: "LooplyGupshupApp",
      timestamp: new Date(),
    };

    const channel = await resolveWhatsAppChannelDetails(db, "gupshup", "LooplyGupshupApp");
    expect(channel).not.toBeNull();

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel!,
      event,
    );

    expect(outcome).toBe("processed");
    expect(executed).toContain("appointment:list");
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].to).toBe("+5511977772222");
    expect(stores.conversationMessages.size).toBe(2);
  });

  it("Phase 3: Multi-tenant channel isolation: Channel A maps to Company A; Channel B maps to Company B", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const modelA = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.create", payload: { title: "Job Alpha" },
    });
    const modelB = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.create", payload: { title: "Job Beta" },
    });
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const channelA = await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1");
    const channelB = await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_beta");

    expect(channelA!.companyId).toBe("company_a");
    expect(channelB!.companyId).toBe("company_b");

    await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: modelA, services },
      channelA!,
      {
        provider: "whatsapp",
        providerMessageId: "meta.msg.a",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Mensagem para Alpha",
        externalAccountId: "phone_number_id_meta_1",
      },
    );

    await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: modelB, services },
      channelB!,
      {
        provider: "whatsapp",
        providerMessageId: "meta.msg.b",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Mensagem para Beta",
        externalAccountId: "phone_number_id_meta_beta",
      },
    );

    const convList = Array.from(stores.conversations.values());
    expect(convList.length).toBe(2);
    expect(convList.find((c) => c.companyId === "company_a")).toBeDefined();
    expect(convList.find((c) => c.companyId === "company_b")).toBeDefined();
  });

  it("Phase 4: Fail-closed tenant resolution on unknown externalAccountId / unmapped channel", async () => {
    const { db } = createInMemoryDb();
    const channel = await resolveWhatsAppChannelDetails(db, "whatsapp", "unknown_account_id");
    expect(channel).toBeNull();
  });

  it("Phase 5: Duplicate message idempotency (Redis claim) returns duplicate and triggers no actions", async () => {
    const { db } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const model = new FakeLanguageModel();
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;
    const event: WhatsAppInboundEvent = {
      provider: "whatsapp",
      providerMessageId: "wamid.idempotent.1",
      senderPhone: "+5511977771111",
      type: "text",
      text: "Primeiro envio",
    };

    const first = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel,
      event,
    );
    expect(first).toBe("processed");

    const second = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel,
      event,
    );
    expect(second).toBe("duplicate");
    // Only 1 outbound send happened from the first execution
    expect(provider.outboundSent.length).toBe(1);
  });

  it("Phase 6: Transient store failure fails closed without leaking side-effects", async () => {
    const { db } = createInMemoryDb();
    const store = new FakeStore();
    store.unavailable = true;
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: new FakeLanguageModel() },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.err.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Teste",
      },
    );

    expect(outcome).toBe("transient_failure");
    expect(provider.outboundSent.length).toBe(0);
  });

  it("Phase 7: AI Status PAUSED prevents AI intake and outbound replies while keeping inbound message in timeline", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    // Create existing conversation with PAUSED status
    stores.conversations.set("conv_paused", {
      id: "conv_paused",
      companyId: "company_a",
      provider: "whatsapp",
      remotePhone: "+5511977771111",
      aiStatus: "PAUSED",
      unreadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const model = new FakeLanguageModel();
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.paused.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Preciso de um atendente humano",
      },
    );

    expect(outcome).toBe("paused");
    expect(executed.length).toBe(0);
    expect(provider.outboundSent.length).toBe(0);

    // Inbound message is saved
    const messages = Array.from(stores.conversationMessages.values());
    expect(messages.length).toBe(1);
    expect(messages[0].body).toBe("Preciso de um atendente humano");
  });

  it("Phase 8: Client linked conversation automatically binds clientId to ticket.create", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    // Create existing conversation bound to client_1
    stores.conversations.set("conv_linked", {
      id: "conv_linked",
      companyId: "company_a",
      provider: "whatsapp",
      remotePhone: "+5511977771111",
      clientId: "client_1",
      aiStatus: "ACTIVE",
      unreadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const model = new FakeLanguageModel({
      kind: "command",
        operation: "ticket.create",
        payload: { title: "Post Carrossel de Promoção", format: "CAROUSEL" },
    });
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.job.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Quero solicitar um carrossel",
      },
    );

    expect(outcome).toBe("processed");
    expect(executed).toContain("job:create:Post Carrossel de Promoção:client_1");

    const messages = Array.from(stores.conversationMessages.values());
    const outbound = messages.find((m) => m.direction === "OUTBOUND");
    expect(outbound?.actionType).toBe("JOB_CREATED");
  });

  it("Phase 9: Unlinked conversation with unknown phone prompts customer and flags NEEDS_ATTENTION for ticket.create", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    const model = new FakeLanguageModel({
      kind: "command",
        operation: "ticket.create",
        payload: { title: "Post Anúncio", format: "POST" },
    });
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.unlinked.1",
        senderPhone: "+5511966660000", // Not in Client table
        type: "text",
        text: "Quero criar um post",
      },
    );

    expect(outcome).toBe("needs_attention");
    expect(executed.length).toBe(0); // Job was NOT created without client
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].text).toBe(CUSTOMER_WHATSAPP_COPY.clientRequiredForJob);

    // Conversation flagged as NEEDS_ATTENTION
    const conv = Array.from(stores.conversations.values())[0];
    expect(conv.aiStatus).toBe("NEEDS_ATTENTION");
  });

  it("Phase 10: Confirmation Correlation: calendar.delete saves pending confirmation, 'sim' executes it", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    // Step 1: Customer asks to cancel appointment
    const modelStep1 = new FakeLanguageModel({
      kind: "command",
        operation: "calendar.delete",
        payload: { appointmentId: "apt_1" },
    });

    await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: modelStep1, services },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.del.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Quero cancelar meu agendamento apt_1",
      },
    );

    expect(executed.length).toBe(0); // Not deleted yet!
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].text.toLowerCase()).toContain("confirmar");

    const conv = Array.from(stores.conversations.values())[0];
    const pending = await getPendingConfirmation(store, "company_a", conv.id);
    expect(pending).not.toBeNull();
    expect(pending?.command.operation).toBe("calendar.delete");

    // Step 2: Customer sends positive confirmation "sim"
    const outcomeConfirm = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: new FakeLanguageModel(), services },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.del.2",
        senderPhone: "+5511977771111",
        type: "text",
        text: "SIM",
      },
    );

    expect(outcomeConfirm).toBe("processed");
    expect(executed).toContain("appointment:cancel:apt_1");

    // Pending confirmation is consumed (atomic GETDEL)
    const afterPending = await getPendingConfirmation(store, "company_a", conv.id);
    expect(afterPending).toBeNull();
  });

  it("Phase 11: Confirmation Cancel: negative confirmation 'não' cancels pending action", async () => {
    const { db } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    // Seed pending confirmation
    const conv = await db.conversation.create({
      data: { companyId: "company_a", remotePhone: "+5511977771111" },
    });
    await savePendingConfirmation(store, {
      companyId: "company_a",
      conversationId: conv.id,
      command: { operation: "calendar.delete", payload: { appointmentId: "apt_1" } },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: new FakeLanguageModel(), services },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.cancel.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "não",
      },
    );

    expect(outcome).toBe("processed");
    expect(executed.length).toBe(0); // Nothing deleted
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].text).toBe(CUSTOMER_WHATSAPP_COPY.confirmationCancelled);

    const pending = await getPendingConfirmation(store, "company_a", conv.id);
    expect(pending).toBeNull();
  });

  it("Phase 12: Customer capabilities allowlist restricts forbidden admin operations", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    const model = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.update", // Valid operation, NOT in customer allowlist
      payload: { appointmentId: "apt_1", patch: { title: "Trocado" } },
    });

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.hacker.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Convidar usuário",
      },
    );

    expect(outcome).toBe("processed");
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].text).toBe(CUSTOMER_WHATSAPP_COPY.unsupportedOperation);

    const messages = Array.from(stores.conversationMessages.values());
    const outbound = messages.find((m) => m.direction === "OUTBOUND");
    expect(outbound?.actionType).toBe("AI_ERROR");
  });

  it("Phase 13: Audio Inbound downloads audio, stores to Object Storage, transcribes, and executes AI command", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    provider.mediaToDownload = {
      buffer: Buffer.from("audio stream bytes"),
      contentType: "audio/ogg",
    };
    const storage = new FakeObjectStorage();
    const transcription = new FakeTranscriptionService();
    transcription.textToReturn = "Quero agendar uma reunião";

    const model = new FakeLanguageModel({
      kind: "command",
        operation: "calendar.create",
        payload: { title: "Reunião de Audio", startsAt: "2026-09-05T10:00:00.000Z" },
    });
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    const outcome = await handleCustomerWhatsAppInbound(
      {
        db,
        store,
        provider,
        languageModel: model,
        transcriptionService: transcription,
        storage,
        services,
      },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.audio.1",
        senderPhone: "+5511977771111",
        type: "audio",
        media: { id: "media_audio_id_1", mimeType: "audio/ogg" },
      },
    );

    expect(outcome).toBe("processed");
    expect(executed).toContain("appointment:create:Reunião de Audio");

    // Check Object Storage
    expect(storage.objects.size).toBe(1);
    const storedKey = Array.from(storage.objects.keys())[0];
    expect(storedKey).toContain("conversations/company_a/");
    expect(storedKey).toContain("wamid.audio.1.ogg");

    // Check DB Message
    const messages = Array.from(stores.conversationMessages.values());
    const inbound = messages.find((m) => m.direction === "INBOUND");
    expect(inbound?.type).toBe("AUDIO");
    expect(inbound?.transcription).toBe("Quero agendar uma reunião");
    expect(inbound?.transcriptionStatus).toBe("COMPLETED");
    expect(inbound?.mediaStorageKey).toBe(storedKey);
  });

  it("Phase 14: Audio download failure persists message as FAILED and sends polite retry reply", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    provider.failDownload = true;
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    const outcome = await handleCustomerWhatsAppInbound(
      {
        db,
        store,
        provider,
        languageModel: new FakeLanguageModel(),
        transcriptionService: new FakeTranscriptionService(),
      },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.audio.fail",
        senderPhone: "+5511977771111",
        type: "audio",
        media: { id: "media_fail_id", mimeType: "audio/ogg" },
      },
    );

    expect(outcome).toBe("transient_failure");
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].text).toBe(CUSTOMER_WHATSAPP_COPY.audioDownloadFailure);

    const messages = Array.from(stores.conversationMessages.values());
    const inbound = messages.find((m) => m.direction === "INBOUND");
    expect(inbound?.transcriptionStatus).toBe("FAILED");
  });

  it("Phase 15: Non-audio media (image/document) is persisted and answered with friendly text fallback", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: new FakeLanguageModel() },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.image.1",
        senderPhone: "+5511977771111",
        type: "image",
        media: { id: "img_1", mimeType: "image/jpeg" },
      },
    );

    expect(outcome).toBe("non_text");
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].text).toBe(CUSTOMER_WHATSAPP_COPY.nonAudioMedia);

    const messages = Array.from(stores.conversationMessages.values());
    const inbound = messages.find((m) => m.direction === "INBOUND");
    expect(inbound?.type).toBe("IMAGE");
  });

  it("Phase 16: Monotonic delivery status transitions (PENDING -> SENT -> DELIVERED -> READ)", async () => {
    const { db } = createInMemoryDb();

    // Create an outbound message in PENDING
    await db.conversationMessage.create({
      data: {
        companyId: "company_a",
        conversationId: "conv_1",
        provider: "whatsapp",
        direction: "OUTBOUND",
        senderType: "AI",
        providerMessageId: "wamid.track.1",
        body: "Resposta",
        deliveryStatus: "PENDING",
      },
    });

    // 1. Update to SENT
    const s1 = await updateMessageDeliveryStatus(db, "company_a", "whatsapp", "wamid.track.1", "SENT");
    expect(s1?.deliveryStatus).toBe("SENT");

    // 2. Update to DELIVERED
    const s2 = await updateMessageDeliveryStatus(db, "company_a", "whatsapp", "wamid.track.1", "DELIVERED");
    expect(s2?.deliveryStatus).toBe("DELIVERED");

    // 3. Update to READ
    const s3 = await updateMessageDeliveryStatus(db, "company_a", "whatsapp", "wamid.track.1", "READ");
    expect(s3?.deliveryStatus).toBe("READ");

    // 4. Regression check: Attempt to downgrade READ back to DELIVERED or SENT is ignored
    const s4 = await updateMessageDeliveryStatus(db, "company_a", "whatsapp", "wamid.track.1", "DELIVERED");
    expect(s4?.deliveryStatus).toBe("READ");

    const s5 = await updateMessageDeliveryStatus(db, "company_a", "whatsapp", "wamid.track.1", "SENT");
    expect(s5?.deliveryStatus).toBe("READ");

    // 5. Attempt to transition READ to FAILED is blocked
    const s6 = await updateMessageDeliveryStatus(db, "company_a", "whatsapp", "wamid.track.1", "FAILED");
    expect(s6?.deliveryStatus).toBe("READ");
  });

  it("Phase 17: Gupshup & Meta Status Update Webhook callbacks process delivery transitions", async () => {
    const { db } = createInMemoryDb();

    await db.conversationMessage.create({
      data: {
        companyId: "company_a",
        conversationId: "conv_1",
        provider: "gupshup",
        direction: "OUTBOUND",
        senderType: "AI",
        providerMessageId: "gs.msg.status.1",
        deliveryStatus: "SENT",
      },
    });

    const statusEvent: WhatsAppStatusUpdateEvent = {
      provider: "gupshup",
      providerMessageId: "gs.msg.status.1",
      status: "delivered",
      timestamp: new Date(),
    };

    const handled = await handleWhatsAppStatusUpdate(db, statusEvent);
    expect(handled).toBe(true);

    const updated = await db.conversationMessage.findFirst({
      where: { providerMessageId: "gs.msg.status.1" },
    });
    expect(updated?.deliveryStatus).toBe("DELIVERED");
  });

  it("Phase 18: GET /api/conversations/:id/messages/:messageId/media redirects to presigned download URL", async () => {
    const { db, stores } = createInMemoryDb();
    const storage = new FakeObjectStorage();
    await storage.putObject({
      key: "conversations/company_a/conv_1/msg_1.ogg",
      buffer: Buffer.from("audio data"),
      contentType: "audio/ogg",
    });

    stores.conversations.set("conv_1", {
      id: "conv_1",
      companyId: "company_a",
      provider: "whatsapp",
      remotePhone: "+5511977771111",
    });

    stores.conversationMessages.set("msg_1", {
      id: "msg_1",
      conversationId: "conv_1",
      companyId: "company_a",
      provider: "whatsapp",
      direction: "INBOUND",
      senderType: "CONTACT",
      type: "AUDIO",
      mediaStorageKey: "conversations/company_a/conv_1/msg_1.ogg",
      mediaFilename: "audio.ogg",
      mediaMimeType: "audio/ogg",
    });

    const app = express();
    // Simulate authenticated session middleware setting req.auth
    app.use((req, _res, next) => {
      (req as any).auth = { companyId: "company_a", userId: "user_1" };
      next();
    });
    app.use("/api/conversations", makeConversationsRouter(db, { storage }));

    const res = await request(app).get("/api/conversations/conv_1/messages/msg_1/media");
    expect(res.status).toBe(302); // Redirect to presigned URL
    expect(res.headers.location).toContain("https://storage.test/download/conversations/company_a/conv_1/msg_1.ogg");
  });

  it("Phase 19: Webhook routers dispatch to customer pipeline when channel is CUSTOMER_AI", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const model = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.read", payload: { mode: "list" },
    });

    const outcome = await dispatchWhatsAppInbound(
      {
        db,
        store,
        provider,
        languageModel: model,
        services: makeMockDomainServices([]),
      },
      {
        provider: "whatsapp",
        providerMessageId: "wamid.dispatch.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Ver agenda",
        externalAccountId: "phone_number_id_meta_1",
      },
    );

    expect(outcome).toBe("processed");
    expect(stores.conversations.size).toBe(1);
    expect(provider.outboundSent.length).toBe(1);
  });

  it("Phase 20: Meta Webhook Router HTTP endpoint end-to-end processing", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const model = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.read", payload: { mode: "list" },
    });

    const app = express();
    app.use(
      "/api/webhooks/whatsapp",
      makeWhatsAppWebhookRouter({
        db,
        store,
        provider,
        languageModel: model,
        services: makeMockDomainServices([]),
      }),
    );

    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "biz_1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  phone_number_id: "phone_number_id_meta_1",
                  display_phone_number: "+5511988881111",
                },
                contacts: [{ profile: { name: "Cliente HTTP" }, wa_id: "5511977771111" }],
                messages: [
                  {
                    id: "wamid.http.1",
                    from: "5511977771111",
                    type: "text",
                    text: { body: "Ver agenda via HTTP" },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const raw = Buffer.from(JSON.stringify(payload));
    const crypto = await import("crypto");
    const sig = "sha256=" + crypto.createHmac("sha256", "test_app_secret").update(raw).digest("hex");

    const res = await request(app)
      .post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", sig)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.text).toBe("EVENT_RECEIVED");
    expect(stores.conversations.size).toBe(1);
  });

  it("Phase 21: Gupshup Webhook Router HTTP endpoint end-to-end processing", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeGupshupProvider({ allowlist: ["34.95.34.128"] });
    const model = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.read", payload: { mode: "list" },
    });

    const app = express();
    app.set("trust proxy", true);
    app.use(
      "/api/webhooks/whatsapp/gupshup",
      makeGupshupWebhookRouter({
        db,
        store,
        provider,
        languageModel: model,
        services: makeMockDomainServices([]),
      }),
    );

    const payload = {
      app: "LooplyGupshupApp",
      timestamp: Date.now(),
      version: 2,
      type: "message",
      payload: {
        id: "gs.http.msg.1",
        source: "5511977771111",
        type: "text",
        payload: { text: "Agenda Gupshup HTTP" },
        sender: { name: "Cliente Gupshup HTTP" },
      },
    };

    const res = await request(app)
      .post("/api/webhooks/whatsapp/gupshup")
      .set("X-Forwarded-For", "34.95.34.128")
      .send(payload);

    expect(res.status).toBe(200);
    expect(stores.conversations.size).toBe(1);
  });

  it("Phase 22: Outbound provider send failure persists OUTBOUND with deliveryStatus FAILED", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    provider.failOutbound = true;
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;
    const model = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.read",
      payload: { mode: "list" },
    });
    const executed: string[] = [];
    const services = makeMockDomainServices(executed);

    const outcome = await handleCustomerWhatsAppInbound(
      { db, store, provider, languageModel: model, services },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.failout.1",
        senderPhone: "+5511977771111",
        type: "text",
        text: "Ver agenda",
      },
    );

    expect(outcome).toBe("processed");
    const messages = Array.from(stores.conversationMessages.values());
    const outbound = messages.find((m) => m.direction === "OUTBOUND");
    expect(outbound).toBeDefined();
    expect(outbound.deliveryStatus).toBe("FAILED");
    expect(outbound.providerMessageId).toBeNull();
  });

  it("Phase 23: Audio transcription service failure persists inbound with transcriptionStatus FAILED and sends polite reply", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    provider.mediaToDownload = { buffer: Buffer.from("audio bytes"), contentType: "audio/ogg" };
    const transcription = new FakeTranscriptionService();
    transcription.fail = true;
    const channel = (await resolveWhatsAppChannelDetails(db, "whatsapp", "phone_number_id_meta_1"))!;

    const outcome = await handleCustomerWhatsAppInbound(
      {
        db,
        store,
        provider,
        languageModel: new FakeLanguageModel(),
        transcriptionService: transcription,
      },
      channel,
      {
        provider: "whatsapp",
        providerMessageId: "wamid.trfail.1",
        senderPhone: "+5511977771111",
        type: "audio",
        media: { id: "media_trfail", mimeType: "audio/ogg" },
      },
    );

    expect(outcome).toBe("processed");
    const messages = Array.from(stores.conversationMessages.values());
    const inbound = messages.find((m) => m.direction === "INBOUND");
    expect(inbound?.transcriptionStatus).toBe("FAILED");
    expect(provider.outboundSent.length).toBe(1);
    expect(provider.outboundSent[0].text).toBe(CUSTOMER_WHATSAPP_COPY.transcriptionFailure);
  });

  it("Phase 24: Authorized internal operator on a CUSTOMER_AI channel keeps the internal Assistant flow", async () => {
    const { db, stores } = createInMemoryDb();
    const store = new FakeStore();
    const provider = new FakeWhatsAppProvider();
    const model = new FakeLanguageModel({
      kind: "command",
      operation: "calendar.create",
      payload: { title: "Reunião Operador", startsAt: "2026-09-10T10:00:00.000Z" },
    });

    // Seed an authorized WhatsAppIdentity for the sender (internal operator)
    stores.whatsAppIdentities.set("whatsapp:+5511988883333", {
      userId: "u_op",
      companyId: "company_a",
      enabled: true,
      user: { id: "u_op", active: true },
      company: { id: "company_a", isActive: true, workspaceTemplate: "MARKETING_AGENCY" },
    });

    const executed: string[] = [];
    const outcome = await dispatchWhatsAppInbound(
      { db, store, provider, languageModel: model, services: makeMockDomainServices(executed) },
      {
        provider: "whatsapp",
        providerMessageId: "wamid.op.1",
        senderPhone: "+5511988883333",
        type: "text",
        text: "Agendar reunião",
        externalAccountId: "phone_number_id_meta_1", // CUSTOMER_AI channel
      },
    );

    expect(outcome).toBe("processed");
    expect(executed).toContain("appointment:create:Reunião Operador");
    // The operator's message must NOT create a customer conversation
    expect(stores.conversations.size).toBe(0);
  });
});
