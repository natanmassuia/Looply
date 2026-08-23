import type { DB } from "../lib/db";
import { badRequest, notFound } from "../lib/errors";
import { normalizePhoneNumber } from "../lib/phone";
import type {
  Conversation,
  ConversationAiStatus,
  ConversationMessage,
  ConversationMessageType,
  MessageDeliveryStatus,
  MessageDirection,
  MessageSenderType,
} from "@prisma/client";

// ── Conversation Domain Service (F15.2) ──────────────────────────────────
// Canonical persistent repository and business logic for customer conversations.
// All operations enforce strict multi-tenant isolation via companyId.

export interface ConversationSummaryDto {
  id: string;
  companyId: string;
  provider: string;
  remotePhone: string;
  contactName: string | null;
  contactAvatarUrl: string | null;
  client: { id: string; name: string } | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  aiStatus: ConversationAiStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageDto {
  id: string;
  conversationId: string;
  companyId: string;
  provider: string;
  direction: MessageDirection;
  senderType: MessageSenderType;
  senderUser?: { id: string; name: string } | null;
  type: ConversationMessageType;
  body: string | null;
  media: {
    mimeType?: string | null;
    sizeBytes?: number | null;
    filename?: string | null;
  } | null;
  transcription: string | null;
  deliveryStatus: MessageDeliveryStatus;
  action: {
    type: string;
    metadata: Record<string, unknown>;
  } | null;
  createdAt: string;
}

export interface GetOrCreateConversationInput {
  companyId: string;
  provider?: string;
  remotePhone: string;
  contactName?: string | null;
  contactAvatarUrl?: string | null;
  clientId?: string | null;
}

export interface ListConversationsOptions {
  cursor?: string;
  limit?: number;
  search?: string;
  aiStatus?: ConversationAiStatus;
}

export interface ListMessagesOptions {
  cursor?: string;
  limit?: number;
}

export interface AppendInboundMessageInput {
  companyId: string;
  conversationId?: string;
  provider?: string;
  remotePhone?: string;
  contactName?: string | null;
  contactAvatarUrl?: string | null;
  providerMessageId?: string | null;
  type?: ConversationMessageType;
  body?: string | null;
  mediaStorageKey?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: number | null;
  mediaFilename?: string | null;
  transcription?: string | null;
  deliveryStatus?: MessageDeliveryStatus;
  actionType?: string | null;
  actionMetadata?: Record<string, unknown> | null;
  receivedAt?: Date;
}

export interface AppendOutboundMessageInput {
  companyId: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderUserId?: string | null;
  provider?: string;
  providerMessageId?: string | null;
  type?: ConversationMessageType;
  body?: string | null;
  mediaStorageKey?: string | null;
  mediaMimeType?: string | null;
  mediaSizeBytes?: number | null;
  mediaFilename?: string | null;
  deliveryStatus?: MessageDeliveryStatus;
  actionType?: string | null;
  actionMetadata?: Record<string, unknown> | null;
  sentAt?: Date;
}

export interface NormalizedConversationInbound {
  companyId: string;
  provider: string;
  providerMessageId?: string;
  remotePhone: string;
  contactName?: string;
  contactAvatarUrl?: string;
  type: ConversationMessageType;
  body?: string;
  media?: {
    storageKey?: string;
    mimeType?: string;
    sizeBytes?: number;
    filename?: string;
  };
  transcription?: string;
  actionType?: string;
  actionMetadata?: Record<string, unknown>;
  receivedAt?: Date;
}

export function toConversationSummaryDto(row: Conversation & { client?: { id: string; name: string } | null }): ConversationSummaryDto {
  return {
    id: row.id,
    companyId: row.companyId,
    provider: row.provider,
    remotePhone: row.remotePhone,
    contactName: row.contactName,
    contactAvatarUrl: row.contactAvatarUrl,
    client: row.client ? { id: row.client.id, name: row.client.name } : null,
    lastMessagePreview: row.lastMessagePreview,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    unreadCount: row.unreadCount,
    aiStatus: row.aiStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toConversationMessageDto(row: ConversationMessage & { senderUser?: { id: string; name: string } | null }): ConversationMessageDto {
  const hasMedia = Boolean(row.mediaMimeType || row.mediaSizeBytes || row.mediaFilename || row.mediaStorageKey);
  const media = hasMedia ? {
    mimeType: row.mediaMimeType,
    sizeBytes: row.mediaSizeBytes,
    filename: row.mediaFilename,
  } : null;

  const action = row.actionType ? {
    type: row.actionType,
    metadata: (row.actionMetadata as Record<string, unknown>) ?? {},
  } : null;

  return {
    id: row.id,
    conversationId: row.conversationId,
    companyId: row.companyId,
    provider: row.provider,
    direction: row.direction,
    senderType: row.senderType,
    senderUser: row.senderUser ? { id: row.senderUser.id, name: row.senderUser.name } : null,
    type: row.type,
    body: row.body,
    media,
    transcription: row.transcription,
    deliveryStatus: row.deliveryStatus,
    action,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOrCreateConversation(
  db: DB,
  input: GetOrCreateConversationInput,
): Promise<Conversation & { client?: { id: string; name: string } | null }> {
  const provider = input.provider || "whatsapp";
  const normalizedPhone = normalizePhoneNumber(input.remotePhone);
  if (!normalizedPhone) {
    throw badRequest("Telefone do contato inválido");
  }

  const existing = await db.conversation.findUnique({
    where: {
      companyId_provider_remotePhone: {
        companyId: input.companyId,
        provider,
        remotePhone: normalizedPhone,
      },
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  if (existing) {
    let needsUpdate = false;
    const updateData: { contactName?: string; contactAvatarUrl?: string; clientId?: string } = {};

    if (input.contactName && input.contactName !== existing.contactName) {
      updateData.contactName = input.contactName;
      needsUpdate = true;
    }
    if (input.contactAvatarUrl && input.contactAvatarUrl !== existing.contactAvatarUrl) {
      updateData.contactAvatarUrl = input.contactAvatarUrl;
      needsUpdate = true;
    }
    if (input.clientId && !existing.clientId) {
      // Validate client belongs to tenant
      const client = await db.client.findFirst({
        where: { id: input.clientId, companyId: input.companyId },
        select: { id: true },
      });
      if (client) {
        updateData.clientId = input.clientId;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      return db.conversation.update({
        where: { id: existing.id },
        data: updateData,
        include: { client: { select: { id: true, name: true } } },
      });
    }

    return existing;
  }

  // If clientId is supplied, verify it belongs to this company
  let validClientId: string | null = null;
  if (input.clientId) {
    const client = await db.client.findFirst({
      where: { id: input.clientId, companyId: input.companyId },
      select: { id: true },
    });
    if (client) validClientId = client.id;
  }

  return db.conversation.create({
    data: {
      companyId: input.companyId,
      provider,
      remotePhone: normalizedPhone,
      contactName: input.contactName ?? null,
      contactAvatarUrl: input.contactAvatarUrl ?? null,
      clientId: validClientId,
      aiStatus: "ACTIVE",
      unreadCount: 0,
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });
}

export async function listConversations(
  db: DB,
  companyId: string,
  options: ListConversationsOptions = {},
): Promise<{ items: ConversationSummaryDto[]; nextCursor: string | null }> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  const where: any = { companyId };

  if (options.aiStatus) {
    where.aiStatus = options.aiStatus;
  }

  if (options.search && options.search.trim()) {
    const term = options.search.trim();
    where.OR = [
      { contactName: { contains: term, mode: "insensitive" } },
      { remotePhone: { contains: term } },
    ];
  }

  const findArgs: any = {
    where,
    take: limit + 1,
    orderBy: [
      { lastMessageAt: "desc" },
      { updatedAt: "desc" },
      { id: "desc" },
    ],
    include: {
      client: { select: { id: true, name: true } },
    },
  };

  if (options.cursor) {
    findArgs.cursor = { id: options.cursor };
    findArgs.skip = 1;
  }

  const rows = await db.conversation.findMany(findArgs);
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const nextItem = rows.pop()!;
    nextCursor = nextItem.id;
  }

  return {
    items: rows.map(toConversationSummaryDto),
    nextCursor,
  };
}

export async function getConversation(
  db: DB,
  companyId: string,
  conversationId: string,
): Promise<ConversationSummaryDto> {
  const row = await db.conversation.findFirst({
    where: { id: conversationId, companyId },
    include: { client: { select: { id: true, name: true } } },
  });

  if (!row) {
    throw notFound("Conversa não encontrada");
  }

  return toConversationSummaryDto(row);
}

export async function listMessages(
  db: DB,
  companyId: string,
  conversationId: string,
  options: ListMessagesOptions = {},
): Promise<{ items: ConversationMessageDto[]; nextCursor: string | null }> {
  // Ensure conversation exists in this tenant
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, companyId },
    select: { id: true },
  });
  if (!conv) {
    throw notFound("Conversa não encontrada");
  }

  const limit = Math.min(100, Math.max(1, options.limit ?? 50));

  const findArgs: any = {
    where: { conversationId, companyId },
    take: limit + 1,
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    include: {
      senderUser: { select: { id: true, name: true } },
    },
  };

  if (options.cursor) {
    findArgs.cursor = { id: options.cursor };
    findArgs.skip = 1;
  }

  const rows = await db.conversationMessage.findMany(findArgs);
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const nextItem = rows.pop()!;
    nextCursor = nextItem.id;
  }

  return {
    items: rows.map(toConversationMessageDto),
    nextCursor,
  };
}

export async function appendInboundMessage(
  db: DB,
  input: AppendInboundMessageInput,
): Promise<ConversationMessageDto> {
  const provider = input.provider || "whatsapp";

  // Durable idempotency check: if providerMessageId is provided, check if already exists
  if (input.providerMessageId) {
    const existingMessage = await db.conversationMessage.findFirst({
      where: {
        companyId: input.companyId,
        provider,
        providerMessageId: input.providerMessageId,
      },
      include: {
        senderUser: { select: { id: true, name: true } },
      },
    });
    if (existingMessage) {
      return toConversationMessageDto(existingMessage);
    }
  }

  // Resolve conversation
  let conversationId = input.conversationId;
  if (!conversationId) {
    if (!input.remotePhone) {
      throw badRequest("remotePhone ou conversationId é obrigatório");
    }
    const conv = await getOrCreateConversation(db, {
      companyId: input.companyId,
      provider,
      remotePhone: input.remotePhone,
      contactName: input.contactName,
      contactAvatarUrl: input.contactAvatarUrl,
    });
    conversationId = conv.id;
  } else {
    // Verify conversation belongs to company
    const conv = await db.conversation.findFirst({
      where: { id: conversationId, companyId: input.companyId },
      select: { id: true },
    });
    if (!conv) {
      throw notFound("Conversa não encontrada");
    }
  }

  const type = input.type || "TEXT";
  const now = input.receivedAt || new Date();
  const preview = input.body || (type !== "TEXT" ? `[${type}]` : null);

  const message = await db.conversationMessage.create({
    data: {
      conversationId,
      companyId: input.companyId,
      provider,
      direction: "INBOUND",
      senderType: "CONTACT",
      type,
      body: input.body ?? null,
      providerMessageId: input.providerMessageId ?? null,
      mediaStorageKey: input.mediaStorageKey ?? null,
      mediaMimeType: input.mediaMimeType ?? null,
      mediaSizeBytes: input.mediaSizeBytes ?? null,
      mediaFilename: input.mediaFilename ?? null,
      transcription: input.transcription ?? null,
      deliveryStatus: input.deliveryStatus ?? "DELIVERED",
      actionType: input.actionType ?? null,
      actionMetadata: (input.actionMetadata as any) ?? undefined,
      createdAt: now,
    },
    include: {
      senderUser: { select: { id: true, name: true } },
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessagePreview: preview,
      lastMessageAt: now,
      unreadCount: { increment: 1 },
    },
  });

  return toConversationMessageDto(message);
}

export async function appendOutboundMessage(
  db: DB,
  input: AppendOutboundMessageInput,
): Promise<ConversationMessageDto> {
  const provider = input.provider || "whatsapp";

  // Verify conversation belongs to company
  const conv = await db.conversation.findFirst({
    where: { id: input.conversationId, companyId: input.companyId },
    select: { id: true },
  });
  if (!conv) {
    throw notFound("Conversa não encontrada");
  }

  // If senderUserId is provided, verify it belongs to this company
  if (input.senderUserId) {
    const member = await db.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: input.senderUserId,
          companyId: input.companyId,
        },
      },
      select: { id: true },
    });
    if (!member) {
      throw badRequest("Usuário remetente não pertence a este workspace");
    }
  }

