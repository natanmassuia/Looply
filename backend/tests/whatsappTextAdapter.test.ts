import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AssistantDomainServices } from "../src/services/assistantCommandService";
import type { AssistantLanguageModel, AssistantLanguageModelRequest } from "../src/services/assistantLanguageModel";
import type { TransientStore } from "../src/lib/transientStore";
import { MetaWhatsAppProvider, WHATSAPP_PROVIDER_NAME, type WhatsAppInboundEvent } from "../src/services/whatsappProvider";
import { handleWhatsAppInboundText } from "../src/services/whatsappTextAdapter";
import { formatAssistantResult, WHATSAPP_MAX_LIST_ITEMS, confirmationPrompt } from "../src/services/whatsappReplyFormatter";
import { makeWhatsAppWebhookRouter } from "../src/routes/whatsappWebhook";

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

class FakeWhatsAppProvider extends MetaWhatsAppProvider {
  public sent: Array<{ to: string; text: string }> = [];
  public failSends = false;
  constructor() {
    super({ verifyToken: "verify-token", appSecret: "app-secret", accessToken: "token", phoneNumberId: "phone-id", fetchImpl: (async () => ({ ok: true })) as never });
  }
  override async sendText(to: string, text: string) {
    if (this.failSends) throw new Error("send failed");
    this.sent.push({ to, text });
    return {
      providerMessageId: "meta-out-" + this.sent.length,
      provider: "whatsapp" as const,
      sentAt: new Date(),
    };
  }
}

function makeDb(seed: { identity?: boolean; membershipActive?: boolean }) {
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
      findUnique: async () => seed.membershipActive === false ? { isActive: false } : { isActive: true },
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
    listAppointments: fn("listAppointments", { appointments: Array.from({ length: 15 }, (_, i) => ({ title: `Item ${i + 1}`, startsAt: "2026-09-02T14:00:00.000Z" })) }),
    getAppointment: fn("getAppointment", { id: "a1", title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" }),
    updateAppointment: fn("updateAppointment", { id: "a1" }),
    cancelAppointment: fn("cancelAppointment", { id: "a1" }),
    getCalendar: fn("getCalendar", { events: Array.from({ length: 15 }, (_, i) => ({ title: `Evento ${i + 1}`, at: "2026-09-02T14:00:00.000Z" })) }),
    createJob: fn("createJob", { id: "j1", title: "Chamado" }),
    listJobs: fn("listJobs", { jobs: Array.from({ length: 15 }, (_, i) => ({ title: `Chamado ${i + 1}`, lifecycleStatus: "OPEN" })) }),
    getJob: fn("getJob", { id: "j1", title: "Chamado", client: { name: "ACME" } }),
    updateJob: fn("updateJob", { id: "j1" }),
    transitionJobLifecycle: fn("transitionJobLifecycle", { id: "j1", lifecycleStatus: "CANCELLED" }),
  } as unknown as AssistantDomainServices;
}

const PHONE = "+5511987654321";

function textEvent(overrides: Partial<WhatsAppInboundEvent> = {}): WhatsAppInboundEvent {
  return {
    provider: WHATSAPP_PROVIDER_NAME,
    providerMessageId: "wamid.1",
    senderPhone: PHONE,
    type: "text",
    text: "cria um compromisso",
    ...overrides,
  };
}

function makeDeps(output: unknown, opts: { identity?: boolean; membershipActive?: boolean } = {}) {
  const calls: string[] = [];
  const store = new FakeStore();
  const provider = new FakeWhatsAppProvider();
  const model = new FakeLanguageModel(output);
  const deps = {
    db: makeDb({ identity: opts.identity !== false, membershipActive: opts.membershipActive !== false }),
    store,
    provider,
    languageModel: model,
    services: makeServices(calls),
  };
  return { deps, calls, store, provider, model };
}

// ── Provider: signature, verification, normalization ─────────────────────

describe("WhatsApp provider", () => {
  const provider = new MetaWhatsAppProvider({ verifyToken: "verify-token", appSecret: "app-secret" });

  it("accepts a valid signature and rejects invalid ones", () => {
    const body = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));
    const signature = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
    expect(provider.isValidSignature(body, signature)).toBe(true);
    expect(provider.isValidSignature(body, "sha256=deadbeef")).toBe(false);
    expect(provider.isValidSignature(body, undefined)).toBe(false);
    expect(provider.isValidSignature(body, "sha256=" + "0".repeat(64))).toBe(false);
    expect(new MetaWhatsAppProvider({}).isValidSignature(body, signature)).toBe(false);
  });

  it("verifies the GET subscription handshake exactly", () => {
    expect(provider.isValidVerification("subscribe", "verify-token")).toBe(true);
    expect(provider.isValidVerification("subscribe", "wrong")).toBe(false);
    expect(provider.isValidVerification("other", "verify-token")).toBe(false);
  });

  it("normalizes Meta text events with id/phone preserved, phone left to canonical normalization", () => {
    const events = provider.normalizeInbound({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.9", from: "5511987654321", timestamp: "1760000000", type: "text", text: { body: "cancela o chamado" } }] } }] }],
    });
    expect(events).toEqual([{
      provider: WHATSAPP_PROVIDER_NAME,
      providerMessageId: "wamid.9",
      senderPhone: "5511987654321",
      type: "text",
      text: "cancela o chamado",
      timestamp: new Date(1760000000000),
    }]);
  });

  it("marks audio/image events as non-text and ignores statuses/malformed", () => {
    const events = provider.normalizeInbound({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.a", from: "5511987654321", type: "audio", audio: { id: "m1" } }] } }] }, { changes: [{ value: { statuses: [{ id: "wamid.s", status: "delivered" }] } }] }],
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("audio");
    expect(events[0].text).toBeUndefined();
    expect(provider.normalizeInbound({ object: "other" })).toEqual([]);
    expect(provider.normalizeInbound("junk")).toEqual([]);
    expect(provider.normalizeInbound({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: "nope" } }] }] })).toEqual([]);
  });
});

