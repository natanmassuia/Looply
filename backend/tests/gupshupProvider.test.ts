import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AssistantDomainServices } from "../src/services/assistantCommandService";
import type { AssistantLanguageModel, AssistantLanguageModelRequest } from "../src/services/assistantLanguageModel";
import type { TransientStore } from "../src/lib/transientStore";
import { redact } from "../src/lib/logger";
import {
  GUPSHUP_PROVIDER_NAME,
  MetaWhatsAppProvider,
  WHATSAPP_PROVIDER_NAME,
  type WhatsAppInboundEvent,
} from "../src/services/whatsappProvider";
import {
  GupshupWhatsAppProvider,
  matchesIpAllowlist,
} from "../src/services/gupshupProvider";
import { handleWhatsAppInboundText } from "../src/services/whatsappTextAdapter";
import { confirmationPrompt } from "../src/services/whatsappReplyFormatter";
import { claimInboundMessage, IDEMPOTENCY_TTL_SECONDS } from "../src/services/whatsappIdempotencyStore";
import { resolveWhatsAppActor, WHATSAPP_IDENTITY_PROVIDER } from "../src/services/whatsappActorService";
import { makeWhatsAppWebhookRouter } from "../src/routes/whatsappWebhook";
import { makeGupshupWebhookRouter } from "../src/routes/whatsappGupshupWebhook";
import { getWhatsAppProvider } from "../src/lib/assistantRuntime";

// ── Fakes ────────────────────────────────────────────────────────────────

class FakeStore implements TransientStore {
  data = new Map<string, { value: string; expiresAt: number }>();
  unavailable = false;
  private guard() { if (this.unavailable) throw new Error("store unavailable"); }
  async get(key: string) {
    this.guard();
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) { this.data.delete(key); return null; }
    return e.value;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.guard();
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    this.guard();
    if (await this.get(key) !== null) return false;
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
  async delete(key: string) { this.guard(); this.data.delete(key); }
}

class FakeLanguageModel implements AssistantLanguageModel {
  public requests: AssistantLanguageModelRequest[] = [];
  private queue: unknown[];
  constructor(output: unknown | unknown[]) {
    this.queue = Array.isArray(output) ? [...output] : [output];
  }
  async generateStructuredOutput(req: AssistantLanguageModelRequest) {
    this.requests.push(req);
    const next = this.queue.length > 1 ? this.queue.shift() : this.queue[0];
    return next;
  }
}

class FakeGupshupProvider extends GupshupWhatsAppProvider {
  public sent: Array<{ to: string; text: string }> = [];
  public failSends = false;
  constructor(opts: { allowlist?: string[] } = {}) {
    super({
      apiKey: "gupshup-api-key",
      appName: "LooplyApp",
      sourceNumber: "5511912345678",
      inboundAllowlist: opts.allowlist ?? ["34.95.34.128"],
      fetchImpl: (async () => ({ ok: true })) as never,
    });
  }
  override async sendText(to: string, text: string) {
    if (this.failSends) throw new Error("send failed");
    this.sent.push({ to, text });
    return {
      providerMessageId: "gup-out-" + this.sent.length,
      provider: "gupshup" as const,
      sentAt: new Date(),
    };
  }
}

function makeDb(seed: { identity?: boolean } = {}) {
  return {
    whatsAppChannel: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
    whatsAppIdentity: {
      findUnique: async () => seed.identity
        ? { userId: "u1", companyId: "c1", enabled: true, user: { id: "u1", active: true }, company: { id: "c1", isActive: true, workspaceTemplate: "MARKETING_AGENCY" } }
        : null,
    },
    companyMember: {
      findUnique: async () => ({ isActive: true }),
    },
    company: {
      findUnique: async () => ({ timezone: "America/Sao_Paulo" }),
    },
    // Any direct domain-model access from the webhook layer fails the test.
    appointment: { findFirst: async () => { throw new Error("webhook must not query appointments"); } },
    job: { findFirst: async () => { throw new Error("webhook must not query jobs"); } },
    client: { findFirst: async () => { throw new Error("webhook must not query clients"); } },
  } as never;
}