  const type = input.type || "TEXT";
  const now = input.sentAt || new Date();
  const preview = input.body || (type !== "TEXT" ? `[${type}]` : null);

  const message = await db.conversationMessage.create({
    data: {
      conversationId: input.conversationId,
      companyId: input.companyId,
      provider,
      direction: "OUTBOUND",
      senderType: input.senderType,
      senderUserId: input.senderUserId ?? null,
      type,
      body: input.body ?? null,
      providerMessageId: input.providerMessageId ?? null,
      mediaStorageKey: input.mediaStorageKey ?? null,
      mediaMimeType: input.mediaMimeType ?? null,
      mediaSizeBytes: input.mediaSizeBytes ?? null,
      mediaFilename: input.mediaFilename ?? null,
      deliveryStatus: input.deliveryStatus ?? "SENT",
      actionType: input.actionType ?? null,
      actionMetadata: (input.actionMetadata as any) ?? undefined,
      createdAt: now,
    },
    include: {
      senderUser: { select: { id: true, name: true } },
    },
  });

  await db.conversation.update({
    where: { id: input.conversationId },
    data: {
      lastMessagePreview: preview,
      lastMessageAt: now,
    },
  });

  return toConversationMessageDto(message);
}

export async function markConversationRead(
  db: DB,
  companyId: string,
  conversationId: string,
): Promise<{ ok: true; unreadCount: number }> {
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, companyId },
    select: { id: true },
  });
  if (!conv) {
    throw notFound("Conversa não encontrada");
  }

  await db.conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });

  return { ok: true, unreadCount: 0 };
}

