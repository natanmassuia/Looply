import { z } from "zod";
import type { DB } from "../lib/db";
import { AppError, forbidden } from "../lib/errors";
import { Capability } from "../domain/capabilities";
import {
  cancelAppointment,
  createAppointment,
  getAppointment,
  listAppointments,
  updateAppointment,
} from "./appointmentService";
import { getCalendar } from "./calendarService";
import {
  createJob,
  getJob,
  listJobs,
  transitionJobLifecycle,
  updateJob,
} from "./jobService";

export const ASSISTANT_OPERATIONS = [
  "calendar.create",
  "calendar.read",
  "calendar.update",
  "calendar.delete",
  "ticket.create",
  "ticket.read",
  "ticket.update",
  "ticket.delete",
] as const;

export type AssistantOperation = (typeof ASSISTANT_OPERATIONS)[number];

const operationSchema = z.enum(ASSISTANT_OPERATIONS);
const isoDate = z.string().datetime();

const calendarCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  clientId: z.string().min(1).max(64).nullable().optional(),
  startsAt: isoDate,
  endsAt: isoDate.nullable().optional(),
}).strict();

const calendarReadSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("list"),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
    clientId: z.string().min(1).max(64).optional(),
    status: z.enum(["SCHEDULED", "CANCELLED"]).optional(),
  }).strict(),
  z.object({
    mode: z.literal("detail"),
    appointmentId: z.string().min(1).max(64),
  }).strict(),
  z.object({
    mode: z.literal("range"),
    from: isoDate,
    to: isoDate,
    clientId: z.string().min(1).max(64).optional(),
    stageId: z.string().min(1).max(64).optional(),
    lifecycleStatus: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  }).strict(),
]);

const calendarUpdateSchema = z.object({
  appointmentId: z.string().min(1).max(64),
  patch: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    clientId: z.string().min(1).max(64).nullable().optional(),
    startsAt: isoDate.optional(),
    endsAt: isoDate.nullable().optional(),
  }).strict(),
}).strict();

const calendarDeleteSchema = z.object({
  appointmentId: z.string().min(1).max(64),
}).strict();

const ticketCreateSchema = z.object({
  title: z.string().min(1).max(200),
  clientId: z.string().min(1).max(64),
  notes: z.string().max(2000).optional(),
  format: z.enum(["POST", "REELS", "STORY", "CAROUSEL", "VIDEO", "IMAGE"]).optional(),
}).strict();

const ticketReadSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("list"),
    clientId: z.string().min(1).max(64).optional(),
    workflowId: z.string().min(1).max(64).optional(),
    stageId: z.string().min(1).max(64).optional(),
    lifecycleStatus: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    search: z.string().max(200).optional(),
    sort: z.enum(["updatedAt", "createdAt", "title"]).optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
  }).strict(),
  z.object({
    mode: z.literal("detail"),
    jobId: z.string().min(1).max(64),
  }).strict(),
]);

const ticketUpdateSchema = z.object({
  jobId: z.string().min(1).max(64),
  patch: z.object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(2000).optional(),
    clientId: z.string().min(1).max(64).optional(),
    publicationTarget: isoDate.nullable().optional(),
    scheduledAt: isoDate.nullable().optional(),
  }).strict(),
}).strict();

const ticketDeleteSchema = z.object({
  jobId: z.string().min(1).max(64),
}).strict();

export const assistantCommandSchema = z.object({
  operation: operationSchema,
  payload: z.custom<unknown>(() => true),
}).strict();

export const assistantRequestSchema = assistantCommandSchema.extend({
  confirmed: z.boolean().optional(),
}).strict();

export interface AssistantCommand {
  operation: AssistantOperation;
  payload: unknown;
}

export function validateAssistantCommand(input: unknown): AssistantCommand {
  const command = assistantCommandSchema.parse(input);
  switch (command.operation) {
    case "calendar.create": parsePayload(calendarCreateSchema, command.payload); break;
    case "calendar.read": parsePayload(calendarReadSchema, command.payload); break;
    case "calendar.update": parsePayload(calendarUpdateSchema, command.payload); break;
    case "calendar.delete": parsePayload(calendarDeleteSchema, command.payload); break;
    case "ticket.create": parsePayload(ticketCreateSchema, command.payload); break;
    case "ticket.read": parsePayload(ticketReadSchema, command.payload); break;
    case "ticket.update": parsePayload(ticketUpdateSchema, command.payload); break;
    case "ticket.delete": parsePayload(ticketDeleteSchema, command.payload); break;
  }
  return { operation: command.operation, payload: command.payload };
}

export interface AssistantExecutionContext {
  companyId: string;
  userId: string;
  capabilities: readonly Capability[];
}

export interface AssistantDomainServices {
  createAppointment: typeof createAppointment;
  listAppointments: typeof listAppointments;
  getAppointment: typeof getAppointment;
  updateAppointment: typeof updateAppointment;
  cancelAppointment: typeof cancelAppointment;
  getCalendar: typeof getCalendar;
  createJob: typeof createJob;
  listJobs: typeof listJobs;
  getJob: typeof getJob;
  updateJob: typeof updateJob;
  transitionJobLifecycle: typeof transitionJobLifecycle;
}

const domainServices: AssistantDomainServices = {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  getCalendar,
  createJob,
  listJobs,
  getJob,
  updateJob,
  transitionJobLifecycle,
};