function makeServices(calls: string[]): AssistantDomainServices {
  const fn = (name: string, result: unknown) => async (...args: unknown[]) => {
    calls.push(name);
    return typeof result === "function" ? result(args) : result;
  };
  return {
    createAppointment: fn("createAppointment", { id: "a1", title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" }),
    listAppointments: fn("listAppointments", { appointments: [] }),
    getAppointment: fn("getAppointment", { id: "a1", title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" }),
    updateAppointment: fn("updateAppointment", { id: "a1" }),
    cancelAppointment: fn("cancelAppointment", { id: "a1" }),
    getCalendar: fn("getCalendar", { events: [] }),
    createJob: fn("createJob", { id: "j1", title: "Chamado" }),
    listJobs: fn("listJobs", { jobs: [] }),
    getJob: fn("getJob", { id: "j1", title: "Chamado", client: { name: "ACME" } }),
    updateJob: fn("updateJob", { id: "j1" }),
    transitionJobLifecycle: fn("transitionJobLifecycle", { id: "j1", lifecycleStatus: "CANCELLED" }),
  } as unknown as AssistantDomainServices;
}

const PHONE = "+5511987654321";
const GUPSHUP_ID = "ABEGkYaYVSEEAhAL3SLAWwHKeKrt6s3FKB0c";
const MS_TIMESTAMP = 1580227766370;

function gupshupMessage(opts: {
  id?: string;
  source?: string;
  type?: string;
  text?: string;
  timestamp?: number;
  app?: string;
  senderName?: string;
  version?: unknown;
} = {}) {
  const id = opts.id ?? GUPSHUP_ID;
  const source = opts.source ?? "5511987654321";
  return {
    app: opts.app ?? "GupShupWhatsAppApp",
    timestamp: opts.timestamp ?? MS_TIMESTAMP,
    version: opts.version ?? 2,
    type: "message",
    payload: {
      id,
      source,
      type: opts.type ?? "text",
      payload: opts.type && opts.type !== "text" ? {} : { text: opts.text ?? "cria um compromisso" },
      sender: { phone: source, name: opts.senderName ?? "Ana", country_code: "+55", dial_code: "+55" },
      context: { id, gsId: "0" },
    },
  };
}

function transportEvent(type: string) {
  return { app: "GupShupWhatsAppApp", timestamp: MS_TIMESTAMP, version: 2, type, payload: { id: GUPSHUP_ID, source: "5511987654321" } };
}

function gupshupEvent(overrides: Partial<WhatsAppInboundEvent> = {}): WhatsAppInboundEvent {
  return {
    provider: GUPSHUP_PROVIDER_NAME,
    providerMessageId: GUPSHUP_ID,
    senderPhone: PHONE,
    type: "text",
    text: "cria um compromisso",
    ...overrides,
  };
}

function makeDeps(output: unknown, opts: { identity?: boolean } = {}) {
  const calls: string[] = [];
  const store = new FakeStore();
  const provider = new FakeGupshupProvider();
  const model = new FakeLanguageModel(output);
  const deps = {
    db: makeDb({ identity: opts.identity !== false }),
    store,
    provider,
    languageModel: model,
    services: makeServices(calls),
  };
  return { deps, calls, store, provider, model };
}

function makeFetchRecorder() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return new Response(null, { status: 200 });
  };
  return { calls, fetchImpl };
}

// ── Inbound normalization (Gupshup V2) ───────────────────────────────────

describe("Gupshup inbound normalization", () => {
  const provider = new GupshupWhatsAppProvider({});

  it("normalizes a V2 text message with id/source preserved", () => {
    const events = provider.normalizeInbound(gupshupMessage());
    expect(events).toEqual([{
      provider: GUPSHUP_PROVIDER_NAME,
      providerMessageId: GUPSHUP_ID,
      senderPhone: "5511987654321",
      type: "text",
      text: "cria um compromisso",
      timestamp: new Date(MS_TIMESTAMP),
      externalAccountId: "GupShupWhatsAppApp",
      contactName: "Ana",
    }]);
  });

  it("converts the top-level millisecond timestamp to a Date", () => {
    const events = provider.normalizeInbound(gupshupMessage({ timestamp: 1760000000123 }));
    expect(events[0].timestamp).toEqual(new Date(1760000000123));
  });

  it("ignores all transport events (message-event, user-event, system-event, billing-event, template-event)", () => {
    for (const type of ["message-event", "user-event", "system-event", "billing-event", "template-event"]) {
      expect(provider.normalizeInbound(transportEvent(type))).toEqual([]);
    }
  });

  it("maps non-text message types to the canonical event type", () => {
    const cases: Array<[string, WhatsAppInboundEvent["type"]]> = [
      ["image", "image"],
      ["audio", "audio"],
      ["video", "video"],
      ["file", "document"],
    ];
    for (const [inType, outType] of cases) {
      const events = provider.normalizeInbound(gupshupMessage({ type: inType }));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(outType);
      expect(events[0].text).toBeUndefined();
    }
  });

  it("maps contact/location/button_reply/list_reply to other", () => {
    for (const type of ["contact", "location", "button_reply", "list_reply"]) {
      const events = provider.normalizeInbound(gupshupMessage({ type }));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("other");
      expect(events[0].text).toBeUndefined();
    }
  });

  it("extracts externalAccountId and contactName while dropping raw transport context", () => {
    const events = provider.normalizeInbound(gupshupMessage({ app: "SomeOtherApp", senderName: "Sender Name" }));
    expect(events[0]).toEqual({
      provider: GUPSHUP_PROVIDER_NAME,
      providerMessageId: GUPSHUP_ID,
      senderPhone: "5511987654321",
      type: "text",
      text: "cria um compromisso",
      timestamp: new Date(MS_TIMESTAMP),
      externalAccountId: "SomeOtherApp",
      contactName: "Sender Name",
    });
    expect(Object.keys(events[0]).sort()).toEqual([
      "contactName", "externalAccountId", "provider", "providerMessageId", "senderPhone", "text", "timestamp", "type",
    ]);
  });

  it("skips messages without an id or a source", () => {
    expect(provider.normalizeInbound(gupshupMessage({ id: "" }))).toEqual([]);
    expect(provider.normalizeInbound(gupshupMessage({ source: "" }))).toEqual([]);
  });

  it("skips text messages without a text body", () => {
    const payload = gupshupMessage({ text: "" });
    (payload.payload as { payload: { text: string } }).payload.text = "";
    expect(provider.normalizeInbound(payload)).toEqual([]);
  });

  it("returns [] for junk payloads", () => {
    expect(provider.normalizeInbound(null)).toEqual([]);
    expect(provider.normalizeInbound("junk")).toEqual([]);
    expect(provider.normalizeInbound([])).toEqual([]);
    expect(provider.normalizeInbound({})).toEqual([]);
  });

  it("skips unknown top-level types and message rows without a payload.type", () => {
    expect(provider.normalizeInbound(transportEvent("mystery-event"))).toEqual([]);
    const payload = gupshupMessage();
    delete (payload.payload as { type?: string }).type;
    expect(provider.normalizeInbound(payload)).toEqual([]);
  });

  it("skips a message whose payload is not an object", () => {
    const payload = gupshupMessage() as { payload: unknown };
    payload.payload = "nope";
    expect(provider.normalizeInbound(payload)).toEqual([]);
  });

  it("leaves the sender phone raw for canonical downstream normalization (no early normalization)", () => {
    const events = provider.normalizeInbound(gupshupMessage({ source: "11 98765-4321" }));
    expect(events[0].senderPhone).toBe("11 98765-4321");
  });
});

// ── Provider separation ──────────────────────────────────────────────────

describe("Provider separation (whatsapp | gupshup)", () => {
  it("defines two distinct canonical provider values", () => {
    expect(WHATSAPP_PROVIDER_NAME).toBe("whatsapp");
    expect(GUPSHUP_PROVIDER_NAME).toBe("gupshup");
    expect(GUPSHUP_PROVIDER_NAME).not.toBe(WHATSAPP_PROVIDER_NAME);
  });

  it("normalized events carry their own provider namespace", () => {
    const gupshup = new GupshupWhatsAppProvider({}).normalizeInbound(gupshupMessage());
    expect(gupshup[0].provider).toBe(GUPSHUP_PROVIDER_NAME);
    const meta = new MetaWhatsAppProvider({}).normalizeInbound({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.x", from: "5511987654321", type: "text", text: { body: "oi" } }] } }] }],
    });
    expect(meta[0].provider).toBe(WHATSAPP_PROVIDER_NAME);
  });

  it("idempotency claims are namespaced per provider so the same id never collides", async () => {
    const store = new FakeStore();
    expect(await claimInboundMessage(store, WHATSAPP_PROVIDER_NAME, "wamid.shared")).toBe(true);
    expect(await claimInboundMessage(store, GUPSHUP_PROVIDER_NAME, "wamid.shared")).toBe(true);
    expect([...store.data.keys()]).toEqual([
      "looply:whatsapp:idempotency:whatsapp:wamid.shared",
      "looply:whatsapp:idempotency:gupshup:wamid.shared",
    ]);
  });

  it("actor resolution is provider-isolated: a gupshup identity never resolves for another provider", async () => {
    const db = {
      whatsAppIdentity: {
        findUnique: async ({ where }: { where: { provider_phoneNumber: { provider: string; phoneNumber: string } } }) => {
          if (where.provider_phoneNumber.provider !== GUPSHUP_PROVIDER_NAME) return null;
          return { userId: "u1", companyId: "cA", enabled: true, user: { id: "u1", active: true }, company: { id: "cA", isActive: true, workspaceTemplate: "MARKETING_AGENCY" } };
        },
      },
      companyMember: { findUnique: async () => ({ isActive: true }) },
    } as never;
    expect(await resolveWhatsAppActor(db, GUPSHUP_PROVIDER_NAME, PHONE)).not.toBeNull();
    expect(await resolveWhatsAppActor(db, WHATSAPP_PROVIDER_NAME, PHONE)).toBeNull();
    expect(await resolveWhatsAppActor(db, "telegram", PHONE)).toBeNull();
  });

  it("getWhatsAppProvider resolves the right instance per provider name", () => {
    expect(getWhatsAppProvider(WHATSAPP_PROVIDER_NAME)).toBeInstanceOf(MetaWhatsAppProvider);
    expect(getWhatsAppProvider(GUPSHUP_PROVIDER_NAME)).toBeInstanceOf(GupshupWhatsAppProvider);
  });

  it("inbound/outbound configuration is independent between providers", () => {
    const metaOnly = new MetaWhatsAppProvider({ verifyToken: "v", appSecret: "s" });
    expect(metaOnly.inboundConfigured()).toBe(true);
    expect(new GupshupWhatsAppProvider({}).inboundConfigured()).toBe(false);
    const gupshup = new GupshupWhatsAppProvider({ apiKey: "k", appName: "a", sourceNumber: "1", inboundAllowlist: ["10.0.0.1"] });
    expect(gupshup.inboundConfigured()).toBe(true);
    expect(gupshup.outboundConfigured()).toBe(true);
    expect(metaOnly.outboundConfigured()).toBe(false);
  });
});

// ── Idempotency ──────────────────────────────────────────────────────────

describe("Gupshup idempotency", () => {
  it("claims first delivery and rejects the duplicate", async () => {
    const store = new FakeStore();
    expect(await claimInboundMessage(store, GUPSHUP_PROVIDER_NAME, GUPSHUP_ID)).toBe(true);
    expect(await claimInboundMessage(store, GUPSHUP_PROVIDER_NAME, GUPSHUP_ID)).toBe(false);
  });

  it("dedupes a duplicate Gupshup webhook through the adapter (one outbound only)", async () => {
    const { deps, calls, provider, model } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" } });
    expect(await handleWhatsAppInboundText(deps, gupshupEvent())).toBe("processed");
    expect(await handleWhatsAppInboundText(deps, gupshupEvent())).toBe("duplicate");
    expect(model.requests).toHaveLength(1);
    expect(calls).toEqual(["createAppointment"]);
    expect(provider.sent).toHaveLength(1);
  });

  it("the same message id across providers yields two independent claims", async () => {
    const store = new FakeStore();
    const id = "wamid.cross";
    expect(await claimInboundMessage(store, WHATSAPP_PROVIDER_NAME, id)).toBe(true);
    expect(await claimInboundMessage(store, GUPSHUP_PROVIDER_NAME, id)).toBe(true);
  });

  it("rejects unsafe provider/id values before touching the store", async () => {
    const store = new FakeStore();
    await expect(claimInboundMessage(store, "bad provider!", GUPSHUP_ID)).rejects.toMatchObject({ status: 400 });
    await expect(claimInboundMessage(store, GUPSHUP_PROVIDER_NAME, "bad/id")).rejects.toMatchObject({ status: 400 });
    expect(store.data.size).toBe(0);
  });

  it("uses the 48h TTL for claims", async () => {
    expect(IDEMPOTENCY_TTL_SECONDS).toBe(48 * 60 * 60);
    const store = new FakeStore();
    await claimInboundMessage(store, GUPSHUP_PROVIDER_NAME, GUPSHUP_ID);
    const stored = store.data.get(`looply:whatsapp:idempotency:gupshup:${GUPSHUP_ID}`)!;
    expect(stored.expiresAt - Date.now()).toBeGreaterThan(IDEMPOTENCY_TTL_SECONDS * 1000 - 5000);
  });
});

// ── Actor / tenant resolution ────────────────────────────────────────────

describe("Gupshup actor resolution", () => {
  it("resolves an authorized gupshup sender to the WhatsAppIdentity actor", async () => {
    const { deps } = makeDeps({ kind: "command", operation: "calendar.read", payload: { mode: "list" } });
    expect(await handleWhatsAppInboundText(deps, gupshupEvent())).toBe("processed");
  });

  it("app name is never tenant authority (dropped before resolution)", async () => {
    const { deps, calls } = makeDeps({ kind: "command", operation: "calendar.read", payload: { mode: "list" } });
    const evt = gupshupEvent();
    const normalized = new GupshupWhatsAppProvider({}).normalizeInbound(gupshupMessage({ app: "SpyApp" }));
    await handleWhatsAppInboundText(deps, { ...evt, providerMessageId: "id.app", senderPhone: normalized[0].senderPhone });
    expect(calls).toEqual(["listAppointments"]);
  });

  it("the payload source number (business line) is not a tenant selector", async () => {
    const { deps, calls } = makeDeps({ kind: "command", operation: "ticket.read", payload: { mode: "list" } });
    await handleWhatsAppInboundText(deps, gupshupEvent({ providerMessageId: "id.src", senderPhone: "5511912345678" }));
    expect(calls).toEqual(["listJobs"]);
  });

  it("never consults the client table for actor resolution", async () => {
    const { deps, calls } = makeDeps({ kind: "command", operation: "calendar.read", payload: { mode: "list" } });
    // makeDb's client.findFirst throws — reaching it fails the test.
    await handleWhatsAppInboundText(deps, gupshupEvent());
    expect(calls).toEqual(["listAppointments"]);
  });

  it("returns unauthorized for an unknown gupshup sender with no domain/model work", async () => {
    const { deps, calls, provider, model } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "x", startsAt: "2026-09-02T14:00:00.000Z" } }, { identity: false });
    expect(await handleWhatsAppInboundText(deps, gupshupEvent())).toBe("unauthorized");
    expect(provider.sent.at(-1)?.text).toBe("Este número não possui acesso ao Looply.");
    expect(calls).toEqual([]);
    expect(model.requests).toHaveLength(0);
  });

  it("applies canonical phone normalization before the identity lookup", async () => {
    const db = {
      whatsAppIdentity: {
        findUnique: async ({ where }: { where: { provider_phoneNumber: { provider: string; phoneNumber: string } } }) =>
          where.provider_phoneNumber.phoneNumber === PHONE
            ? { userId: "u1", companyId: "cA", enabled: true, user: { id: "u1", active: true }, company: { id: "cA", isActive: true, workspaceTemplate: "MARKETING_AGENCY" } }
            : null,
      },
      companyMember: { findUnique: async () => ({ isActive: true }) },
    } as never;
    expect(await resolveWhatsAppActor(db, GUPSHUP_PROVIDER_NAME, "11 98765-4321")).not.toBeNull();
    expect(await resolveWhatsAppActor(db, GUPSHUP_PROVIDER_NAME, "1198765432")).toBeNull();
  });

  it("sender.name / country_code spoofing cannot change resolution (phone is the only authority)", async () => {
    const { deps, calls } = makeDeps({ kind: "command", operation: "calendar.read", payload: { mode: "list" } });
    const evt = gupshupEvent({ providerMessageId: "id.name" });
    await handleWhatsAppInboundText(deps, evt);
    expect(calls).toEqual(["listAppointments"]);
  });
});

