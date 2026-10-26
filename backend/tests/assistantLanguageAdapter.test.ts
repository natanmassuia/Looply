import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AssistantDomainServices } from "../src/services/assistantCommandService";
import { makeAssistantRouter } from "../src/routes/assistant";
import { interpretAssistantMessage } from "../src/services/assistantLanguageAdapter";
import { OpenAICompatibleLanguageModel, type AssistantLanguageModel, type AssistantLanguageModelRequest } from "../src/services/assistantLanguageModel";

class FakeLanguageModel implements AssistantLanguageModel {
  public requests: AssistantLanguageModelRequest[] = [];

  constructor(private readonly output: unknown | Error) {}

  async generateStructuredOutput(request: AssistantLanguageModelRequest) {
    this.requests.push(request);
    if (this.output instanceof Error) throw this.output;
    return this.output;
  }
}

const context = { currentTimestamp: new Date("2026-09-01T12:00:00.000Z"), timezone: "America/Sao_Paulo", companyName: "Studio Alpha" };
const iso = "2026-09-02T14:00:00.000Z";

const validCommands = [
  ["calendar.create", { title: "Reunião", startsAt: iso }],
  ["calendar.read", { mode: "range", from: "2026-09-02T00:00:00.000Z", to: "2026-09-03T00:00:00.000Z" }],
  ["calendar.update", { appointmentId: "a1", patch: { startsAt: iso } }],
  ["calendar.delete", { appointmentId: "a1" }],
  ["ticket.create", { title: "Job", clientId: "c1" }],
  ["ticket.read", { mode: "list" }],
  ["ticket.update", { jobId: "j1", patch: { title: "Novo" } }],
  ["ticket.delete", { jobId: "j1" }],
] as const;

describe("Assistant natural-language adapter", () => {
  it("keeps the concrete provider inert when configuration is absent", async () => {
    const model = new OpenAICompatibleLanguageModel({});
    await expect(model.generateStructuredOutput({ systemPrompt: "x", message: "x", currentTimestamp: iso, timezone: "UTC" })).rejects.toThrow("not configured");
  });

  it.each(validCommands)("accepts %s as a validated structured command", async (operation, payload) => {
    const model = new FakeLanguageModel({ kind: "command", operation, payload });
    const result = await interpretAssistantMessage(model, "mensagem", context);
    expect(result).toEqual({ kind: "command", command: { operation, payload } });
  });

  it("passes company timezone and ISO current timestamp to the model", async () => {
    const model = new FakeLanguageModel({ kind: "command", operation: "calendar.create", payload: { title: "Reunião", startsAt: iso } });
    await interpretAssistantMessage(model, "marca amanhã às 14h", context);
    expect(model.requests[0].timezone).toBe("America/Sao_Paulo");
    expect(model.requests[0].currentTimestamp).toBe("2026-09-01T12:00:00.000Z");
    expect(model.requests[0].message).toBe("marca amanhã às 14h");
    expect(model.requests[0].systemPrompt).toContain("calendar.create");
  });

  it("uses the company name and business context in the prompt, with no clinic persona", async () => {
    const model = new FakeLanguageModel({ kind: "clarification", message: "oi" });
    await interpretAssistantMessage(model, "quanto custa?", { ...context, businessContext: "Corte R$50, seg a sex 9h-18h." });
    const prompt = model.requests[0].systemPrompt;
    expect(prompt).toContain("Studio Alpha");
    expect(prompt).toContain("Corte R$50, seg a sex 9h-18h.");
    expect(prompt.toLowerCase()).not.toContain("clinic");
    expect(prompt.toLowerCase()).not.toContain("patient");
  });

  it("supports clarification and unsupported results without commands", async () => {
    const clarification = await interpretAssistantMessage(new FakeLanguageModel({ kind: "clarification", message: "Qual reunião?" }), "cancela a reunião", context);
    const unsupported = await interpretAssistantMessage(new FakeLanguageModel({ kind: "unsupported", message: "Não posso enviar arquivos." }), "manda um arquivo", context);
    expect(clarification).toMatchObject({ kind: "clarification", code: "ASSISTANT_CLARIFICATION_REQUIRED" });
    expect(unsupported).toMatchObject({ kind: "unsupported", code: "ASSISTANT_UNSUPPORTED_OPERATION" });
  });

  it("rejects ninth operations, authority fields, protected fields, and malformed output", async () => {
    const outputs = [
      { kind: "command", operation: "client.create", payload: {} },
      { kind: "command", operation: "ticket.create", payload: { title: "J", clientId: "c1", companyId: "other" } },
      { kind: "command", operation: "ticket.create", payload: { title: "J", clientId: "c1", userId: "other" } },
      { kind: "command", operation: "ticket.update", payload: { jobId: "j1", patch: { lifecycleStatus: "CANCELLED" } } },
      { kind: "command", operation: "calendar.update", payload: { appointmentId: "a1", patch: { status: "CANCELLED" } } },
      { kind: "command", operation: "ticket.create", payload: { title: "missing client" } },
    ];
    for (const output of outputs) {
      const result = await interpretAssistantMessage(new FakeLanguageModel(output), "texto", context);
      expect(result.kind).toBe("error");
    }
  });

  it("returns a sanitized failure when the provider fails", async () => {
    const result = await interpretAssistantMessage(new FakeLanguageModel(new Error("provider key and response")), "texto", context);
    expect(result).toEqual({ kind: "error", code: "ASSISTANT_LANGUAGE_MODEL_ERROR", message: "Não foi possível interpretar a mensagem" });
  });

  it("rejects empty and oversized messages before the provider", async () => {
    const model = new FakeLanguageModel({ kind: "unsupported", message: "x" });
    expect((await interpretAssistantMessage(model, "   ", context)).kind).toBe("error");
    expect((await interpretAssistantMessage(model, "x".repeat(4001), context)).kind).toBe("error");
    expect(model.requests).toHaveLength(0);
  });
});