// ── Transport adapter ────────────────────────────────────────────────────

describe("WhatsApp text adapter", () => {
  it("executes an authorized calendar.create through the A2 router", async () => {
    const { deps, calls, provider } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" } });
    const outcome = await handleWhatsAppInboundText(deps, textEvent());
    expect(outcome).toBe("processed");
    expect(calls).toEqual(["createAppointment"]);
    expect(provider.sent.at(-1)?.text).toBe("Compromisso criado com sucesso.");
  });

  it("executes ticket.read through the A2 router with bounded list output", async () => {
    const { deps, calls, provider } = makeDeps({ kind: "command", operation: "ticket.read", payload: { mode: "list" } });
    await handleWhatsAppInboundText(deps, textEvent({ text: "quais chamados?" }));
    expect(calls).toEqual(["listJobs"]);
    const reply = provider.sent.at(-1)!.text;
    const lines = reply.split("\n");
    expect(lines).toHaveLength(WHATSAPP_MAX_LIST_ITEMS + 1);
    expect(lines.at(-1)).toBe("+ 5 outros resultados.");
  });

  it("rejects unknown senders without executing anything", async () => {
    const { deps, calls, provider, model } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "x", startsAt: "2026-09-02T14:00:00.000Z" } }, { identity: false });
    const outcome = await handleWhatsAppInboundText(deps, textEvent());
    expect(outcome).toBe("unauthorized");
    expect(provider.sent.at(-1)?.text).toBe("Este número não possui acesso ao Looply.");
    expect(calls).toEqual([]);
    expect(model.requests).toHaveLength(0);
  });

  it("rejects inactive membership without executing", async () => {
    const { deps, calls } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "x", startsAt: "2026-09-02T14:00:00.000Z" } }, { membershipActive: false });
    expect(await handleWhatsAppInboundText(deps, textEvent())).toBe("unauthorized");
    expect(calls).toEqual([]);
  });

  it("skips duplicate providerMessageId without model or domain calls", async () => {
    const { deps, calls, model } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "x", startsAt: "2026-09-02T14:00:00.000Z" } });
    await handleWhatsAppInboundText(deps, textEvent());
    const outcome = await handleWhatsAppInboundText(deps, textEvent());
    expect(outcome).toBe("duplicate");
    expect(model.requests).toHaveLength(1);
    expect(calls).toEqual(["createAppointment"]);
  });

  it("fails closed when the transient store is unavailable", async () => {
    const { deps, store, calls, model, provider } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "x", startsAt: "2026-09-02T14:00:00.000Z" } });
    store.unavailable = true;
    const outcome = await handleWhatsAppInboundText(deps, textEvent());
    expect(outcome).toBe("transient_failure");
    expect(model.requests).toHaveLength(0);
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe("Serviço temporariamente indisponível. Tente novamente em instantes.");
  });

  it("defers non-text events with a deterministic reply and no media handling", async () => {
    const { deps, provider, model, calls } = makeDeps({ kind: "command", operation: "calendar.read", payload: { mode: "list" } });
    const outcome = await handleWhatsAppInboundText(deps, textEvent({ type: "audio" }));
    expect(outcome).toBe("non_text");
    expect(provider.sent.at(-1)?.text).toBe("Por enquanto, envie sua solicitação em texto.");
    expect(model.requests).toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it("forwards clarification and unsupported results without mutation", async () => {
    for (const output of [{ kind: "clarification", message: "Qual reunião?" }, { kind: "unsupported", message: "Arquivos não." }]) {
      const { deps, calls, provider } = makeDeps(output);
      await handleWhatsAppInboundText(deps, textEvent());
      expect(calls).toEqual([]);
      expect(provider.sent.at(-1)?.text).toBe(output.kind === "clarification" ? "Qual reunião?" : "Esse tipo de ação ainda não é suportado pelo Assistant.");
    }
  });

  it("passes timezone and ISO timestamp context to the language model", async () => {
    const { deps, model } = makeDeps({ kind: "command", operation: "calendar.read", payload: { mode: "list" } });
    const now = new Date("2026-09-01T12:00:00.000Z");
    await handleWhatsAppInboundText({ ...deps, now: () => now }, textEvent());
    expect(model.requests[0].timezone).toBe("America/Sao_Paulo");
    expect(model.requests[0].currentTimestamp).toBe(now.toISOString());
    expect(model.requests[0].systemPrompt).toContain("calendar.create");
  });
});