// ── Outbound ─────────────────────────────────────────────────────────────

describe("Gupshup outbound", () => {
  const BASE = { apiKey: "gupshup-api-key", appName: "LooplyApp", sourceNumber: "5511912345678" };

  it("posts to the official wa/api/v1/msg endpoint", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    const provider = new GupshupWhatsAppProvider({ ...BASE, fetchImpl });
    await provider.sendText(PHONE, "olá");
    expect(calls[0].url).toBe("https://api.gupshup.io/wa/api/v1/msg");
  });

  it("sends the form-urlencoded content type", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    expect((calls[0].init!.headers as Record<string, string>)["content-type"]).toBe("application/x-www-form-urlencoded");
  });

  it("sends the configured apikey header", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    expect((calls[0].init!.headers as Record<string, string>)["apikey"]).toBe("gupshup-api-key");
  });

  it("encodes channel=whatsapp in the body", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    const body = new URLSearchParams(calls[0].init!.body as string);
    expect(body.get("channel")).toBe("whatsapp");
  });

  it("encodes the configured source number in the body", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    const body = new URLSearchParams(calls[0].init!.body as string);
    expect(body.get("source")).toBe("5511912345678");
  });

  it("encodes the destination phone in the body", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    const body = new URLSearchParams(calls[0].init!.body as string);
    expect(body.get("destination")).toBe(PHONE);
  });

  it("encodes the configured app name as src.name", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    const body = new URLSearchParams(calls[0].init!.body as string);
    expect(body.get("src.name")).toBe("LooplyApp");
  });

  it("sends the text message as a JSON object", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    const body = new URLSearchParams(calls[0].init!.body as string);
    expect(JSON.parse(body.get("message")!)).toEqual({ type: "text", text: "olá" });
  });

  it("throws on a non-2xx response (outbound failure, never surfaced raw)", async () => {
    const fetchImpl = (async () => new Response(null, { status: 500 })) as never;
    const provider = new GupshupWhatsAppProvider({ ...BASE, fetchImpl });
    await expect(provider.sendText(PHONE, "olá")).rejects.toThrow("Gupshup outbound send failed");
  });

  it("uses a bounded AbortSignal timeout on the request", async () => {
    const { calls, fetchImpl } = makeFetchRecorder();
    await new GupshupWhatsAppProvider({ ...BASE, fetchImpl }).sendText(PHONE, "olá");
    expect(calls[0].init!.signal).toBeInstanceOf(AbortSignal);
  });

  it("a failed outbound send does NOT rerun the domain command", async () => {
    const { deps, calls, provider } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" } });
    provider.failSends = true;
    expect(await handleWhatsAppInboundText(deps, gupshupEvent())).toBe("processed");
    expect(calls).toEqual(["createAppointment"]);
  });
});

