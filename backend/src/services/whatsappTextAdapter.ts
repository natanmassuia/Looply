import type { DB } from "../lib/db";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import type { TransientStore } from "../lib/transientStore";
import type { AssistantLanguageModel } from "./assistantLanguageModel";
import { interpretAssistantMessage } from "./assistantLanguageAdapter";
import {
  executeAssistantCommand,
  type AssistantDomainServices,
  type AssistantExecutionContext,
} from "./assistantCommandService";
import { resolveWhatsAppActor, WHATSAPP_IDENTITY_PROVIDER } from "./whatsappActorService";
import { claimInboundMessage } from "./whatsappIdempotencyStore";
import {
  consumePendingConfirmation,
  savePendingConfirmation,
} from "./assistantConfirmationStore";
import type { WhatsAppInboundEvent } from "./whatsappProvider";
import { formatAssistantResult, WHATSAPP_COPY, confirmationPrompt } from "./whatsappReplyFormatter";

// ── WhatsApp TEXT transport adapter (A3.1) ───────────────────────────────
// Transport only: idempotency → actor resolution → confirmation phrases →
// language adapter → A2 command router → deterministic reply. It never calls
// domain services or Prisma directly and never becomes a second router.

const POSITIVE_CONFIRMATIONS = new Set(["sim", "confirmo", "confirmar"]);
const NEGATIVE_CONFIRMATIONS = new Set(["não", "nao", "cancelar"]);

export type WhatsAppInboundOutcome =
  | "processed"
  | "duplicate"
  | "non_text"
  | "unauthorized"
  | "transient_failure"
  | "malformed";

export interface WhatsAppAdapterDeps {
  db: DB;
  store: TransientStore;
  provider: { sendText(to: string, text: string): Promise<void> };
  languageModel: AssistantLanguageModel;
  services?: AssistantDomainServices;
  now?: () => Date;
}

function maskPhone(phone: string): string {
  return `******${phone.slice(-4)}`;
}

async function send(deps: WhatsAppAdapterDeps, to: string, text: string) {
  // Outbound failure after successful domain execution must NEVER rerun the
  // command: log (masked) and swallow — delivery failure ≠ execution failure.
  try {
    await deps.provider.sendText(to, text);
  } catch {
    logger.warn("whatsapp_outbound_failed", { to: maskPhone(to) });
  }
}

export async function handleWhatsAppInboundText(
  deps: WhatsAppAdapterDeps,
  event: WhatsAppInboundEvent,
): Promise<WhatsAppInboundOutcome> {
  const now = deps.now ?? (() => new Date());

  // 1. Idempotency is the FIRST side-effect gate (fail closed).
  try {
    const first = await claimInboundMessage(deps.store, event.provider, event.providerMessageId);
    if (!first) return "duplicate";
  } catch (error) {
    if (error instanceof AppError) return "malformed";
    logger.warn("whatsapp_idempotency_unavailable", { sender: maskPhone(event.senderPhone) });
    await send(deps, event.senderPhone, WHATSAPP_COPY.transientFailure);
    return "transient_failure";
  }

  // 2. Non-text events get a deterministic deferral reply (no media download).
  if (event.type !== "text" || typeof event.text !== "string") {
    await send(deps, event.senderPhone, WHATSAPP_COPY.nonText);
    return "non_text";
  }
  const text = event.text.trim();
  if (!text) return "malformed";

  // 3. Actor resolution — WhatsAppIdentity + active membership only. A Client
  //    phone never becomes an actor; the webhook payload carries no tenant.
  const actor = await resolveWhatsAppActor(deps.db, event.provider, event.senderPhone);
  if (!actor) {
    await send(deps, event.senderPhone, WHATSAPP_COPY.unauthorized);
    return "unauthorized";
  }
  const context: AssistantExecutionContext = {
    companyId: actor.companyId,
    userId: actor.userId,
    capabilities: actor.capabilities,
  };

  const company = await deps.db.company.findUnique({
    where: { id: actor.companyId },
    select: { timezone: true },
  });

  // 4. Explicit transport-level confirmation phrases (never interpreted by LLM).
  const normalized = text.toLowerCase();
  if (POSITIVE_CONFIRMATIONS.has(normalized)) {
    const pending = await consumePendingConfirmation(deps.store, actor.companyId, actor.userId);
    if (!pending) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.noPendingConfirmation);
      return "processed";
    }
    const result = await executeAssistantCommand(deps.db, context, {
      operation: pending.command.operation,
      payload: pending.command.payload,
      confirmed: true,
    }, deps.services);
    await send(deps, event.senderPhone, formatAssistantResult(result));
    return "processed";
  }
  if (NEGATIVE_CONFIRMATIONS.has(normalized)) {
    const pending = await consumePendingConfirmation(deps.store, actor.companyId, actor.userId);
    if (pending) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.confirmationCancelled);
      return "processed";
    }
    // No pending action: fall through and process as a brand-new message.
  }

  // 5. Ordinary text → existing language adapter → A2 command router.
  const interpreted = await interpretAssistantMessage(deps.languageModel, text, {
    currentTimestamp: now(),
    timezone: company?.timezone ?? "America/Sao_Paulo",
  });

  if (interpreted.kind === "error") {
    await send(deps, event.senderPhone, WHATSAPP_COPY.transientFailure);
    return "processed";
  }
  if (interpreted.kind === "clarification") {
    await send(deps, event.senderPhone, interpreted.message || WHATSAPP_COPY.clarificationGeneric);
    return "processed";
  }
  if (interpreted.kind === "unsupported") {
    await send(deps, event.senderPhone, WHATSAPP_COPY.unsupported);
    return "processed";
  }

  const result = await executeAssistantCommand(deps.db, context, {
    operation: interpreted.command.operation,
    payload: interpreted.command.payload,
    confirmed: false,
  }, deps.services);

  // Confirmation-required mutations: store the EXACT validated command (no
  // authority fields, no LLM reinterpretation) and prompt deterministically.
  // A newer mutation replaces the prior single pending confirmation.
  if (!result.ok && result.error.code === "ASSISTANT_CONFIRMATION_REQUIRED") {
    try {
      await savePendingConfirmation(deps.store, {
        companyId: actor.companyId,
        userId: actor.userId,
        command: interpreted.command,
        createdAt: "",
        expiresAt: "",
        correlationId: event.providerMessageId,
      });
      await send(deps, event.senderPhone, confirmationPrompt(interpreted.command.operation));
    } catch {
      logger.warn("whatsapp_confirmation_store_unavailable", { sender: maskPhone(event.senderPhone) });
      await send(deps, event.senderPhone, WHATSAPP_COPY.transientFailure);
    }
    return "processed";
  }

  await send(deps, event.senderPhone, formatAssistantResult(result));
  return "processed";
}

export { WHATSAPP_IDENTITY_PROVIDER };
