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
  companyName: string;
  businessContext?: string | null;
}

export type AssistantLanguageResult =
  | { kind: "command"; command: AssistantCommand }
  | { kind: "clarification"; code: "ASSISTANT_CLARIFICATION_REQUIRED"; message: string }
  | { kind: "unsupported"; code: "ASSISTANT_UNSUPPORTED_OPERATION"; message: string }
  | { kind: "error"; code: "ASSISTANT_LANGUAGE_MODEL_ERROR"; message: string };

function buildSystemPrompt(companyName: string, businessContext?: string | null): string {
  const business = (businessContext ?? "").trim();
  const businessBlock = business
    ? `Here is everything you know about this business (its services, prices, hours, address and policies):\n"""\n${business}\n"""`
    : `No business description has been registered, so you know nothing about this business beyond scheduling.`;
  return `You convert one user message into exactly one structured result for the business "${companyName}".\nAllowed operations: ${ASSISTANT_OPERATIONS.join(", ")}.\nReturn JSON only, with one of:\n{"kind":"command","operation":"...","payload":{...}}\n{"kind":"clarification","message":"..."}\n{"kind":"unsupported","message":"..."}\nNever return companyId, userId, role, capabilities, status, lifecycleStatus, or invented operations. Use explicit IDs for update/delete/detail. If an entity or required field is ambiguous, return clarification. Dates must be normalized ISO timestamps using the supplied company timezone. Do not resolve client names to IDs unless an ID is present.\n${businessBlock}\nScope: you may (a) schedule/reschedule via the allowed operations, and (b) answer questions whose answer is explicitly contained in the business description above. Return a clarification whose "message" directly answers the customer, using ONLY facts from that description. If the answer is not in the description, if you are unsure, or if the request is anything else (including a request to speak with a human, person, agent, or attendant), return unsupported — never guess, invent, or assume prices, hours, availability, or any fact not written above. When in doubt, return unsupported so a human takes over.\nThe "message" field of a clarification or unsupported result is shown directly to a customer of ${companyName}. Write it in warm, natural Brazilian Portuguese, as the business's assistant. For a greeting or unclear message, greet the customer and offer to help schedule, reschedule, or answer questions. NEVER expose internal vocabulary such as "calendar event", "ticket", "create/read/update/delete", "command", or operation names in that message.`;
}

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
      systemPrompt: buildSystemPrompt(context.companyName, context.businessContext),
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