// ── Confirmation flow ────────────────────────────────────────────────────

describe("Gupshup confirmation flow", () => {
  const deleteOutput = { kind: "command", operation: "ticket.delete", payload: { jobId: "j1" } };

  it("stores the exact command on confirmation-required mutations without executing", async () => {
    const { deps, calls, provider, store } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, gupshupEvent({ text: "cancela o chamado 123" }));
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(confirmationPrompt("ticket.delete"));
    const raw = store.data.get("looply:assistant:confirmation:c1:u1");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!.value).command).toEqual({ operation: "ticket.delete", payload: { jobId: "j1" } });
  });

  it("SIM consumes the pending command and executes exactly once", async () => {
    const { deps, calls, provider } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, gupshupEvent({ text: "cancela o chamado 123" }));
    await handleWhatsAppInboundText(deps, gupshupEvent({ providerMessageId: "g.2", text: "SIM" }));
    expect(calls).toEqual(["transitionJobLifecycle"]);
    expect(provider.sent.at(-1)?.text).toBe("Chamado cancelado.");
  });

  it("duplicate webhook of a confirmation-required request creates no second pending state", async () => {
    const { deps, store, provider } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, gupshupEvent());
    await handleWhatsAppInboundText(deps, gupshupEvent());
    expect([...store.data.keys()].filter((k) => k.includes("confirmation"))).toHaveLength(1);
    expect(provider.sent).toHaveLength(1);
  });

  it("confirmation phrases are exact string matches — the LLM is never consulted", async () => {
    const { deps, model } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, gupshupEvent({ providerMessageId: "g.3", text: "CONFIRMO   " }));
    expect(model.requests).toHaveLength(0);
  });

  it("a negative response clears the pending action without mutation", async () => {
    const { deps, calls, provider } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, gupshupEvent({ text: "cancela o chamado 123" }));
    await handleWhatsAppInboundText(deps, gupshupEvent({ providerMessageId: "g.4", text: "não" }));
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe("Ação cancelada.");
  });

  it("stores the gupshup provider message id as the confirmation correlationId", async () => {
    const { deps, store } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, gupshupEvent({ providerMessageId: GUPSHUP_ID, text: "cancela o chamado 123" }));
    const raw = JSON.parse(store.data.get("looply:assistant:confirmation:c1:u1")!.value);
    expect(raw.correlationId).toBe(GUPSHUP_ID);
  });
});

