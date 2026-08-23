import { env } from "./env";
import { transientStoreFromEnv, type TransientStore } from "./transientStore";
import {
  GUPSHUP_PROVIDER_NAME,
  MetaWhatsAppProvider,
  WHATSAPP_PROVIDER_NAME,
  type WhatsAppProvider,
  type WhatsAppProviderName,
} from "../services/whatsappProvider";
import { GupshupWhatsAppProvider } from "../services/gupshupProvider";
import { OpenAICompatibleLanguageModel } from "../services/assistantLanguageModel";
import type { AssistantLanguageModel } from "../services/assistantLanguageModel";
import {
  OpenAIAudioTranscriptionService,
  type AudioTranscriptionService,
} from "../services/audioTranscriptionService";

// ── Application-lifecycle singletons for the WhatsApp Assistant (A3.1) ───
// Built lazily from env, once per process. No per-request clients, no
// process-memory state fallback, and env URLs/tokens are never logged.

let transientStore: TransientStore | null | undefined;
let whatsappProvider: WhatsAppProvider | undefined;
let gupshupProvider: GupshupWhatsAppProvider | undefined;
let languageModel: AssistantLanguageModel | undefined;
let transcriptionService: AudioTranscriptionService | undefined;

// null means "state layer unavailable" → callers must fail closed.
export function getRuntimeTransientStore(): TransientStore | null {
  if (transientStore === undefined) {
    transientStore = transientStoreFromEnv(env.REDIS_URL);
  }
  return transientStore;
}

// Explicit provider selection: "whatsapp" (Meta) or "gupshup". Each provider
// resolves its own config lazily; a provider whose env is absent reports
// unconfigured and its routes fail closed.
export function getWhatsAppProvider(provider: WhatsAppProviderName = WHATSAPP_PROVIDER_NAME): WhatsAppProvider {
  if (provider === GUPSHUP_PROVIDER_NAME) {
    if (!gupshupProvider) {
      gupshupProvider = new GupshupWhatsAppProvider({
        apiKey: env.GUPSHUP_API_KEY,
        appName: env.GUPSHUP_APP_NAME,
        sourceNumber: env.GUPSHUP_SOURCE_NUMBER,
        inboundAllowlist: (env.GUPSHUP_WEBHOOK_IP_ALLOWLIST ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      });
    }
    return gupshupProvider;
  }
  if (!whatsappProvider) {
    whatsappProvider = new MetaWhatsAppProvider({
      verifyToken: env.WHATSAPP_VERIFY_TOKEN,
      appSecret: env.WHATSAPP_APP_SECRET,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    });
  }
  return whatsappProvider;
}

export function getAssistantLanguageModel(): AssistantLanguageModel {
  if (!languageModel) {
    languageModel = new OpenAICompatibleLanguageModel({
      baseUrl: env.ASSISTANT_LLM_BASE_URL,
      apiKey: env.ASSISTANT_LLM_API_KEY,
      model: env.ASSISTANT_LLM_MODEL,
    });
  }
  return languageModel;
}

export function getAssistantAudioTranscriptionService(): AudioTranscriptionService {
  if (!transcriptionService) {
    transcriptionService = new OpenAIAudioTranscriptionService({
      baseUrl: env.ASSISTANT_LLM_BASE_URL,
      apiKey: env.ASSISTANT_LLM_API_KEY,
      model: process.env.ASSISTANT_TRANSCRIPTION_MODEL || "whisper-1",
    });
  }
  return transcriptionService;
}
