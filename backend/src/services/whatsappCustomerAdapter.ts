import type { DB } from "../lib/db";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import { normalizePhoneNumber } from "../lib/phone";
import type { TransientStore } from "../lib/transientStore";
import type { ObjectStorage } from "../lib/storage";
import { Capability } from "../domain/capabilities";
import type { AssistantLanguageModel } from "./assistantLanguageModel";
import { interpretAssistantMessage } from "./assistantLanguageAdapter";
import {
  executeAssistantCommand,
  type AssistantDomainServices,
  type AssistantExecutionContext,
} from "./assistantCommandService";
import { claimInboundMessage } from "./whatsappIdempotencyStore";
import {
  consumePendingConfirmation,
  savePendingConfirmation,
} from "./assistantConfirmationStore";
import {
  appendInboundMessage,
  appendOutboundMessage,
  getOrCreateConversation,
  setConversationAiStatus,
  type ResolvedWhatsAppChannel,
} from "./conversationService";
import {
  isAllowedAudioMime,
  MAX_AUDIO_SIZE_BYTES,
  type AudioTranscriptionService,
} from "./audioTranscriptionService";
import type {
  WhatsAppInboundEvent,
  WhatsAppMediaPayload,
  WhatsAppOutboundResult,
} from "./whatsappProvider";
import {
  formatAssistantResult,
  confirmationPrompt,
} from "./whatsappReplyFormatter";

// ── Customer WhatsApp transport adapter (F15.4) ──────────────────────────
// Processes inbound messages for CUSTOMER_AI channels:
// Webhook → Channel Tenant Resolution → Redis Claim → Inbound Persistence →
// Audio/Transcription (if audio) → AI Intake → Confirmation / Command Execution →
// Action Message Persistence → Outbound Reply Persistence & Delivery.

const POSITIVE_CONFIRMATIONS = new Set(["sim", "confirmo", "confirmar"]);
const NEGATIVE_CONFIRMATIONS = new Set(["não", "nao", "cancelar"]);

const CUSTOMER_CAPABILITIES: readonly Capability[] = [
  Capability.CALENDAR,
  Capability.JOBS,
];

const ALLOWED_CUSTOMER_OPERATIONS = new Set([
  "calendar.create",
  "calendar.read",
  "calendar.delete",
  "ticket.create",
  "ticket.read",
]);

export const CUSTOMER_WHATSAPP_COPY = {
  transientFailure:
    "Desculpe, ocorreu uma instabilidade temporária. Por favor, tente novamente em instantes.",
  audioDownloadFailure:
    "Recebi seu áudio, mas não consegui processá-lo no momento. Poderia tentar enviar novamente?",
  unsupportedAudioMime:
    "Formato de áudio não suportado. Por favor, envie como áudio de voz do WhatsApp ou mensagem de texto.",
  audioTooLarge:
    "O arquivo de áudio excede o limite de tamanho (16MB). Por favor, envie um áudio mais curto.",
  transcriptionFailure:
    "Recebi seu áudio, mas não consegui compreendê-lo com clareza. Poderia enviar novamente ou escrever em texto?",
  emptyAudio:
    "Áudio recebido, mas não identifiquei a fala. Poderia enviar uma nova mensagem?",
  nonAudioMedia:
    "Recebi seu arquivo. No momento, o assistente automático responde a mensagens de texto e áudio para agendamentos e demandas.",
  noPendingConfirmation:
    "Não há nenhuma ação pendente de confirmação no momento.",
  confirmationCancelled:
    "Ação cancelada com sucesso.",
  unsupportedOperation:
    "Esta operação não está disponível para autoatendimento. Nossa equipe entrará em contato se necessário.",
  clarificationFallback:
    "Poderia fornecer mais detalhes sobre o que você precisa?",
  errorFallback:
    "Não compreendi sua solicitação. Posso ajudar com agendamentos e solicitações de demandas.",
  clientRequiredForJob:
    "Para registrar sua solicitação de conteúdo, precisamos identificar sua empresa/cadastro. Poderia informar o nome da sua marca ou empresa?",
  executionError:
    "Não foi possível concluir a solicitação neste momento. Nossa equipe foi notificada.",
};

export type WhatsAppCustomerOutcome =
  | "processed"
  | "duplicate"
  | "paused"
  | "needs_attention"
  | "non_text"
  | "unsupported_media"
  | "transient_failure"
  | "malformed";

