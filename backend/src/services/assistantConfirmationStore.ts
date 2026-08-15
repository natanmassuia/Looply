import { AppError } from "../lib/errors";
import type { TransientStore } from "../lib/transientStore";

// ── Assistant pending-confirmation state (A3.0) ──────────────────────────
// Namespaced, expiring, single-use records holding an exact structured
// command plus its authoritative company/user. No secrets, no raw prompts,
// no conversation history. Consumed atomically via getAndDelete.

export const CONFIRMATION_TTL_SECONDS = 600; // 10 minutes

export interface PendingConfirmation {
  companyId: string;
  userId: string;
  command: { operation: string; payload: unknown };
  createdAt: string;
  expiresAt: string;
  correlationId?: string;
}

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function confirmationKey(companyId: string, userId: string) {
  if (!KEY_ID_PATTERN.test(companyId) || !KEY_ID_PATTERN.test(userId)) {
    throw new AppError(400, "Identificador inválido", "bad_request");
  }
  return `looply:assistant:confirmation:${companyId}:${userId}`;
}

export async function savePendingConfirmation(
  store: TransientStore,
  record: PendingConfirmation,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_SECONDS * 1000);
  await store.set(confirmationKey(record.companyId, record.userId), JSON.stringify({
    companyId: record.companyId,
    userId: record.userId,
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
  userId: string,
) {
  return parse(await store.get(confirmationKey(companyId, userId)));
}

// Atomic single-use consume: Redis GETDEL guarantees exactly one consumer.
export async function consumePendingConfirmation(
  store: TransientStore,
  companyId: string,
  userId: string,
) {
  return parse(await store.getAndDelete(confirmationKey(companyId, userId)));
}

export async function clearPendingConfirmation(
  store: TransientStore,
  companyId: string,
  userId: string,
) {
  await store.delete(confirmationKey(companyId, userId));
}
