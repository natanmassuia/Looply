import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../src/lib/env";
import { RedisTransientStore } from "../src/lib/transientStore";
import type { AssistantDomainServices } from "../src/services/assistantCommandService";
import type { AssistantLanguageModel } from "../src/services/assistantLanguageModel";
import { MetaWhatsAppProvider } from "../src/services/whatsappProvider";
import { makeWhatsAppWebhookRouter } from "../src/routes/whatsappWebhook";
import { getPendingConfirmation } from "../src/services/assistantConfirmationStore";

// ── A3.1.1 runtime E2E (guarded: only runs when a REDIS_URL is configured) ──
// Proves the LIVE transport path against real infrastructure:
//   real HTTP route + real Meta HMAC crypto + real Redis idempotency and
//   confirmation stores. The provider secret is synthetic (no Meta app creds
//   exist on this box); the language model, db, and domain services are faked
//   so NO domain data is created and NO outbound reaches Meta.

const run = process.env.REDIS_URL || env.REDIS_URL;

function makeRuntimeDb() {
  return {
    whatsAppIdentity: {
      findUnique: async () => ({ userId: "u1", companyId: "c1", enabled: true, user: { id: "u1", active: true }, company: { id: "c1", isActive: true, workspaceTemplate: "MARKETING_AGENCY" } }),
    },
    companyMember: {
      findUnique: async () => ({ isActive: true }),
    },
    company: {
      findUnique: async () => ({ timezone: "America/Sao_Paulo" }),
    },
  } as never;
}

function makeRuntimeServices(calls: string[]): AssistantDomainServices {
  const fn = (name: string, result: unknown) => async (..._args: unknown[]) => { calls.push(name); return result; };
  return {
    createAppointment: fn("createAppointment", { id: "a1" }),
    listAppointments: fn("listAppointments", { appointments: [] }),
    getAppointment: fn("getAppointment", { id: "a1", title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" }),
    updateAppointment: fn("updateAppointment", { id: "a1" }),
    cancelAppointment: fn("cancelAppointment", { id: "a1" }),
    getCalendar: fn("getCalendar", { events: [] }),
    createJob: fn("createJob", { id: "j1" }),
    listJobs: fn("listJobs", { jobs: [] }),
    getJob: fn("getJob", { id: "j1", title: "Chamado" }),
    updateJob: fn("updateJob", { id: "j1" }),
    transitionJobLifecycle: fn("transitionJobLifecycle", { id: "j1" }),
  } as unknown as AssistantDomainServices;
}

function makeRuntimeModel(): AssistantLanguageModel {
  return {
    async generateStructuredOutput({ message }) {
      return message.includes("lista")
        ? { kind: "command", operation: "ticket.read", payload: { mode: "list" } }
        : { kind: "command", operation: "calendar.update", payload: { appointmentId: "a1", patch: { title: "Novo" } } };
    },
  };
}

function signBody(secret: string, body: Buffer) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function metaTextPayload(id: string, from: string, text: string) {
  return Buffer.from(JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: { messaging_product: "whatsapp", messages: [{ id, from, timestamp: "1760000000", type: "text", text: { body: text } }] } }] }],
  }));
}

