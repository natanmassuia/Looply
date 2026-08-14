import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors";
import { Capability } from "../src/domain/capabilities";
import {
  ASSISTANT_OPERATION_REGISTRY,
  ASSISTANT_OPERATIONS,
  executeAssistantCommand,
  type AssistantDomainServices,
} from "../src/services/assistantCommandService";
import { makeAssistantRouter } from "../src/routes/assistant";
import app from "../src/app";

const db: any = {
  company: { findUnique: async () => ({ workspaceTemplate: "MARKETING_AGENCY" }) },
};

function makeServices() {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const fn = (name: string, result: unknown) => async (...args: unknown[]) => {
    calls.push({ name, args });
    return result;
  };
  const services = {
    createAppointment: fn("createAppointment", { id: "a1" }),
    listAppointments: fn("listAppointments", { appointments: [] }),
    getAppointment: fn("getAppointment", { id: "a1" }),
    updateAppointment: fn("updateAppointment", { id: "a1" }),
    cancelAppointment: fn("cancelAppointment", { id: "a1", status: "CANCELLED" }),
    getCalendar: fn("getCalendar", { events: [] }),
    createJob: fn("createJob", { id: "j1" }),
    listJobs: fn("listJobs", { jobs: [] }),
    getJob: fn("getJob", { id: "j1" }),
    updateJob: fn("updateJob", { id: "j1" }),
    transitionJobLifecycle: fn("transitionJobLifecycle", { id: "j1", lifecycleStatus: "CANCELLED" }),
  } as unknown as AssistantDomainServices;
  return { services, calls };
}

const context = {
  companyId: "company-a",
  userId: "user-a",
  capabilities: [Capability.CALENDAR, Capability.JOBS],
} as const;