// ── Meta regression ──────────────────────────────────────────────────────

describe("Meta provider regression (unchanged)", () => {
  const secret = "app-secret";
  const body = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const metaProvider = new MetaWhatsAppProvider({ verifyToken: "v", appSecret: secret });

  it("HMAC signature verification still accepts valid and rejects invalid", () => {
    expect(metaProvider.isValidSignature(body, signature)).toBe(true);
    expect(metaProvider.isValidSignature(body, "sha256=deadbeef")).toBe(false);
    expect(metaProvider.isValidSignature(body, undefined)).toBe(false);
  });

  it("Meta normalization still emits WHATSAPP_PROVIDER_NAME events", () => {
    const events = metaProvider.normalizeInbound({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.9", from: "5511987654321", timestamp: "1760000000", type: "text", text: { body: "oi" } }] } }] }],
    });
    expect(events[0].provider).toBe(WHATSAPP_PROVIDER_NAME);
    expect(events[0].text).toBe("oi");
  });

  it("the Meta webhook route still accepts a signed webhook and acks EVENT_RECEIVED", async () => {
    const app = express();
    const provider = new MetaWhatsAppProvider({ verifyToken: "v", appSecret: secret, accessToken: "t", phoneNumberId: "p", fetchImpl: (async () => ({ ok: true })) as never });
    app.use("/api/webhooks/whatsapp", makeWhatsAppWebhookRouter({
      db: makeDb({ identity: true }) as never,
      provider,
      store: new FakeStore(),
      languageModel: new FakeLanguageModel({ kind: "command", operation: "calendar.read", payload: { mode: "list" } }),
      services: makeServices([]),
    }));
    const signedBody = Buffer.from(JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.reg", from: "5511987654321", type: "text", text: { body: "quais compromissos" } }] } }] }],
    }));
    const response = await request(app)
      .post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", `sha256=${createHmac("sha256", secret).update(signedBody).digest("hex")}`)
      .send(signedBody);
    expect(response.status).toBe(200);
    expect(response.text).toBe("EVENT_RECEIVED");
  });

  it("Meta actor resolution still uses WHATSAPP_IDENTITY_PROVIDER", () => {
    expect(WHATSAPP_IDENTITY_PROVIDER).toBe("whatsapp");
  });

  it("Meta idempotency namespace is unchanged (provider=whatsapp)", async () => {
    const store = new FakeStore();
    await claimInboundMessage(store, WHATSAPP_PROVIDER_NAME, "wamid.reg");
    expect(store.data.has("looply:whatsapp:idempotency:whatsapp:wamid.reg")).toBe(true);
  });
});