// ── Confirmation flow ────────────────────────────────────────────────────

describe("WhatsApp confirmation flow", () => {
  const deleteOutput = { kind: "command", operation: "ticket.delete", payload: { jobId: "j1" } };

  it("stores the exact command on confirmation-required mutations without executing", async () => {
    const { deps, calls, provider, store } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent({ text: "cancela o chamado 123" }));
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(confirmationPrompt("ticket.delete"));
    const raw = store.data.get("looply:assistant:confirmation:c1:u1");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!.value).command).toEqual({ operation: "ticket.delete", payload: { jobId: "j1" } });
  });

  it("SIM consumes the pending command atomically and executes exactly once via the lifecycle transition", async () => {
    const { deps, calls, provider } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent({ text: "cancela o chamado 123" }));
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "wamid.2", text: "SIM" }));
    expect(calls).toEqual(["transitionJobLifecycle"]);
    expect(provider.sent.at(-1)?.text).toBe("Chamado cancelado.");
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "wamid.3", text: "sim" }));
    expect(calls).toEqual(["transitionJobLifecycle"]);
    expect(provider.sent.at(-1)?.text).toBe("Não há nenhuma ação pendente para confirmar.");
  });

  it("confirmation phrases are exact: LLM is never consulted for them", async () => {
    const { deps, model } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "w.1", text: "CONFIRMO   " }));
    expect(model.requests).toHaveLength(0);
  });

  it("negative response clears the pending action without mutation", async () => {
    const { deps, calls, provider } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent({ text: "cancela o chamado 123" }));
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "wamid.2", text: "não" }));
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe("Ação cancelada.");
  });

  it("expired pending confirmations cannot execute", async () => {
    const { deps, calls, store, provider } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent({ text: "cancela o chamado 123" }));
    store.data.get("looply:assistant:confirmation:c1:u1")!.expiresAt = Date.now() - 1;
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "wamid.2", text: "SIM" }));
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe("Não há nenhuma ação pendente para confirmar.");
  });

  it("a newer mutation replaces the single pending confirmation", async () => {
    const { deps, store } = makeDeps([
      { kind: "command", operation: "ticket.delete", payload: { jobId: "j1" } },
      { kind: "command", operation: "calendar.delete", payload: { appointmentId: "a1" } },
    ]);
    await handleWhatsAppInboundText(deps, textEvent({ text: "cancela o chamado 123" }));
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "wamid.2", text: "cancela o compromisso 9" }));
    const raw = JSON.parse(store.data.get("looply:assistant:confirmation:c1:u1")!.value);
    expect(raw.command.operation).toBe("calendar.delete");
    expect(raw.correlationId).toBe("wamid.2");
  });

  it("duplicate webhook of a confirmation-required request creates no second pending state", async () => {
    const { deps, store, provider } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent());
    await handleWhatsAppInboundText(deps, textEvent());
    expect([...store.data.keys()].filter((k) => k.includes("confirmation"))).toHaveLength(1);
    expect(provider.sent).toHaveLength(1);
  });

  it("duplicate confirmed mutation cannot execute twice", async () => {
    const { deps, calls } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent({ text: "cancela o chamado 123" }));
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "wamid.2", text: "SIM" }));
    await handleWhatsAppInboundText(deps, textEvent({ providerMessageId: "wamid.2", text: "SIM" }));
    expect(calls).toEqual(["transitionJobLifecycle"]);
  });

  it("another user/company cannot consume someone else's confirmation (key scoping)", async () => {
    const { deps, store } = makeDeps(deleteOutput);
    await handleWhatsAppInboundText(deps, textEvent({ text: "cancela o chamado 123" }));
    const scoped = store.data.get("looply:assistant:confirmation:c1:u1");
    expect(scoped).toBeDefined();
    // Keys carry companyId:userId; another actor resolves a different key and
    // never this record (resolveWhatsAppActor returns its own company/user).
    expect(store.data.has("looply:assistant:confirmation:c2:u1")).toBe(false);
    expect(store.data.has("looply:assistant:confirmation:c1:u2")).toBe(false);
  });
});