export const ASSISTANT_OPERATION_REGISTRY: Record<AssistantOperation, {
  capability: Capability;
  confirmationRequired: boolean;
}> = {
  "calendar.create": { capability: Capability.CALENDAR, confirmationRequired: false },
  "calendar.read": { capability: Capability.CALENDAR, confirmationRequired: false },
  "calendar.update": { capability: Capability.CALENDAR, confirmationRequired: true },
  "calendar.delete": { capability: Capability.CALENDAR, confirmationRequired: true },
  "ticket.create": { capability: Capability.JOBS, confirmationRequired: false },
  "ticket.read": { capability: Capability.JOBS, confirmationRequired: false },
  "ticket.update": { capability: Capability.JOBS, confirmationRequired: true },
  "ticket.delete": { capability: Capability.JOBS, confirmationRequired: true },
};

export type AssistantSuccess = {
  ok: true;
  operation: AssistantOperation;
  result: unknown;
  confirmationRequired: boolean;
};

export type AssistantFailure = {
  ok: false;
  operation?: AssistantOperation;
  confirmationRequired?: boolean;
  error: { code: string; message: string };
};

export type AssistantResult = AssistantSuccess | AssistantFailure;

function errorResult(operation: AssistantOperation | undefined, error: unknown): AssistantFailure {
  if (error instanceof AppError) {
    return { ok: false, operation, error: { code: error.code, message: error.message } };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, operation, error: { code: "validation_error", message: "Erro de validação" } };
  }
  return { ok: false, operation, error: { code: "internal_error", message: "Erro interno do servidor" } };
}

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AppError(400, "Erro de validação", "validation_error");
  return parsed.data;
}

function requireCapability(context: AssistantExecutionContext, capability: Capability) {
  if (!context.capabilities.includes(capability)) throw forbidden("Recurso não disponível para este workspace");
}

export async function executeAssistantCommand(
  db: DB,
  context: AssistantExecutionContext,
  input: unknown,
  services: AssistantDomainServices = domainServices,
): Promise<AssistantResult> {
  let operation: AssistantOperation | undefined;
  try {
    const request = assistantRequestSchema.parse(input);
    operation = request.operation;
    const definition = ASSISTANT_OPERATION_REGISTRY[operation];
    requireCapability(context, definition.capability);

    let result: unknown;
    switch (operation) {
      case "calendar.create": {
        const payload = parsePayload(calendarCreateSchema, request.payload);
        result = await services.createAppointment(db, context.companyId, context.userId, {
          title: payload.title,
          description: payload.description,
          clientId: payload.clientId,
          startsAt: new Date(payload.startsAt),
          endsAt: payload.endsAt === undefined ? undefined : payload.endsAt === null ? null : new Date(payload.endsAt),
        });
        break;
      }
      case "calendar.read": {
        const payload = parsePayload(calendarReadSchema, request.payload);
        if (payload.mode === "list") {
          result = await services.listAppointments(db, context.companyId, payload);
        } else if (payload.mode === "detail") {
          result = await services.getAppointment(db, context.companyId, payload.appointmentId);
        } else {
          result = await services.getCalendar(db, context.companyId, payload);
        }
        break;
      }
      case "calendar.update": {
        const payload = parsePayload(calendarUpdateSchema, request.payload);
        if (request.confirmed !== true) return { ok: false, operation, confirmationRequired: true, error: { code: "ASSISTANT_CONFIRMATION_REQUIRED", message: "Confirmação necessária" } };
        result = await services.updateAppointment(db, context.companyId, payload.appointmentId, {
          title: payload.patch.title,
          description: payload.patch.description,
          clientId: payload.patch.clientId,
          startsAt: payload.patch.startsAt ? new Date(payload.patch.startsAt) : undefined,
          endsAt: payload.patch.endsAt === undefined ? undefined : payload.patch.endsAt ? new Date(payload.patch.endsAt) : null,
        });
        break;
      }
      case "calendar.delete": {
        const payload = parsePayload(calendarDeleteSchema, request.payload);
        if (request.confirmed !== true) return { ok: false, operation, confirmationRequired: true, error: { code: "ASSISTANT_CONFIRMATION_REQUIRED", message: "Confirmação necessária" } };
        result = await services.cancelAppointment(db, context.companyId, payload.appointmentId);
        break;
      }
      case "ticket.create": {
        const payload = parsePayload(ticketCreateSchema, request.payload);
        result = await services.createJob(db, context.companyId, context.userId, payload);
        break;
      }
      case "ticket.read": {
        const payload = parsePayload(ticketReadSchema, request.payload);
        result = payload.mode === "list"
          ? await services.listJobs(db, context.companyId, payload)
          : await services.getJob(db, context.companyId, payload.jobId);
        break;
      }
      case "ticket.update": {
        const payload = parsePayload(ticketUpdateSchema, request.payload);
        if (request.confirmed !== true) return { ok: false, operation, confirmationRequired: true, error: { code: "ASSISTANT_CONFIRMATION_REQUIRED", message: "Confirmação necessária" } };
        result = await services.updateJob(db, context.companyId, context.userId, payload.jobId, payload.patch);
        break;
      }
      case "ticket.delete": {
        const payload = parsePayload(ticketDeleteSchema, request.payload);
        if (request.confirmed !== true) return { ok: false, operation, confirmationRequired: true, error: { code: "ASSISTANT_CONFIRMATION_REQUIRED", message: "Confirmação necessária" } };
        result = await services.transitionJobLifecycle(db, context.companyId, context.userId, payload.jobId, "CANCELLED");
        break;
      }
    }
    return { ok: true, operation, result, confirmationRequired: definition.confirmationRequired };
  } catch (error) {
    return errorResult(operation, error);
  }
}

export function assistantHttpStatus(result: AssistantResult): number {
  if (result.ok) return 200;
  if (result.error.code === "ASSISTANT_CONFIRMATION_REQUIRED") return 409;
  if (result.error.code === "forbidden") return 403;
  if (result.error.code === "not_found") return 404;
  if (result.error.code === "conflict") return 409;
  if (result.error.code === "validation_error" || result.error.code === "bad_request") return 400;
  return 500;
}
