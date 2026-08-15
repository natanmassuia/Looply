import { AppError } from "../lib/errors";
import type { TransientStore } from "../lib/transientStore";

// ── Inbound webhook idempotency claims (A3.0) ────────────────────────────
// "This provider message id has already entered processing." Atomic
// SET NX EX claim; the key holds only provider + opaque message id and a
// timestamp marker. No payload contents are stored.

export const IDEMPOTENCY_TTL_SECONDS = 48 * 60 * 60; // 48 hours

const PROVIDER_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
// Opaque provider message ids (e.g. "wamid.HBg..."): safe Redis-key alphabet only.
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9._=+-]{1,128}$/;

function idempotencyKey(provider: string, providerMessageId: string) {
  // Safe encoding: reject anything outside a small opaque alphabet instead of
  // embedding raw webhook input into the key.
  if (!PROVIDER_PATTERN.test(provider) || !MESSAGE_ID_PATTERN.test(providerMessageId)) {
    throw new AppError(400, "Identificador de mensagem inválido", "bad_request");
  }
  return `looply:whatsapp:idempotency:${provider}:${providerMessageId}`;
}

// true  → this is the first processing claim.
// false → duplicate delivery, do not process again.
export async function claimInboundMessage(
  store: TransientStore,
  provider: string,
  providerMessageId: string,
): Promise<boolean> {
  return store.setIfAbsent(
    idempotencyKey(provider, providerMessageId),
    new Date().toISOString(),
    IDEMPOTENCY_TTL_SECONDS,
  );
}