// ── Outbound failure semantics ───────────────────────────────────────────

describe("WhatsApp outbound failure", () => {
  it("does NOT rerun the domain command when the send fails", async () => {
    const { deps, calls, provider } = makeDeps({ kind: "command", operation: "calendar.create", payload: { title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" } });
    provider.failSends = true;
    const outcome = await handleWhatsAppInboundText(deps, textEvent());
    expect(outcome).toBe("processed");
    expect(calls).toEqual(["createAppointment"]);
  });
});

// ── Formatter ────────────────────────────────────────────────────────────

describe("WhatsApp reply formatter", () => {
  it("formats each success class deterministically", () => {
    expect(formatAssistantResult({ ok: true, operation: "calendar.create", result: {}, confirmationRequired: false })).toBe("Compromisso criado com sucesso.");
    expect(formatAssistantResult({ ok: true, operation: "calendar.update", result: {}, confirmationRequired: true })).toBe("Compromisso atualizado.");
    expect(formatAssistantResult({ ok: true, operation: "calendar.delete", result: {}, confirmationRequired: true })).toBe("Compromisso cancelado.");
    expect(formatAssistantResult({ ok: true, operation: "ticket.create", result: {}, confirmationRequired: false })).toBe("Chamado criado com sucesso.");
    expect(formatAssistantResult({ ok: true, operation: "ticket.update", result: {}, confirmationRequired: true })).toBe("Chamado atualizado.");
    expect(formatAssistantResult({ ok: true, operation: "ticket.delete", result: {}, confirmationRequired: true })).toBe("Chamado cancelado.");
  });

  it("sanitizes failure classes", () => {
    expect(formatAssistantResult({ ok: false, operation: "ticket.read", error: { code: "forbidden", message: "x" } })).toBe("Não foi possível concluir o pedido.");
    expect(formatAssistantResult({ ok: false, operation: "ticket.read", error: { code: "not_found", message: "x" } })).toBe("Registro não encontrado.");
    expect(formatAssistantResult({ ok: false, operation: "ticket.read", error: { code: "internal_error", message: "secret stack" } })).toBe("Serviço temporariamente indisponível. Tente novamente em instantes.");
    expect(formatAssistantResult({ ok: false, operation: "ticket.update", confirmationRequired: true, error: { code: "ASSISTANT_CONFIRMATION_REQUIRED", message: "x" } })).toBe(confirmationPrompt("ticket.update"));
  });
});

// ── Webhook HTTP route ───────────────────────────────────────────────────

function webhookApp(deps: { store: TransientStore | null; provider: MetaWhatsAppProvider }) {
  const app = express();
  app.use("/api/webhooks/whatsapp", makeWhatsAppWebhookRouter({
    db: makeDb({ identity: true }) as never,
    provider: deps.provider,
    store: deps.store,
    languageModel: new FakeLanguageModel({ kind: "command", operation: "calendar.create", payload: { title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" } }),
    services: makeServices([]),
  }));
  return app;
}

function metaBody(messageId: string, text: string) {
  return Buffer.from(JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: { messages: [{ id: messageId, from: "5511987654321", type: "text", text: { body: text } }] } }] }],
  }));
}