function makeServices(calls: string[]): AssistantDomainServices {
  const fn = (name: string, result: unknown) => async (..._args: unknown[]) => {
    calls.push(name);
    return result;
  };
  return {
    createAppointment: fn("createAppointment", { id: "a1" }),
    listAppointments: fn("listAppointments", { appointments: [] }),
    getAppointment: fn("getAppointment", { id: "a1" }),
    updateAppointment: fn("updateAppointment", { id: "a1" }),
    cancelAppointment: fn("cancelAppointment", { id: "a1" }),
    getCalendar: fn("getCalendar", { events: [] }),
    createJob: fn("createJob", { id: "j1" }),
    listJobs: fn("listJobs", { jobs: [] }),
    getJob: fn("getJob", { id: "j1" }),
    updateJob: fn("updateJob", { id: "j1" }),
    transitionJobLifecycle: fn("transitionJobLifecycle", { id: "j1", lifecycleStatus: "CANCELLED" }),
  } as unknown as AssistantDomainServices;
}

describe("Assistant natural-language HTTP route", () => {
  it("delegates to A2 and lets A2 own confirmation", async () => {
    const calls: string[] = [];
    const model = new FakeLanguageModel({ kind: "command", operation: "ticket.update", payload: { jobId: "j1", patch: { title: "Novo" } } });
    const db: any = { company: { findUnique: async () => ({ timezone: "America/Sao_Paulo", workspaceTemplate: "MARKETING_AGENCY" }) } };
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => { req.auth = { companyId: "c1", userId: "u1" }; next(); });
    app.use("/api/assistant", makeAssistantRouter(db, makeServices(calls), model));

    const pending = await request(app).post("/api/assistant/messages").send({ message: "altera o chamado", confirmed: false });
    expect(pending.status).toBe(409);
    expect(pending.body.error.code).toBe("ASSISTANT_CONFIRMATION_REQUIRED");
    expect(calls).toEqual([]);

    const confirmed = await request(app).post("/api/assistant/messages").send({ message: "altera o chamado", confirmed: true });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.ok).toBe(true);
    expect(calls).toEqual(["updateJob"]);
    expect(model.requests[0].timezone).toBe("America/Sao_Paulo");
  });

  it("returns clarification, unsupported, and provider errors without execution", async () => {
    const outputs = [
      { kind: "clarification", message: "Qual chamado?" },
      { kind: "unsupported", message: "Não posso enviar arquivos." },
    ];
    for (const output of outputs) {
      const calls: string[] = [];
      const db: any = { company: { findUnique: async () => ({ timezone: "UTC", workspaceTemplate: "MARKETING_AGENCY" }) } };
      const app = express();
      app.use(express.json());
      app.use((req: any, _res, next) => { req.auth = { companyId: "c1", userId: "u1" }; next(); });
      app.use("/api/assistant", makeAssistantRouter(db, makeServices(calls), new FakeLanguageModel(output)));
      const response = await request(app).post("/api/assistant/messages").send({ message: "texto" });
      expect(response.status).toBe(output.kind === "clarification" ? 409 : 400);
      expect(calls).toEqual([]);
    }
  });
});