describe("Assistant command router", () => {
  it("registers exactly the eight allowed operations", () => {
    expect(Object.keys(ASSISTANT_OPERATION_REGISTRY)).toEqual([...ASSISTANT_OPERATIONS]);
    expect(new Set(ASSISTANT_OPERATIONS).size).toBe(8);
  });

  it("rejects unknown operations and malformed payloads", async () => {
    const { services, calls } = makeServices();
    const unknown = await executeAssistantCommand(db, context, { operation: "admin.delete", payload: {} }, services);
    const malformed = await executeAssistantCommand(db, context, { operation: "ticket.create", payload: { title: "x", clientId: "c", companyId: "other" } }, services);
    expect(unknown).toMatchObject({ ok: false, error: { code: "validation_error" } });
    expect(malformed).toMatchObject({ ok: false, error: { code: "validation_error" } });
    expect(calls).toHaveLength(0);
  });

  it("enforces capability per resource", async () => {
    const { services } = makeServices();
    const calendar = await executeAssistantCommand(db, { ...context, capabilities: [Capability.CALENDAR] }, { operation: "calendar.read", payload: { mode: "list" } }, services);
    const ticket = await executeAssistantCommand(db, { ...context, capabilities: [Capability.JOBS] }, { operation: "ticket.read", payload: { mode: "list" } }, services);
    const deniedCalendar = await executeAssistantCommand(db, { ...context, capabilities: [Capability.JOBS] }, { operation: "calendar.read", payload: { mode: "list" } }, services);
    const deniedTicket = await executeAssistantCommand(db, { ...context, capabilities: [Capability.CALENDAR] }, { operation: "ticket.read", payload: { mode: "list" } }, services);
    expect(calendar.ok).toBe(true);
    expect(ticket.ok).toBe(true);
    expect(deniedCalendar).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(deniedTicket).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("delegates Calendar create, reads, and confirmed mutations", async () => {
    const { services, calls } = makeServices();
    await executeAssistantCommand(db, context, { operation: "calendar.create", payload: { title: "Meeting", startsAt: "2026-09-01T10:00:00.000Z" } }, services);
    await executeAssistantCommand(db, context, { operation: "calendar.read", payload: { mode: "list" } }, services);
    await executeAssistantCommand(db, context, { operation: "calendar.read", payload: { mode: "detail", appointmentId: "a1" } }, services);
    await executeAssistantCommand(db, context, { operation: "calendar.read", payload: { mode: "range", from: "2026-09-01T00:00:00.000Z", to: "2026-09-02T00:00:00.000Z" } }, services);
    await executeAssistantCommand(db, context, { operation: "calendar.update", payload: { appointmentId: "a1", patch: { title: "New" } } }, services);
    await executeAssistantCommand(db, context, { operation: "calendar.update", confirmed: true, payload: { appointmentId: "a1", patch: { title: "New" } } }, services);
    await executeAssistantCommand(db, context, { operation: "calendar.delete", confirmed: true, payload: { appointmentId: "a1" } }, services);
    expect(calls.map((call) => call.name)).toEqual([
      "createAppointment", "listAppointments", "getAppointment", "getCalendar", "updateAppointment", "cancelAppointment",
    ]);
    expect(calls[0].args[1]).toBe("company-a");
    expect(calls[0].args[2]).toBe("user-a");
  });

  it("requires confirmation before update and delete", async () => {
    const { services, calls } = makeServices();
    const update = await executeAssistantCommand(db, context, { operation: "ticket.update", payload: { jobId: "j1", patch: { title: "New" } } }, services);
    const deletion = await executeAssistantCommand(db, context, { operation: "ticket.delete", payload: { jobId: "j1" } }, services);
    expect(update).toMatchObject({ ok: false, confirmationRequired: true, error: { code: "ASSISTANT_CONFIRMATION_REQUIRED" } });
    expect(deletion).toMatchObject({ ok: false, confirmationRequired: true, error: { code: "ASSISTANT_CONFIRMATION_REQUIRED" } });
    expect(calls).toHaveLength(0);
  });

  it("delegates Tickets and never exposes lifecycleStatus in generic update", async () => {
    const { services, calls } = makeServices();
    await executeAssistantCommand(db, context, { operation: "ticket.create", payload: { title: "Job", clientId: "client-a" } }, services);
    await executeAssistantCommand(db, context, { operation: "ticket.read", payload: { mode: "list" } }, services);
    await executeAssistantCommand(db, context, { operation: "ticket.read", payload: { mode: "detail", jobId: "j1" } }, services);
    const blockedUpdate = await executeAssistantCommand(db, context, { operation: "ticket.update", confirmed: true, payload: { jobId: "j1", patch: { lifecycleStatus: "CANCELLED" } } }, services);
    await executeAssistantCommand(db, context, { operation: "ticket.update", confirmed: true, payload: { jobId: "j1", patch: { title: "New" } } }, services);
    await executeAssistantCommand(db, context, { operation: "ticket.delete", confirmed: true, payload: { jobId: "j1" } }, services);
    expect(blockedUpdate).toMatchObject({ ok: false, error: { code: "validation_error" } });
    expect(calls.map((call) => call.name)).toEqual(["createJob", "listJobs", "getJob", "updateJob", "transitionJobLifecycle"]);
    expect(calls.at(-1)?.args.slice(1)).toEqual(["company-a", "user-a", "j1", "CANCELLED"]);
  });

  it("returns sanitized canonical service errors", async () => {
    const { services } = makeServices();
    services.getJob = (async () => { throw new AppError(404, "Job não encontrado", "not_found"); }) as never;
    const result = await executeAssistantCommand(db, context, { operation: "ticket.read", payload: { mode: "detail", jobId: "foreign" } }, services);
    expect(result).toMatchObject({ ok: false, error: { code: "not_found", message: "Job não encontrado" } });
  });
});

describe("Assistant HTTP endpoint", () => {
  it("preserves the authenticated API boundary", async () => {
    const response = await request(app)
      .post("/api/assistant/commands")
      .send({ operation: "calendar.read", payload: { mode: "list" } });
    expect(response.status).toBe(401);
  });

  it("accepts structured commands and rejects malformed commands", async () => {
    const { services } = makeServices();
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.auth = { companyId: "company-a", userId: "user-a" };
      next();
    });
    app.use("/api/assistant", makeAssistantRouter(db, services));

    const valid = await request(app).post("/api/assistant/commands").send({ operation: "calendar.read", payload: { mode: "list" } });
    const invalid = await request(app).post("/api/assistant/commands").send({ operation: "unknown", payload: {} });
    expect(valid.status).toBe(200);
    expect(valid.body.ok).toBe(true);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("validation_error");
  });
});