function signed(body: Buffer) {
  return `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
}

describe("WhatsApp webhook route", () => {
  it("completes the GET verification handshake", async () => {
    const provider = new FakeWhatsAppProvider();
    const app = webhookApp({ store: new FakeStore(), provider });
    const ok = await request(app).get("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=1234");
    expect(ok.status).toBe(200);
    expect(ok.text).toBe("1234");
    const bad = await request(app).get("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234");
    expect(bad.status).toBe(403);
  });

  it("accepts a signed webhook and runs the pipeline; acknowledges with 200", async () => {
    const provider = new FakeWhatsAppProvider();
    const app = webhookApp({ store: new FakeStore(), provider });
    const response = await request(app)
      .post("/api/webhooks/whatsapp")
      
      .set("x-hub-signature-256", signed(metaBody("wamid.http.1", "cria um compromisso")))
      .send(metaBody("wamid.http.1", "cria um compromisso"));
    expect(response.status).toBe(200);
    expect(response.text).toBe("EVENT_RECEIVED");
    expect(provider.sent.at(-1)?.text).toBe("Compromisso criado com sucesso.");
  });

  it("rejects invalid signatures, malformed JSON, and unconfigured state (fail closed)", async () => {
    const provider = new FakeWhatsAppProvider();
    const app = webhookApp({ store: new FakeStore(), provider });
    const body = metaBody("wamid.http.2", "x");
    const invalid = await request(app).post("/api/webhooks/whatsapp").set("x-hub-signature-256", "sha256=" + "0".repeat(64)).send(body);
    expect(invalid.status).toBe(401);

    const malformed = await request(app).post("/api/webhooks/whatsapp").set("x-hub-signature-256", signed(Buffer.from("not json"))).send(Buffer.from("not json"));
    expect(malformed.status).toBe(400);

    const noStore = webhookApp({ store: null, provider: new FakeWhatsAppProvider() });
    const closed = await request(noStore).post("/api/webhooks/whatsapp").set("x-hub-signature-256", signed(body)).send(body);
    expect(closed.status).toBe(503);
  });

  it("duplicate webhook delivery produces no duplicate outbound or domain work", async () => {
    const provider = new FakeWhatsAppProvider();
    const app = webhookApp({ store: new FakeStore(), provider });
    const body = metaBody("wamid.http.3", "cria um compromisso");
    await request(app).post("/api/webhooks/whatsapp").set("x-hub-signature-256", signed(body)).send(body);
    await request(app).post("/api/webhooks/whatsapp").set("x-hub-signature-256", signed(body)).send(body);
    expect(provider.sent).toHaveLength(1);
  });

  it("rejects everything when inbound credentials are unconfigured", async () => {
    const provider = new MetaWhatsAppProvider({});
    const app = webhookApp({ store: new FakeStore(), provider });
    const body = metaBody("wamid.http.4", "x");
    const response = await request(app).post("/api/webhooks/whatsapp").set("x-hub-signature-256", signed(body)).send(body);
    expect(response.status).toBe(503);
    const handshake = await request(app).get("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=&hub.challenge=1");
    expect(handshake.status).toBe(403);
  });
});