export interface WhatsAppCustomerAdapterDeps {
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

async function sendCustomerReply(
  deps: WhatsAppCustomerAdapterDeps,
  companyId: string,
  conversationId: string,
  to: string,
  text: string,
  provider: string,
  actionType?: string | null,
  actionMetadata?: Record<string, unknown> | null,
): Promise<void> {
  let providerMessageId: string | null = null;
  let deliveryStatus: "SENT" | "FAILED" = "SENT";

  try {
    const result = await deps.provider.sendText(to, text);
    if (result && typeof result === "object" && "providerMessageId" in result) {
      providerMessageId = result.providerMessageId;
    }
  } catch (err) {
    logger.warn("whatsapp_customer_outbound_failed", {
      to: maskPhone(to),
      detail: err instanceof Error ? err.message : String(err),
    });
    deliveryStatus = "FAILED";
  }

  // Persist outbound message in conversation timeline (never increment unread)
  try {
    await appendOutboundMessage(deps.db, {
      companyId,
      conversationId,
      senderType: "AI",
      provider,
      providerMessageId,
      type: "TEXT",
      body: text,
      deliveryStatus,
      actionType,
      actionMetadata,
      sentAt: deps.now ? deps.now() : new Date(),
    });
  } catch (err) {
    logger.error("whatsapp_customer_outbound_persist_failed", {
      conversationId,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function handleCustomerWhatsAppInbound(
  deps: WhatsAppCustomerAdapterDeps,
  channel: ResolvedWhatsAppChannel,
  event: WhatsAppInboundEvent,
): Promise<WhatsAppCustomerOutcome> {
  const now = deps.now ?? (() => new Date());

  // 1. Idempotency is the FIRST side-effect gate (fail-closed in Redis)
  try {
    const first = await claimInboundMessage(deps.store, event.provider, event.providerMessageId);
    if (!first) return "duplicate";
  } catch (error) {
    if (error instanceof AppError) return "malformed";
    logger.warn("whatsapp_customer_idempotency_unavailable", { sender: maskPhone(event.senderPhone) });
    return "transient_failure";
  }

  // 1b. DB-level idempotency: if the message was already persisted (e.g. Redis
  // state lost between replays) it is a duplicate — never double-execute effects.
  if (event.providerMessageId) {
    const existing = await deps.db.conversationMessage.findFirst({
      where: {
        companyId: channel.companyId,
        provider: event.provider,
        providerMessageId: event.providerMessageId,
      },
      select: { id: true },
    });
    if (existing) return "duplicate";
  }

  // 2. Resolve / Create conversation in this tenant
  let conversation;
  try {
    conversation = await getOrCreateConversation(deps.db, {
      companyId: channel.companyId,
      provider: event.provider,
      remotePhone: event.senderPhone,
      contactName: event.contactName,
    });
  } catch (error) {
    logger.error("whatsapp_customer_conversation_failed", {
      companyId: channel.companyId,
      sender: maskPhone(event.senderPhone),
      detail: error instanceof Error ? error.message : String(error),
    });
    return "malformed";
  }

  // 3. Extract or transcribe text and process media
  let text = "";
  let mediaStorageKey: string | null = null;
  let mediaMimeType: string | null = null;
  let mediaSizeBytes: number | null = null;
  let mediaFilename: string | null = null;
  let transcription: string | null = null;
  let transcriptionStatus: "PENDING" | "COMPLETED" | "FAILED" | null = null;

  if (event.type === "text") {
    if (typeof event.text !== "string") return "malformed";
    text = event.text.trim();
    if (!text) return "malformed";
  } else if (event.type === "audio") {
    mediaMimeType = event.media?.mimeType ?? "audio/ogg";
    mediaFilename = event.media?.filename ?? `audio-${event.providerMessageId}.ogg`;

    if (!deps.transcriptionService || !deps.provider.downloadMedia || !event.media || (!event.media.id && !event.media.url)) {
      transcriptionStatus = "FAILED";
      // Persist inbound audio message
      await appendInboundMessage(deps.db, {
        companyId: channel.companyId,
        conversationId: conversation.id,
        provider: event.provider,
        remotePhone: event.senderPhone,
        contactName: event.contactName,
        providerMessageId: event.providerMessageId,
        type: "AUDIO",
        body: null,
        mediaStorageKey,
        mediaMimeType,
        mediaSizeBytes,
        mediaFilename,
        transcription: null,
        transcriptionStatus: "FAILED",
        receivedAt: event.timestamp || now(),
      });

      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.audioDownloadFailure,
        event.provider,
      );
      return "transient_failure";
    }

    // Check MIME allowlist
    if (event.media.mimeType && !isAllowedAudioMime(event.media.mimeType)) {
      await appendInboundMessage(deps.db, {
        companyId: channel.companyId,
        conversationId: conversation.id,
        provider: event.provider,
        remotePhone: event.senderPhone,
        contactName: event.contactName,
        providerMessageId: event.providerMessageId,
        type: "AUDIO",
        body: null,
        mediaMimeType: event.media.mimeType,
        transcriptionStatus: "FAILED",
        receivedAt: event.timestamp || now(),
      });

      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.unsupportedAudioMime,
        event.provider,
      );
      return "unsupported_media";
    }

    let downloaded: { buffer: Buffer; contentType: string };
    try {
      downloaded = await deps.provider.downloadMedia(event.media);
    } catch (err) {
      logger.warn("whatsapp_customer_audio_download_failed", {
        sender: maskPhone(event.senderPhone),
        detail: err instanceof Error ? err.message : String(err),
      });

      await appendInboundMessage(deps.db, {
        companyId: channel.companyId,
        conversationId: conversation.id,
        provider: event.provider,
        remotePhone: event.senderPhone,
        contactName: event.contactName,
        providerMessageId: event.providerMessageId,
        type: "AUDIO",
        body: null,
        mediaMimeType,
        transcriptionStatus: "FAILED",
        receivedAt: event.timestamp || now(),
      });

      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.audioDownloadFailure,
        event.provider,
      );
      return "transient_failure";
    }

    mediaMimeType = downloaded.contentType;
    mediaSizeBytes = downloaded.buffer.length;

    if (!isAllowedAudioMime(downloaded.contentType)) {
      await appendInboundMessage(deps.db, {
        companyId: channel.companyId,
        conversationId: conversation.id,
        provider: event.provider,
        remotePhone: event.senderPhone,
        contactName: event.contactName,
        providerMessageId: event.providerMessageId,
        type: "AUDIO",
        body: null,
        mediaMimeType: downloaded.contentType,
        mediaSizeBytes,
        transcriptionStatus: "FAILED",
        receivedAt: event.timestamp || now(),
      });

      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.unsupportedAudioMime,
        event.provider,
      );
      return "unsupported_media";
    }

    if (downloaded.buffer.length > MAX_AUDIO_SIZE_BYTES) {
      await appendInboundMessage(deps.db, {
        companyId: channel.companyId,
        conversationId: conversation.id,
        provider: event.provider,
        remotePhone: event.senderPhone,
        contactName: event.contactName,
        providerMessageId: event.providerMessageId,
        type: "AUDIO",
        body: null,
        mediaMimeType: downloaded.contentType,
        mediaSizeBytes,
        transcriptionStatus: "FAILED",
        receivedAt: event.timestamp || now(),
      });

      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.audioTooLarge,
        event.provider,
      );
      return "malformed";
    }

    // Save to Object Storage if storage is configured
    if (deps.storage) {
      try {
        const ext = downloaded.contentType.includes("ogg")
          ? "ogg"
          : downloaded.contentType.includes("mp4") || downloaded.contentType.includes("m4a")
          ? "m4a"
          : "audio";
        mediaStorageKey = `conversations/${channel.companyId}/${conversation.id}/${event.providerMessageId}.${ext}`;
        await deps.storage.putObject({
          key: mediaStorageKey,
          buffer: downloaded.buffer,
          contentType: downloaded.contentType,
        });
      } catch (err) {
        logger.warn("whatsapp_customer_storage_failed", {
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Transcribe audio
    try {
      const transcriptionResult = await deps.transcriptionService.transcribe({
        buffer: downloaded.buffer,
        mimeType: downloaded.contentType,
      });
      text = transcriptionResult.text.trim();
      transcription = text;
      transcriptionStatus = "COMPLETED";
    } catch (err) {
      logger.warn("whatsapp_customer_audio_transcription_failed", {
        sender: maskPhone(event.senderPhone),
        detail: err instanceof Error ? err.message : String(err),
      });
      transcriptionStatus = "FAILED";
      text = "";
    }
  } else {
    // Other media (image, video, document)
    const mediaType = event.type === "image" ? "IMAGE" : event.type === "video" ? "VIDEO" : event.type === "document" ? "DOCUMENT" : "OTHER";
    await appendInboundMessage(deps.db, {
      companyId: channel.companyId,
      conversationId: conversation.id,
      provider: event.provider,
      remotePhone: event.senderPhone,
      contactName: event.contactName,
      providerMessageId: event.providerMessageId,
      type: mediaType as any,
      body: event.text || null,
      mediaMimeType: event.media?.mimeType,
      mediaSizeBytes: event.media?.fileSize,
      mediaFilename: event.media?.filename,
      receivedAt: event.timestamp || now(),
    });

    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      CUSTOMER_WHATSAPP_COPY.nonAudioMedia,
      event.provider,
    );
    return "non_text";
  }

  // 4. Persist Inbound Message to DB BEFORE AI intake
  await appendInboundMessage(deps.db, {
    companyId: channel.companyId,
    conversationId: conversation.id,
    provider: event.provider,
    remotePhone: event.senderPhone,
    contactName: event.contactName,
    providerMessageId: event.providerMessageId,
    type: event.type === "audio" ? "AUDIO" : "TEXT",
    body: text || null,
    mediaStorageKey,
    mediaMimeType,
    mediaSizeBytes,
    mediaFilename,
    transcription,
    transcriptionStatus,
    receivedAt: event.timestamp || now(),
  });

  // If transcription failed or was empty for audio, send polite fallback
  if (event.type === "audio" && (!text || transcriptionStatus === "FAILED")) {
    const fallbackCopy = transcriptionStatus === "FAILED"
      ? CUSTOMER_WHATSAPP_COPY.transcriptionFailure
      : CUSTOMER_WHATSAPP_COPY.emptyAudio;

    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      fallbackCopy,
      event.provider,
    );
    return "processed";
  }

  // 5. AI Status Checks
  if (conversation.aiStatus === "PAUSED") {
    logger.info("whatsapp_customer_ai_paused", { conversationId: conversation.id });
    return "paused";
  }

  if (conversation.aiStatus === "NEEDS_ATTENTION") {
    logger.info("whatsapp_customer_ai_needs_attention", { conversationId: conversation.id });
    return "needs_attention";
  }

  // 6. Check Confirmations in Redis (single use, atomic consume by conversationId)
  const normalized = text.toLowerCase().trim();

  if (POSITIVE_CONFIRMATIONS.has(normalized)) {
    const pending = await consumePendingConfirmation(deps.store, channel.companyId, conversation.id);
    if (!pending) {
      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.noPendingConfirmation,
        event.provider,
      );
      return "processed";
    }

    const execContext: AssistantExecutionContext = {
      companyId: channel.companyId,
      userId: null,
      capabilities: CUSTOMER_CAPABILITIES,
    };

    const result = await executeAssistantCommand(
      deps.db,
      execContext,
      {
        operation: pending.command.operation,
        payload: pending.command.payload,
        confirmed: true,
      },
      deps.services,
    );

    let actionType = "CONFIRMATION_ACCEPTED";
    let actionMetadata: Record<string, unknown> = {
      operation: pending.command.operation,
      payload: pending.command.payload,
    };

    if (result.ok) {
      if (pending.command.operation === "calendar.create") {
        const item = result.result as { id?: string; title?: string; startsAt?: Date };
        actionMetadata = { appointmentId: item.id, title: item.title, startsAt: item.startsAt };
      } else if (pending.command.operation === "ticket.create") {
        const item = result.result as { id?: string; title?: string; format?: string };
        actionMetadata = { jobId: item.id, title: item.title, format: item.format };
      } else if (pending.command.operation === "calendar.delete") {
        actionMetadata = { appointmentId: (pending.command.payload as any)?.appointmentId };
      }
    }

    const reply = formatAssistantResult(result);
    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      reply,
      event.provider,
      actionType,
      actionMetadata,
    );
    return "processed";
  }