// ── Webhook HTTP route (security per actual capability) ──────────────────

function gupshupApp(deps: { store: TransientStore | null; provider: GupshupWhatsAppProvider }) {
  const app = express();
  app.set("trust proxy", true);
  app.use("/api/webhooks/whatsapp/gupshup", makeGupshupWebhookRouter({
    db: makeDb({ identity: true }) as never,
    provider: deps.provider,
    store: deps.store,
    languageModel: new FakeLanguageModel({ kind: "command", operation: "calendar.create", payload: { title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" } }),
    services: makeServices([]),
  }));
  return app;
}

function gupshupBody(messageId: string, text: string) {
  return Buffer.from(JSON.stringify(gupshupMessage({ id: messageId, text })));
}

describe("Gupshup webhook route", () => {
  it("fails closed (503) when the IP allowlist is not configured", async () => {
    const app = gupshupApp({ store: new FakeStore(), provider: new GupshupWhatsAppProvider({}) });
    const response = await request(app).post("/api/webhooks/whatsapp/gupshup").send(gupshupBody("g.http.1", "x"));
    expect(response.status).toBe(503);
  });

  it("rejects 401 a request from an IP outside the allowlist", async () => {
    const app = gupshupApp({ store: new FakeStore(), provider: new FakeGupshupProvider({ allowlist: ["34.95.34.128"] }) });
    const response = await request(app)
      .post("/api/webhooks/whatsapp/gupshup")
      .set("X-Forwarded-For", "203.0.113.7")
      .send(gupshupBody("g.http.2", "cria um compromisso"));
    expect(response.status).toBe(401);
  });

  it("accepts an allowlisted IP, runs the pipeline, and acks 200 empty", async () => {
    const app = gupshupApp({ store: new FakeStore(), provider: new FakeGupshupProvider({ allowlist: ["34.95.34.128"] }) });
    const response = await request(app)
      .post("/api/webhooks/whatsapp/gupshup")
      .set("X-Forwarded-For", "34.95.34.128")
      .send(gupshupBody("g.http.3", "cria um compromisso"));
    expect(response.status).toBe(200);
    expect(response.text).toBe("");
  });

  it("rejects malformed JSON with 400", async () => {
    const app = gupshupApp({ store: new FakeStore(), provider: new FakeGupshupProvider({ allowlist: ["34.95.34.128"] }) });
    const response = await request(app)
      .post("/api/webhooks/whatsapp/gupshup")
      .set("X-Forwarded-For", "34.95.34.128")
      .send(Buffer.from("not json"));
    expect(response.status).toBe(400);
  });

  it("fails closed (503) when the transient store is unavailable", async () => {
    const app = gupshupApp({ store: null, provider: new FakeGupshupProvider({ allowlist: ["34.95.34.128"] }) });
    const response = await request(app)
      .post("/api/webhooks/whatsapp/gupshup")
      .set("X-Forwarded-For", "34.95.34.128")
      .send(gupshupBody("g.http.4", "x"));
    expect(response.status).toBe(503);
  });

  it("the Meta route still owns its root path and the Gupshup route does not shadow it", async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use("/api/webhooks/whatsapp/gupshup", makeGupshupWebhookRouter({
      db: makeDb({ identity: true }) as never,
      provider: new FakeGupshupProvider({ allowlist: ["34.95.34.128"] }),
      store: new FakeStore(),
      languageModel: new FakeLanguageModel({ kind: "command", operation: "calendar.read", payload: { mode: "list" } }),
      services: makeServices([]),
    }));
    app.use("/api/webhooks/whatsapp", makeWhatsAppWebhookRouter({
      db: makeDb({ identity: true }) as never,
      provider: new MetaWhatsAppProvider({ verifyToken: "v", appSecret: "s", accessToken: "t", phoneNumberId: "p", fetchImpl: (async () => ({ ok: true })) as never }),
      store: new FakeStore(),
      languageModel: new FakeLanguageModel({ kind: "command", operation: "calendar.read", payload: { mode: "list" } }),
      services: makeServices([]),
    }));
    const metaBody = Buffer.from(JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.shadow", from: "5511987654321", type: "text", text: { body: "x" } }] } }] }],
    }));
    const metaRes = await request(app)
      .post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", `sha256=${createHmac("sha256", "s").update(metaBody).digest("hex")}`)
      .send(metaBody);
    expect(metaRes.status).toBe(200);
    expect(metaRes.text).toBe("EVENT_RECEIVED");
  });
});

