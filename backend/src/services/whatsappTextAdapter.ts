import type { DB } from "../lib/db";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import type { TransientStore } from "../lib/transientStore";
import type { ObjectStorage } from "../lib/storage";
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
import {
  isAllowedAudioMime,
  MAX_AUDIO_SIZE_BYTES,
  type AudioTranscriptionService,
} from "./audioTranscriptionService";
import type {
  WhatsAppInboundEvent,
  WhatsAppMediaPayload,
  WhatsAppOutboundResult,
  WhatsAppStatusUpdateEvent,
} from "./whatsappProvider";
import { formatAssistantResult, WHATSAPP_COPY, confirmationPrompt } from "./whatsappReplyFormatter";
import {
  handleCustomerWhatsAppInbound,
  type WhatsAppCustomerOutcome,
} from "./whatsappCustomerAdapter";
import {
  resolveWhatsAppChannelDetails,
  updateMessageDeliveryStatus,
} from "./conversationService";

// ── WhatsApp transport adapter (A3.1 Text + A3.2 Audio Transcription V1) ─
// Transport only: idempotency → audio transcription / text extraction →
// actor resolution → confirmation phrases → language adapter → A2 command router →
// deterministic reply. It never calls domain services or Prisma directly and
// never becomes a second router.

const POSITIVE_CONFIRMATIONS = new Set(["sim", "confirmo", "confirmar"]);
const NEGATIVE_CONFIRMATIONS = new Set(["não", "nao", "cancelar"]);

export type WhatsAppInboundOutcome =
  | "processed"
  | "duplicate"
  | "non_text"
  | "unsupported_media"
  | "unauthorized"
  | "transient_failure"
  | "malformed";

export interface WhatsAppAdapterDeps {
  db: DB;
  store: TransientStore;
  provider: {
    sendText(to: string, text: string): Promise<WhatsAppOutboundResult | void>;
    downloadMedia?(media: WhatsAppMediaPayload): Promise<{ buffer: Buffer; contentType: string }>;
  };
  languageModel: AssistantLanguageModel;
  transcriptionService?: AudioTranscriptionService;
  storage?: ObjectStorage;
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

  // 2. Extract or transcribe text from the inbound event.
  let text = "";

  let actor: Awaited<ReturnType<typeof resolveWhatsAppActor>> | undefined;
  if (event.type === "text") {
    if (typeof event.text !== "string") return "malformed";
    text = event.text.trim();
    if (!text) return "malformed";
  } else if (event.type === "audio") {
    if (!deps.transcriptionService) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.nonText);
      return "non_text";
    }
    if (!deps.provider.downloadMedia || !event.media || (!event.media.id && !event.media.url)) {
      logger.warn("whatsapp_audio_download_unsupported", { sender: maskPhone(event.senderPhone) });
      await send(deps, event.senderPhone, WHATSAPP_COPY.audioDownloadFailure);
      return "transient_failure";
    }

    // Authenticate BEFORE downloading/transcribing so unknown senders cannot
    // burn bandwidth or transcription credits.
    actor = await resolveWhatsAppActor(deps.db, event.provider, event.senderPhone);
    if (!actor) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.unauthorized);
      return "unauthorized";
    }

    // Check MIME allowlist upfront if present in webhook metadata
    if (event.media.mimeType && !isAllowedAudioMime(event.media.mimeType)) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.unsupportedAudioMime);
      return "unsupported_media";
    }

    let downloaded: { buffer: Buffer; contentType: string };
    try {
      downloaded = await deps.provider.downloadMedia(event.media);
    } catch (err) {
      logger.warn("whatsapp_audio_download_failed", {
        sender: maskPhone(event.senderPhone),
        detail: err instanceof Error ? err.message : String(err),
      });
      await send(deps, event.senderPhone, WHATSAPP_COPY.audioDownloadFailure);
      return "transient_failure";
    }

    // Check MIME allowlist against downloaded content-type
    if (!isAllowedAudioMime(downloaded.contentType)) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.unsupportedAudioMime);
      return "unsupported_media";
    }

    // Check size limit
    if (downloaded.buffer.length > MAX_AUDIO_SIZE_BYTES) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.audioTooLarge);
      return "malformed";
    }

    // Transcribe audio to text
    try {
      const transcription = await deps.transcriptionService.transcribe({
        buffer: downloaded.buffer,
        mimeType: downloaded.contentType,
      });
      text = transcription.text.trim();
    } catch (err) {
      logger.warn("whatsapp_audio_transcription_failed", {
        sender: maskPhone(event.senderPhone),
        detail: err instanceof Error ? err.message : String(err),
      });
      await send(deps, event.senderPhone, WHATSAPP_COPY.transcriptionFailure);
      return "transient_failure";
    }

    // Empty transcription -> prompt user to speak closer or write text
    if (!text) {
      await send(deps, event.senderPhone, WHATSAPP_COPY.emptyAudio);
      return "processed";
    }
  } else {
    // Non-audio, non-text events get a deterministic deferral reply.
    await send(deps, event.senderPhone, WHATSAPP_COPY.nonText);
    return "non_text";
  }

  // 3. Actor resolution — WhatsAppIdentity + active membership only. A Client
  //    phone never becomes an actor; the webhook payload carries no tenant.
  actor ??= await resolveWhatsAppActor(deps.db, event.provider, event.senderPhone);
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

export async function handleWhatsAppStatusUpdate(
  db: DB,
  update: WhatsAppStatusUpdateEvent,
): Promise<boolean> {
  const msg = await db.conversationMessage.findFirst({
    where: {
      provider: update.provider,
      providerMessageId: update.providerMessageId,
    },
    select: { id: true, companyId: true },
  });
  if (!msg) return false;
  const mappedStatus =
    update.status === "sent" ? "SENT"
    : update.status === "delivered" ? "DELIVERED"
    : update.status === "read" ? "READ"
    : "FAILED";
  await updateMessageDeliveryStatus(db, msg.companyId, update.provider, update.providerMessageId, mappedStatus as any);
  return true;
}

export async function dispatchWhatsAppInbound(
  deps: WhatsAppAdapterDeps,
  event: WhatsAppInboundEvent,
): Promise<WhatsAppInboundOutcome | WhatsAppCustomerOutcome> {
  // 1. Internal operator precedence: an authorized WhatsAppIdentity sender
  //    ALWAYS uses the internal Assistant flow (admin capabilities), regardless
  //    of any CUSTOMER_AI channel the message transport maps to. A customer can
  //    never reach administrative capabilities this way.
  const actor = await resolveWhatsAppActor(deps.db, event.provider, event.senderPhone);
  if (actor) {
    return handleWhatsAppInboundText(deps, event);
  }

  // 2. Non-operator: route to the customer pipeline only when the transport
  //    (externalAccountId / sourcePhoneNumber) resolves to a CUSTOMER_AI channel.
  const channel = await resolveWhatsAppChannelDetails(
    deps.db,
    event.provider,
    event.externalAccountId,
    event.sourcePhoneNumber,
  );
  if (channel && channel.purpose === "CUSTOMER_AI") {
    return handleCustomerWhatsAppInbound(deps, channel, event);
  }

  // 3. Fallback: internal pipeline (unknown senders stay unauthorized there).
  return handleWhatsAppInboundText(deps, event);
}

export { WHATSAPP_IDENTITY_PROVIDER, handleWhatsAppInboundText as handleWhatsAppInbound };