  if (NEGATIVE_CONFIRMATIONS.has(normalized)) {
    const pending = await consumePendingConfirmation(deps.store, channel.companyId, conversation.id);
    if (pending) {
      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.confirmationCancelled,
        event.provider,
        "CONFIRMATION_REJECTED",
        { operation: pending.command.operation },
      );
      return "processed";
    }
  }

  // 7. Assistant Language Interpretation (LLM Intake)
  const company = await deps.db.company.findUnique({
    where: { id: channel.companyId },
    select: { timezone: true },
  });
  const timezone = company?.timezone || "America/Sao_Paulo";

  const interpretation = await interpretAssistantMessage(
    deps.languageModel,
    text,
    {
      currentTimestamp: now(),
      timezone,
    },
    { allowMissingTicketClientId: true },
  );

  if (interpretation.kind === "clarification") {
    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      interpretation.message || CUSTOMER_WHATSAPP_COPY.clarificationFallback,
      event.provider,
    );
    return "processed";
  }

  if (interpretation.kind === "unsupported") {
    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      CUSTOMER_WHATSAPP_COPY.unsupportedOperation,
      event.provider,
    );
    return "processed";
  }

  if (interpretation.kind === "error") {
    // Irrecoverable AI parsing for a well-formed customer message → operator attention.
    await setConversationAiStatus(deps.db, channel.companyId, conversation.id, "NEEDS_ATTENTION");
    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      CUSTOMER_WHATSAPP_COPY.errorFallback,
      event.provider,
      "AI_ERROR",
      { error: "ASSISTANT_LANGUAGE_MODEL_ERROR" },
    );
    return "needs_attention";
  }

  // interpretation.kind === "command"
  const command = interpretation.command;

  // Validate command against Customer Allowlist
  if (!ALLOWED_CUSTOMER_OPERATIONS.has(command.operation)) {
    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      CUSTOMER_WHATSAPP_COPY.unsupportedOperation,
      event.provider,
      "AI_ERROR",
      { error: "FORBIDDEN_OPERATION", operation: command.operation },
    );
    return "processed";
  }

  // Client Binding Resolution for Job/Demand creation
  if (command.operation === "ticket.create") {
    const payload = command.payload as { clientId?: string; title?: string; notes?: string; format?: string };
    let resolvedClientId = conversation.clientId;

    if (!resolvedClientId) {
      // Try deterministic phone match with Client table
      const normalizedSender = normalizePhoneNumber(event.senderPhone);
      if (normalizedSender) {
        const match = await deps.db.client.findFirst({
          where: {
            companyId: channel.companyId,
            primaryContactPhone: normalizedSender,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (match) {
          resolvedClientId = match.id;
        }
      }
    }

    if (!resolvedClientId) {
      // Cannot create Job without client -> ask customer & flag NEEDS_ATTENTION
      await setConversationAiStatus(deps.db, channel.companyId, conversation.id, "NEEDS_ATTENTION");
      await sendCustomerReply(
        deps,
        channel.companyId,
        conversation.id,
        event.senderPhone,
        CUSTOMER_WHATSAPP_COPY.clientRequiredForJob,
        event.provider,
        "AI_ERROR",
        { error: "CLIENT_REQUIRED", operation: command.operation },
      );
      return "needs_attention";
    }

    payload.clientId = resolvedClientId;
  }

  // Check if command requires confirmation
  if (command.operation === "calendar.delete") {
    await savePendingConfirmation(deps.store, {
      companyId: channel.companyId,
      conversationId: conversation.id,
      command: { operation: command.operation, payload: command.payload },
      createdAt: now().toISOString(),
      expiresAt: new Date(now().getTime() + 600000).toISOString(),
    });

    const prompt = confirmationPrompt(command.operation);
    await sendCustomerReply(
      deps,
      channel.companyId,
      conversation.id,
      event.senderPhone,
      prompt,
      event.provider,
      "CONFIRMATION_PENDING",
      { command: { operation: command.operation, payload: command.payload } },
    );
    return "processed";
  }

  // Execute Command
  const execContext: AssistantExecutionContext = {
    companyId: channel.companyId,
    userId: null,
    capabilities: CUSTOMER_CAPABILITIES,
  };

  const execResult = await executeAssistantCommand(
    deps.db,
    execContext,
    {
      operation: command.operation,
      payload: command.payload,
      confirmed: true,
    },
    deps.services,
  );

  let actionType: string | null = null;
  let actionMetadata: Record<string, unknown> | null = null;

  if (execResult.ok) {
    if (command.operation === "calendar.create") {
      const item = execResult.result as { id?: string; title?: string; startsAt?: Date; endsAt?: Date };
      actionType = "APPOINTMENT_CREATED";
      actionMetadata = { appointmentId: item?.id, title: item?.title, startsAt: item?.startsAt, endsAt: item?.endsAt };
    } else if (command.operation === "ticket.create") {
      const item = execResult.result as { id?: string; title?: string; format?: string };
      actionType = "JOB_CREATED";
      actionMetadata = { jobId: item?.id, title: item?.title, format: item?.format };
    }
  } else {
    actionType = "AI_ERROR";
    actionMetadata = { error: execResult.error };
  }

  const reply = formatAssistantResult(execResult);
  await sendCustomerReply(
    deps,
    channel.companyId,
    conversation.id,
    event.senderPhone,
    reply,
    event.provider,
    actionType,
    actionMetadata,
  );

  return "processed";
}

