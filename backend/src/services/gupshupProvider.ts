import { isIP } from "node:net";
import { safeMediaDownload } from "../lib/ssrfGuard";
import {
  GUPSHUP_PROVIDER_NAME,
  type WhatsAppDeliveryStatusType,
  type WhatsAppInboundEvent,
  type WhatsAppInboundEventType,
  type WhatsAppOutboundResult,
  type WhatsAppProvider,
  type WhatsAppStatusUpdateEvent,
} from "./whatsappProvider";

// ── Gupshup official WhatsApp provider (A3.G1) ───────────────────────────
// Second transport behind the same WhatsAppProvider boundary, reusing the
// entire A3.1 Assistant pipeline (no second pipeline). Transport only — no
// domain rules, no direct Prisma/domain access.
//
// Inbound authenticity: the Gupshup Self-Serve platform provides NO
// cryptographic webhook signature. Its documented security mechanism is IP
// allowlisting (the inbound IPs are obtained from devsupport@gupshup.io).
// We enforce that boundary fail-closed via GUPSHUP_WEBHOOK_IP_ALLOWLIST —
// without an allowlist the inbound path reports unconfigured (503) and no
// invented signature is fabricated. Note: an allowlist is only trustworthy
// behind the single trusted reverse proxy (TRUST_PROXY=true).
//
// Outbound: POST https://api.gupshup.io/wa/api/v1/msg (form-urlencoded).
// Only the current official endpoint (wa/api/v1) is used; never log the
// apikey or message body.

export interface GupshupWhatsAppProviderConfig {
  apiKey?: string;
  appName?: string;
  sourceNumber?: string;
  inboundAllowlist?: string[];
  fetchImpl?: typeof fetch;
}

const OUTBOUND_URL = "https://api.gupshup.io/wa/api/v1/msg";
const OUTBOUND_TIMEOUT_MS = 10000;

const GUPSHUP_NON_TEXT: Record<string, WhatsAppInboundEventType> = {
  image: "image",
  audio: "audio",
  voice: "audio",
  video: "video",
  file: "document",
  document: "document",
};

function messageTypeToEvent(type: string | undefined): WhatsAppInboundEventType | null {
  if (type === "text") return "text";
  if (type === undefined) return null;
  return GUPSHUP_NON_TEXT[type] ?? "other";
}

// ── IP allowlist matching (IPv4 + IPv6 exact and CIDR) ───────────────────
// Fail-closed: empty allowlist, unknown family, or a malformed entry never
// match. Only a request whose source IP is inside a configured entry passes.

function parseIpBytes(ip: string): Buffer | null {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
    return Buffer.from(parts);
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    const separator = normalized.indexOf("::");
    const head = separator === -1 ? normalized : normalized.slice(0, separator);
    const tail = separator === -1 ? "" : normalized.slice(separator + 2);
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    if (headParts.length + tailParts.length > 8) return null;
    if (separator === -1 && headParts.length !== 8) return null;
    const fill = separator === -1 ? 0 : 8 - headParts.length - tailParts.length;
    if (fill < 0) return null;
    const parts = [...headParts, ...Array(fill).fill("0"), ...tailParts];
    if (parts.length !== 8) return null;
    const buf = Buffer.alloc(16);
    for (let i = 0; i < 8; i++) {
      const word = parseInt(parts[i] || "0", 16);
      if (!Number.isInteger(word) || word < 0 || word > 0xffff) return null;
      buf.writeUInt16BE(word, i * 2);
    }
    return buf;
  }
  return null;
}

function cidrMatch(address: Buffer, network: Buffer, prefix: number): boolean {
  const maxBits = address.length * 8;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) return false;
  const fullBytes = Math.floor(prefix / 8);
  const partialBits = prefix % 8;
  for (let i = 0; i < fullBytes; i++) {
    if (address[i] !== network[i]) return false;
  }
  if (partialBits > 0) {
    const mask = (0xff << (8 - partialBits)) & 0xff;
    if ((address[fullBytes] & mask) !== (network[fullBytes] & mask)) return false;
  }
  return true;
}

export function matchesIpAllowlist(ip: string | undefined, allowlist: readonly string[]): boolean {
  if (!ip || allowlist.length === 0) return false;
  const address = parseIpBytes(ip);
  if (!address) return false;
  for (const entry of allowlist) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const slash = trimmed.indexOf("/");
    const host = slash === -1 ? trimmed : trimmed.slice(0, slash);
    const prefix = slash === -1 ? address.length * 8 : Number(trimmed.slice(slash + 1));
    const network = parseIpBytes(host);
    if (!network || network.length !== address.length) continue;
    if (cidrMatch(address, network, prefix)) return true;
  }
  return false;
}