export async function setConversationAiStatus(
  db: DB,
  companyId: string,
  conversationId: string,
  aiStatus: ConversationAiStatus,
): Promise<ConversationSummaryDto> {
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, companyId },
    select: { id: true },
  });
  if (!conv) {
    throw notFound("Conversa não encontrada");
  }

  const updated = await db.conversation.update({
    where: { id: conversationId },
    data: { aiStatus },
    include: { client: { select: { id: true, name: true } } },
  });

  return toConversationSummaryDto(updated);
}

export async function bindConversationClient(
  db: DB,
  companyId: string,
  conversationId: string,
  clientId: string | null,
): Promise<ConversationSummaryDto> {
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, companyId },
    select: { id: true },
  });
  if (!conv) {
    throw notFound("Conversa não encontrada");
  }

  if (clientId !== null) {
    const client = await db.client.findFirst({
      where: { id: clientId, companyId },
      select: { id: true },
    });
    if (!client) {
      throw notFound("Cliente não encontrado neste workspace");
    }
  }

  const updated = await db.conversation.update({
    where: { id: conversationId },
    data: { clientId },
    include: { client: { select: { id: true, name: true } } },
  });

  return toConversationSummaryDto(updated);
}

export async function resolveCompanyForChannel(
  db: DB,
  provider: string,
  externalAccountId?: string,
  sourcePhoneNumber?: string,
): Promise<string | null> {
  if (externalAccountId) {
    const channel = await db.whatsAppChannel.findUnique({
      where: {
        provider_externalAccountId: {
          provider,
          externalAccountId,
        },
      },
      select: { companyId: true, isActive: true },
    });
    if (channel && channel.isActive) return channel.companyId;
  }

  if (sourcePhoneNumber) {
    const normalized = normalizePhoneNumber(sourcePhoneNumber);
    if (normalized) {
      const channel = await db.whatsAppChannel.findFirst({
        where: {
          provider,
          sourcePhoneNumber: normalized,
          isActive: true,
        },
        select: { companyId: true },
      });
      if (channel) return channel.companyId;
    }
  }

  return null;
}

export async function persistNormalizedInboundMessage(
  db: DB,
  event: NormalizedConversationInbound,
): Promise<ConversationMessageDto> {
  return appendInboundMessage(db, {
    companyId: event.companyId,
    provider: event.provider,
    providerMessageId: event.providerMessageId,
    remotePhone: event.remotePhone,
    contactName: event.contactName,
    contactAvatarUrl: event.contactAvatarUrl,
    type: event.type,
    body: event.body,
    mediaStorageKey: event.media?.storageKey,
    mediaMimeType: event.media?.mimeType,
    mediaSizeBytes: event.media?.sizeBytes,
    mediaFilename: event.media?.filename,
    transcription: event.transcription,
    actionType: event.actionType,
    actionMetadata: event.actionMetadata,
    receivedAt: event.receivedAt,
  });
}