describe.skipIf(!run)("whatsapp runtime E2E (real Redis + real HTTP + real HMAC)", () => {
  const SECRET = "runtime-app-secret";
  const TOKEN = "runtime-verify-token";
  const WAMID_1 = "wamid.runtime.1";
  const WAMID_2 = "wamid.runtime.2";
  const WAMID_3 = "wamid.runtime.3";
  const WAMID_4 = "wamid.runtime.4";
  const WAMID_5 = "wamid.runtime.5";
  const IDEMPOTENCY_KEY_1 = `looply:whatsapp:idempotency:whatsapp:${WAMID_1}`;
  const IDEMPOTENCY_KEY_2 = `looply:whatsapp:idempotency:whatsapp:${WAMID_2}`;
  const IDEMPOTENCY_KEY_3 = `looply:whatsapp:idempotency:whatsapp:${WAMID_3}`;
  const IDEMPOTENCY_KEY_4 = `looply:whatsapp:idempotency:whatsapp:${WAMID_4}`;
  const IDEMPOTENCY_KEY_5 = `looply:whatsapp:idempotency:whatsapp:${WAMID_5}`;
  const CONFIRMATION_KEY = "looply:assistant:confirmation:c1:u1";
  const CREATED_KEYS = [IDEMPOTENCY_KEY_1, IDEMPOTENCY_KEY_2, IDEMPOTENCY_KEY_3, IDEMPOTENCY_KEY_4, IDEMPOTENCY_KEY_5, CONFIRMATION_KEY];

  let store: RedisTransientStore;
  let app: ReturnType<typeof express>;
  let calls: string[];
  let sent: Array<{ to: string; text: string }>;

  beforeAll(async () => {
    store = new RedisTransientStore(run!);
    const provider = new MetaWhatsAppProvider({ verifyToken: TOKEN, appSecret: SECRET, accessToken: "rt-token", phoneNumberId: "rt-phone", fetchImpl: (async (_url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      sent.push({ to: body?.to, text: body?.text?.body ?? "" });
      return new Response(null, { status: 200 });
    }) as never });
    sent = [];
    calls = [];
    app = express();
    app.use("/api/webhooks/whatsapp", makeWhatsAppWebhookRouter({
      db: makeRuntimeDb(),
      provider,
      store,
      languageModel: makeRuntimeModel(),
      services: makeRuntimeServices(calls),
    }));
  });

  afterAll(async () => {
    for (const key of CREATED_KEYS) await store.delete(key);
    await store.delete(CONFIRMATION_KEY);
  });

  it("GET handshake: correct token echoes challenge, wrong token is 403", async () => {
    const ok = await request(app).get("/api/webhooks/whatsapp").query({ "hub.mode": "subscribe", "hub.verify_token": TOKEN, "hub.challenge": "challenge-1" });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe("challenge-1");
    const bad = await request(app).get("/api/webhooks/whatsapp").query({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "x" });
    expect(bad.status).toBe(403);
  });

  it("HMAC-verified live inbound: idempotency claim lands in real Redis, one outbound", async () => {
    const body = metaTextPayload(WAMID_1, "5511987654321", "muda o compromisso");
    const res = await request(app).post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", signBody(SECRET, body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.text).toBe("EVENT_RECEIVED");
    // idempotency claim persisted in real Redis
    expect(await store.get(IDEMPOTENCY_KEY_1)).not.toBeNull();
    // confirmation-required command → prompt sent, NO domain mutation yet
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe("Confirma a alteração do compromisso? Responda SIM para confirmar.");
    expect(calls).toEqual([]);
  });

  it("domain READ executes through the router and formats a bounded reply", async () => {
    const before = calls.length;
    const body = metaTextPayload(WAMID_5, "5511987654321", "lista os chamados abertos");
    const res = await request(app).post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", signBody(SECRET, body))
      .send(body);
    expect(res.status).toBe(200);
    expect(calls.slice(before)).toEqual(["listJobs"]); // command router → domain read
    expect(sent.at(-1)?.text).toBe("Nenhum chamado encontrado.");
  });

  it("invalid signature is rejected 401 and claims nothing", async () => {
    const body = metaTextPayload(WAMID_2, "5511987654321", "x");
    const res = await request(app).post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", "sha256=" + "0".repeat(64))
      .send(body);
    expect(res.status).toBe(401);
    expect(await store.get(IDEMPOTENCY_KEY_2)).toBeNull();
  });

  it("duplicate replay (same wamid) is deduped: no second outbound, no domain work", async () => {
    const beforeSent = sent.length;
    const beforeCalls = calls.length;
    const body = metaTextPayload(WAMID_1, "5511987654321", "muda o compromisso");
    await request(app).post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", signBody(SECRET, body))
      .send(body);
    expect(sent.length).toBe(beforeSent); // no new outbound
    expect(calls.length).toBe(beforeCalls); // no new domain work
  });

  it("confirmation E2E: SIM consumes the real pending record and mutates once; second SIM is a no-op", async () => {
    // pending exists in real Redis BEFORE SIM
    const pendingBefore = await getPendingConfirmation(store, "c1", "u1");
    expect(pendingBefore).not.toBeNull();
    expect(pendingBefore?.command.operation).toBe("calendar.update");

    // first SIM → confirmed execution (fake service records one mutation)
    const beforeFirst = calls.length;
    const simBody = metaTextPayload(WAMID_3, "5511987654321", "SIM");
    const sim = await request(app).post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", signBody(SECRET, simBody))
      .send(simBody);
    expect(sim.status).toBe(200);
    expect(calls.slice(beforeFirst)).toEqual(["updateAppointment"]); // exactly one mutation after first SIM
    expect(sent.at(-1)?.text).toBe("Compromisso atualizado.");
    // pending consumed atomically
    expect(await getPendingConfirmation(store, "c1", "u1")).toBeNull();

    // second SIM with nothing pending → no-op copy, no second mutation
    const beforeSecond = calls.length;
    const sim2Body = metaTextPayload(WAMID_4, "5511987654321", "sim");
    const sim2 = await request(app).post("/api/webhooks/whatsapp")
      .set("x-hub-signature-256", signBody(SECRET, sim2Body))
      .send(sim2Body);
    expect(sim2.status).toBe(200);
    expect(calls.length).toBe(beforeSecond); // still exactly one mutation, none added
    expect(sent.at(-1)?.text).toBe("Não há nenhuma ação pendente para confirmar.");
  });
});