import { AppError } from "../lib/errors";
import type { TransientStore } from "../lib/transientStore";

// ── Assistant pending-confirmation state (A3.0 + F15.4) ──────────────────
// Namespaced, expiring, single-use records holding an exact structured
// command plus its authoritative company/user or company/conversation boundary.
// No secrets, no raw prompts, no conversation history. Consumed atomically
// via getAndDelete.

export const CONFIRMATION_TTL_SECONDS = 600; // 10 minutes

export interface PendingConfirmation {
  companyId: string;
  userId?: string;
  conversationId?: string;
  command: { operation: string; payload: unknown };
  createdAt: string;
  expiresAt: string;
  correlationId?: string;
}

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function confirmationKey(companyId: string, actorOrConversationId: string) {
  if (!KEY_ID_PATTERN.test(companyId) || !KEY_ID_PATTERN.test(actorOrConversationId)) {
    throw new AppError(400, "Identificador inválido", "bad_request");
  }
  return `looply:assistant:confirmation:${companyId}:${actorOrConversationId}`;
}

export async function savePendingConfirmation(
  store: TransientStore,
  record: PendingConfirmation,
) {
  const actorOrConversationId = record.conversationId || record.userId;
  if (!actorOrConversationId) {
    throw new AppError(400, "userId ou conversationId é obrigatório para confirmação", "bad_request");
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_SECONDS * 1000);
  await store.set(confirmationKey(record.companyId, actorOrConversationId), JSON.stringify({
    companyId: record.companyId,
    ...(record.userId ? { userId: record.userId } : {}),
    ...(record.conversationId ? { conversationId: record.conversationId } : {}),
    command: record.command,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ...(record.correlationId ? { correlationId: record.correlationId } : {}),
  }), CONFIRMATION_TTL_SECONDS);
}

async function parse(raw: string | null): Promise<PendingConfirmation | null> {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as PendingConfirmation;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getPendingConfirmation(
  store: TransientStore,
  companyId: string,
  actorOrConversationId: string,
) {
  return parse(await store.get(confirmationKey(companyId, actorOrConversationId)));
}

// Atomic single-use consume: Redis GETDEL guarantees exactly one consumer.
export async function consumePendingConfirmation(
  store: TransientStore,
  companyId: string,
  actorOrConversationId: string,
) {
  return parse(await store.getAndDelete(confirmationKey(companyId, actorOrConversationId)));
}

export async function clearPendingConfirmation(
  store: TransientStore,
  companyId: string,
  actorOrConversationId: string,
) {
  await store.delete(confirmationKey(companyId, actorOrConversationId));
}
