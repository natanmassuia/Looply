import { z } from "zod";
import { AppError } from "../lib/errors";
import { ASSISTANT_OPERATIONS, validateAssistantCommand, type AssistantCommand } from "./assistantCommandService";
import type { AssistantLanguageModel } from "./assistantLanguageModel";

export const assistantMessageRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  confirmed: z.boolean().optional(),
}).strict();

const languageOutputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("command"), operation: z.enum(ASSISTANT_OPERATIONS), payload: z.custom<unknown>(() => true) }).strict(),
  z.object({ kind: z.literal("clarification"), message: z.string().min(1).max(500) }).strict(),
  z.object({ kind: z.literal("unsupported"), message: z.string().min(1).max(500) }).strict(),
]);

export interface AssistantLanguageContext {
  currentTimestamp: Date;
  timezone: string;
}

export type AssistantLanguageResult =
  | { kind: "command"; command: AssistantCommand }
  | { kind: "clarification"; code: "ASSISTANT_CLARIFICATION_REQUIRED"; message: string }
  | { kind: "unsupported"; code: "ASSISTANT_UNSUPPORTED_OPERATION"; message: string }
  | { kind: "error"; code: "ASSISTANT_LANGUAGE_MODEL_ERROR"; message: string };

const SYSTEM_PROMPT = `You convert one user message into exactly one structured result.\nAllowed operations: ${ASSISTANT_OPERATIONS.join(", ")}.\nReturn JSON only, with one of:\n{"kind":"command","operation":"...","payload":{...}}\n{"kind":"clarification","message":"..."}\n{"kind":"unsupported","message":"..."}\nNever return companyId, userId, role, capabilities, status, lifecycleStatus, or invented operations. Use explicit IDs for update/delete/detail. If an entity or required field is ambiguous, return clarification. Requests outside Calendar and Tickets return unsupported. Dates must be normalized ISO timestamps using the supplied company timezone. Do not resolve client names to IDs unless an ID is present.`;

export async function interpretAssistantMessage(
  model: AssistantLanguageModel,
  message: string,
  context: AssistantLanguageContext,
  options?: { allowMissingTicketClientId?: boolean },
): Promise<AssistantLanguageResult> {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 4000) {
    return { kind: "error", code: "ASSISTANT_LANGUAGE_MODEL_ERROR", message: "Mensagem inválida" };
  }

  let raw: unknown;
  try {
    raw = await model.generateStructuredOutput({
      systemPrompt: SYSTEM_PROMPT,
      message: trimmed,
      currentTimestamp: context.currentTimestamp.toISOString(),
      timezone: context.timezone,
    });
  } catch {
    return { kind: "error", code: "ASSISTANT_LANGUAGE_MODEL_ERROR", message: "Não foi possível interpretar a mensagem" };
  }

  const output = languageOutputSchema.safeParse(raw);
  if (!output.success) {
    return { kind: "error", code: "ASSISTANT_LANGUAGE_MODEL_ERROR", message: "Resposta estruturada inválida" };
  }
  if (output.data.kind === "clarification") {
    return { kind: "clarification", code: "ASSISTANT_CLARIFICATION_REQUIRED", message: output.data.message };
  }
  if (output.data.kind === "unsupported") {
    return { kind: "unsupported", code: "ASSISTANT_UNSUPPORTED_OPERATION", message: output.data.message };
  }

  try {
    let payload: unknown = output.data.payload;
    if (output.data.operation === "ticket.create" && options?.allowMissingTicketClientId) {
      // Customer conversations resolve the client at runtime (conversation
      // binding or tenant-safe phone match), so the LLM output may omit it.
      const p = (payload ?? {}) as Record<string, unknown>;
      payload = { ...p, clientId: typeof p.clientId === "string" ? p.clientId : "__CUSTOMER_PENDING_CLIENT__" };
    }
    return { kind: "command", command: validateAssistantCommand({ operation: output.data.operation, payload }) };
  } catch (error) {
    if (error instanceof AppError || error instanceof z.ZodError) {
      return { kind: "error", code: "ASSISTANT_LANGUAGE_MODEL_ERROR", message: "Comando estruturado inválido" };
    }
    return { kind: "error", code: "ASSISTANT_LANGUAGE_MODEL_ERROR", message: "Comando estruturado inválido" };
  }
}