// ── IP allowlist unit (the documented authenticity boundary) ─────────────

describe("Gupshup IP allowlist matching", () => {
  it("matches exact IPv4 entries", () => {
    expect(matchesIpAllowlist("34.95.34.128", ["34.95.34.128"])).toBe(true);
    expect(matchesIpAllowlist("34.95.34.129", ["34.95.34.128"])).toBe(false);
  });

  it("matches IPv4 CIDR entries", () => {
    expect(matchesIpAllowlist("34.95.42.10", ["34.95.0.0/16"])).toBe(true);
    expect(matchesIpAllowlist("34.96.42.10", ["34.95.0.0/16"])).toBe(false);
  });

  it("matches exact IPv6 entries", () => {
    expect(matchesIpAllowlist("2001:db8::1", ["2001:db8::1"])).toBe(true);
    expect(matchesIpAllowlist("2001:db8::2", ["2001:db8::1"])).toBe(false);
  });

  it("fails closed on empty allowlist, missing ip, and malformed input", () => {
    expect(matchesIpAllowlist("34.95.34.128", [])).toBe(false);
    expect(matchesIpAllowlist(undefined, ["34.95.34.128"])).toBe(false);
    expect(matchesIpAllowlist("not-an-ip", ["34.95.34.128"])).toBe(false);
    expect(matchesIpAllowlist("34.95.34.128", ["not-an-ip"])).toBe(false);
    expect(matchesIpAllowlist("34.95.34.128", ["34.95.34.999"])).toBe(false);
  });

  it("skips malformed entries without granting access and trims whitespace", () => {
    expect(matchesIpAllowlist("34.95.34.128", [" 34.95.34.128 "])).toBe(true);
    expect(matchesIpAllowlist("34.95.34.128", ["", "junk/33"])).toBe(false);
  });

  it("does not let an IPv4 entry match an IPv6 request or vice versa", () => {
    expect(matchesIpAllowlist("2001:db8::1", ["34.95.34.128"])).toBe(false);
    expect(matchesIpAllowlist("34.95.34.128", ["2001:db8::1"])).toBe(false);
  });
});

// ── Secrets handling ─────────────────────────────────────────────────────

describe("Gupshup secret handling", () => {
  it("the structured logger redacts apikey fields", () => {
    expect(redact({ apikey: "super-secret", ok: true })).toEqual({ apikey: "[redacted]", ok: true });
  });
});