export class GupshupWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly config: GupshupWhatsAppProviderConfig) {}

  // Inbound requires the documented IP allowlist. Without it there is no
  // authenticity boundary and the path reports unconfigured (fail closed).
  inboundConfigured() {
    return (this.config.inboundAllowlist ?? []).length > 0;
  }

  outboundConfigured() {
    return Boolean(this.config.apiKey && this.config.appName && this.config.sourceNumber);
  }

  // No cryptographic signature exists in Gupshup Self-Serve webhooks. The
  // boundary is the IP allowlist enforced at the route (isValidInboundSource).
  isValidSignature() {
    return false;
  }

  // Gupshup has no subscription verification handshake.
  isValidVerification() {
    return false;
  }

  isValidInboundSource(ip: string | undefined): boolean {
    return matchesIpAllowlist(ip, this.config.inboundAllowlist ?? []);
  }

  // Inbound V2 contract (docs.gupshup.io "Inbound message structure V2"):
  // top-level { app, timestamp (ms), version: 2, type, payload }.
  // Only type === "message" enters the Assistant; transport events
  // (message-event, user-event, system-event, billing-event, template-event)
  // are acknowledged at the route and normalized via normalizeStatusUpdates.
  normalizeInbound(payload: unknown): WhatsAppInboundEvent[] {
    if (typeof payload !== "object" || payload === null) return [];
    const root = payload as { app?: unknown; type?: unknown; timestamp?: unknown; payload?: unknown };
    if (root.type !== "message") return [];
    const inner = root.payload as { id?: unknown; source?: unknown; destination?: unknown; type?: unknown; payload?: unknown; sender?: { name?: unknown } } | null | undefined;
    if (typeof inner !== "object" || inner === null) return [];
    if (typeof inner.id !== "string" || inner.id.length === 0) return [];
    if (typeof inner.source !== "string" || inner.source.length === 0) return [];
    const eventType = messageTypeToEvent(typeof inner.type === "string" ? inner.type : undefined);
    if (eventType === null) return [];
    const isText = eventType === "text";
    let text: string | undefined;
    if (isText) {
      const raw = (inner.payload as { text?: unknown } | undefined)?.text;
      if (typeof raw !== "string" || raw.trim().length === 0) return [];
      text = raw;
    }
    let media: { id?: string; url?: string; mimeType?: string; filename?: string } | undefined;
    if (!isText && typeof inner.payload === "object" && inner.payload !== null) {
      const p = inner.payload as { url?: unknown; id?: unknown; contentType?: unknown; name?: unknown; filename?: unknown };
      if (typeof p.url === "string" || typeof p.id === "string") {
        media = {
          url: typeof p.url === "string" ? p.url : undefined,
          id: typeof p.id === "string" ? p.id : undefined,
          mimeType: typeof p.contentType === "string" ? p.contentType : undefined,
          filename: typeof p.name === "string" ? p.name : typeof p.filename === "string" ? p.filename : undefined,
        };
      }
    }
    const timestamp =
      typeof root.timestamp === "number" && Number.isFinite(root.timestamp) && root.timestamp > 0
        ? new Date(root.timestamp)
        : undefined;

    const externalAccountId = typeof root.app === "string" ? root.app : undefined;
    const sourcePhoneNumber = typeof inner.destination === "string" ? inner.destination : undefined;
    const contactName = typeof inner.sender?.name === "string" ? inner.sender.name : undefined;

    return [{
      provider: GUPSHUP_PROVIDER_NAME,
      providerMessageId: inner.id,
      senderPhone: inner.source,
      type: eventType,
      ...(text !== undefined ? { text } : {}),
      ...(media !== undefined ? { media } : {}),
      ...(timestamp ? { timestamp } : {}),
      ...(externalAccountId ? { externalAccountId } : {}),
      ...(sourcePhoneNumber ? { sourcePhoneNumber } : {}),
      ...(contactName ? { contactName } : {}),
    }];
  }

  normalizeStatusUpdates(payload: unknown): WhatsAppStatusUpdateEvent[] {
    if (typeof payload !== "object" || payload === null) return [];
    const root = payload as { type?: unknown; timestamp?: unknown; payload?: unknown };
    if (root.type !== "message-event") return [];
    const inner = root.payload as { id?: unknown; type?: unknown; destination?: unknown; timestamp?: unknown; cause?: unknown } | null | undefined;
    if (typeof inner !== "object" || inner === null) return [];
    if (typeof inner.id !== "string" || typeof inner.type !== "string") return [];

    let status: WhatsAppDeliveryStatusType | null = null;
    if (inner.type === "enqueued" || inner.type === "sent") status = "sent";
    else if (inner.type === "delivered") status = "delivered";
    else if (inner.type === "read") status = "read";
    else if (inner.type === "failed") status = "failed";
    if (!status) return [];

    const timestamp =
      typeof root.timestamp === "number" && Number.isFinite(root.timestamp) && root.timestamp > 0
        ? new Date(root.timestamp)
        : typeof inner.timestamp === "number" && Number.isFinite(inner.timestamp) && inner.timestamp > 0
        ? new Date(inner.timestamp)
        : undefined;

    return [{
      provider: GUPSHUP_PROVIDER_NAME,
      providerMessageId: inner.id,
      recipientPhone: typeof inner.destination === "string" ? inner.destination : undefined,
      status,
      ...(timestamp ? { timestamp } : {}),
      ...(inner.cause ? { rawError: inner.cause } : {}),
    }];
  }

  async sendText(to: string, text: string): Promise<WhatsAppOutboundResult> {
    if (!this.config.apiKey || !this.config.sourceNumber || !this.config.appName) {
      throw new Error("Gupshup outbound send failed");
    }
    const doFetch = this.config.fetchImpl ?? fetch;
    const body = new URLSearchParams({
      channel: "whatsapp",
      source: this.config.sourceNumber,
      destination: to,
      "src.name": this.config.appName,
      message: JSON.stringify({ type: "text", text }),
    });
    const response = await doFetch(OUTBOUND_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        apikey: this.config.apiKey,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("Gupshup outbound send failed");
    const data = (await response.json().catch(() => null)) as { status?: string; messageId?: string } | null;
    const providerMessageId = data?.messageId ?? null;
    return {
      providerMessageId,
      provider: GUPSHUP_PROVIDER_NAME,
      sentAt: new Date(),
    };
  }

  async downloadMedia(media: { id?: string; url?: string; mimeType?: string }): Promise<{ buffer: Buffer; contentType: string }> {
    if (!media.url) throw new Error("Missing media url");
    const doFetch = this.config.fetchImpl ?? fetch;
    return await safeMediaDownload(
      media.url,
      {},
      { fetchImpl: doFetch, timeoutMs: 10000 },
    );
  }
}