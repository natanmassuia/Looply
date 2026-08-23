import { createHmac, timingSafeEqual } from "node:crypto";

// ── WhatsApp provider boundary (A3.1) ────────────────────────────────────
// Transport only — no domain rules. Two providers share this boundary:
//   "whatsapp" → Meta WhatsApp Cloud API (A3.1). Inbound authenticity:
//     X-Hub-Signature-256 HMAC-SHA256 over the raw body with the App Secret.
//     Outbound: Graph API messages with a bearer token.
//   "gupshup"  → Gupshup official WhatsApp API (A3.G1, see gupshupProvider.ts).
//     Inbound authenticity: documented IP allowlist (no cryptographic
//     signature exists); outbound: form-urlencoded POST to api.gupshup.io.
// Secrets come exclusively from env and are never logged.

export const WHATSAPP_PROVIDER_NAME = "whatsapp";
export const GUPSHUP_PROVIDER_NAME = "gupshup";

export type WhatsAppProviderName = typeof WHATSAPP_PROVIDER_NAME | typeof GUPSHUP_PROVIDER_NAME;

export type WhatsAppInboundEventType = "text" | "audio" | "image" | "video" | "document" | "other";

export interface WhatsAppMediaPayload {
  id?: string;
  url?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface WhatsAppInboundEvent {
  provider: WhatsAppProviderName;
  providerMessageId: string;
  senderPhone: string;
  type: WhatsAppInboundEventType;
  text?: string;
  media?: WhatsAppMediaPayload;
  timestamp?: Date;
}

export interface WhatsAppProviderConfig {
  verifyToken?: string;
  appSecret?: string;
  accessToken?: string;
  phoneNumberId?: string;
  graphApiVersion?: string;
  fetchImpl?: typeof fetch;
}

export interface WhatsAppProvider {
  inboundConfigured(): boolean;
  outboundConfigured(): boolean;
  isValidSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
  isValidVerification(mode: string | undefined, token: string | undefined): boolean;
  normalizeInbound(payload: unknown): WhatsAppInboundEvent[];
  sendText(to: string, text: string): Promise<void>;
  downloadMedia?(media: WhatsAppMediaPayload): Promise<{ buffer: Buffer; contentType: string }>;
}

const KNOWN_NON_TEXT_TYPES = new Set(["audio", "voice", "image", "video", "document", "sticker", "location", "contacts", "reaction", "button", "interactive", "order", "system"]);

function nonTextType(type: string | undefined): WhatsAppInboundEventType {
  if (type === "audio" || type === "voice") return "audio";
  if (type === "image") return "image";
  if (type === "video") return "video";
  if (type === "document") return "document";
  return "other";
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly config: WhatsAppProviderConfig) {}

  inboundConfigured() {
    return Boolean(this.config.verifyToken && this.config.appSecret);
  }

  outboundConfigured() {
    return Boolean(this.config.accessToken && this.config.phoneNumberId);
  }

  isValidSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!this.config.appSecret) return false;
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", this.config.appSecret).update(rawBody).digest();
    let received: Buffer;
    try {
      received = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
    } catch {
      return false;
    }
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  }

  isValidVerification(mode: string | undefined, token: string | undefined): boolean {
    return mode === "subscribe" && Boolean(this.config.verifyToken) && token === this.config.verifyToken;
  }

  normalizeInbound(payload: unknown): WhatsAppInboundEvent[] {
    if (typeof payload !== "object" || payload === null) return [];
    const root = payload as { object?: string; entry?: unknown[] };
    if (root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];
    const events: WhatsAppInboundEvent[] = [];
    for (const entry of root.entry) {
      const changes = (entry as { changes?: unknown[] })?.changes;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const messages = (change as { value?: { messages?: unknown[] } })?.value?.messages;
        if (!Array.isArray(messages)) continue; // status callbacks have no messages
        for (const message of messages) {
          const m = message as { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } };
          if (typeof m.id !== "string" || typeof m.from !== "string") continue;
          const type = typeof m.type === "string" ? m.type : "other";
          const isText = type === "text" && typeof m.text?.body === "string";
          if (!isText && KNOWN_NON_TEXT_TYPES.has(type) === false && type !== "text") continue; // unknown shapes ignored
          const rawMedia = (m as { audio?: { id?: string; mime_type?: string }; voice?: { id?: string; mime_type?: string }; image?: { id?: string; mime_type?: string }; video?: { id?: string; mime_type?: string }; document?: { id?: string; mime_type?: string } }).audio
            ?? (m as { voice?: { id?: string; mime_type?: string } }).voice
            ?? (m as { image?: { id?: string; mime_type?: string } }).image
            ?? (m as { video?: { id?: string; mime_type?: string } }).video
            ?? (m as { document?: { id?: string; mime_type?: string } }).document;
          const media: WhatsAppMediaPayload | undefined = rawMedia && (rawMedia.id || (rawMedia as { url?: string }).url) ? {
            id: rawMedia.id,
            url: (rawMedia as { url?: string }).url,
            mimeType: rawMedia.mime_type,
          } : undefined;

          events.push({
            provider: WHATSAPP_PROVIDER_NAME,
            providerMessageId: m.id,
            senderPhone: m.from,
            type: isText ? "text" : nonTextType(type),
            ...(isText ? { text: (m.text as { body: string }).body } : {}),
            ...(media ? { media } : {}),
            ...(typeof m.timestamp === "string" && /^\d+$/.test(m.timestamp) ? { timestamp: new Date(Number(m.timestamp) * 1000) } : {}),
          });
        }
      }
    }
    return events;
  }

  async sendText(to: string, text: string): Promise<void> {
    const doFetch = this.config.fetchImpl ?? fetch;
    const version = this.config.graphApiVersion ?? "v21.0";
    const response = await doFetch(
      `https://graph.facebook.com/${version}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("WhatsApp outbound send failed");
  }

  async downloadMedia(media: WhatsAppMediaPayload): Promise<{ buffer: Buffer; contentType: string }> {
    if (!media.id && !media.url) throw new Error("Missing media id or url");
    const doFetch = this.config.fetchImpl ?? fetch;
    const version = this.config.graphApiVersion ?? "v21.0";
    let downloadUrl = media.url;
    let mimeType = media.mimeType ?? "audio/ogg";

    if (!downloadUrl && media.id) {
      const infoRes = await doFetch(`https://graph.facebook.com/${version}/${media.id}`, {
        headers: { authorization: `Bearer ${this.config.accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!infoRes.ok) throw new Error("Failed to fetch media metadata from Meta");
      const info = (await infoRes.json()) as { url?: string; mime_type?: string };
      if (!info.url) throw new Error("Meta media response missing url");
      downloadUrl = info.url;
      if (info.mime_type) mimeType = info.mime_type;
    }

    const fileRes = await doFetch(downloadUrl!, {
      headers: { authorization: `Bearer ${this.config.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!fileRes.ok) throw new Error("Failed to download media binary from Meta");
    const arrayBuf = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get("content-type") || mimeType;
    return { buffer: Buffer.from(arrayBuf), contentType };
  }
}
