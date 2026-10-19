import { env } from "../lib/env";

// ── WhatsApp Business Management API (whatsapp_business_management) ─────
// Read-only queries (phone numbers, message templates) and template sending
// against the Meta Graph API. Used exclusively for the Meta Tech Provider
// review videos; no domain state is mutated.

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  status: string;
}

export interface WhatsAppMessageTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: unknown[];
}

export interface SendTemplateResult {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface ManagementConfig {
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
  graphApiVersion?: string;
  fetchImpl?: typeof fetch;
}

function configFromEnv(): ManagementConfig {
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    wabaId: env.WHATSAPP_WABA_ID,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  };
}

function graphUrl(version: string, path: string): string {
  return `https://graph.facebook.com/${version}/${path}`;
}

export async function listPhoneNumbers(
  config: ManagementConfig = configFromEnv(),
): Promise<WhatsAppPhoneNumber[]> {
  if (!config.accessToken || !config.wabaId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_WABA_ID are required");
  }
  const version = config.graphApiVersion ?? "v21.0";
  const doFetch = config.fetchImpl ?? fetch;

  const res = await doFetch(
    graphUrl(version, `${config.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status`),
    {
      headers: { authorization: `Bearer ${config.accessToken}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to list phone numbers: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { data?: WhatsAppPhoneNumber[] };
  return data.data ?? [];
}

export async function listMessageTemplates(
  config: ManagementConfig = configFromEnv(),
): Promise<WhatsAppMessageTemplate[]> {
  if (!config.accessToken || !config.wabaId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_WABA_ID are required");
  }
  const version = config.graphApiVersion ?? "v21.0";
  const doFetch = config.fetchImpl ?? fetch;

  const res = await doFetch(
    graphUrl(version, `${config.wabaId}/message_templates?fields=id,name,language,status,category,components&limit=100`),
    {
      headers: { authorization: `Bearer ${config.accessToken}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to list message templates: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { data?: WhatsAppMessageTemplate[] };
  return data.data ?? [];
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: unknown[],
  config: ManagementConfig = configFromEnv(),
): Promise<SendTemplateResult> {
  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required");
  }
  const version = config.graphApiVersion ?? "v21.0";
  const doFetch = config.fetchImpl ?? fetch;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components && components.length > 0 ? { components } : {}),
    },
  };

  const res = await doFetch(
    graphUrl(version, `${config.phoneNumberId}/messages`),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Failed to send template message: ${res.status} ${errBody}`);
  }
  return (await res.json()) as SendTemplateResult;
}
