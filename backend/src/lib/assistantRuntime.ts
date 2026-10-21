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
import { OpenAICompatibleLanguageModel, FallbackLanguageModel } from "../services/assistantLanguageModel";
import type { AssistantLanguageModel, OpenAICompatibleConfig } from "../services/assistantLanguageModel";
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

export interface AssistantLanguageModelEnvSource {
  ASSISTANT_LLM_BASE_URL?: string;
  ASSISTANT_LLM_API_KEY?: string;
  ASSISTANT_LLM_MODEL?: string;
  // Optional JSON array of extra OpenAI-compatible providers, tried in order
  // after the primary when it fails: [{ baseUrl, apiKey, model, timeoutMs? }].
  ASSISTANT_LLM_FALLBACKS?: string;
}

export function resolveAssistantLanguageModelConfig(source: AssistantLanguageModelEnvSource = {
  ASSISTANT_LLM_BASE_URL: env.ASSISTANT_LLM_BASE_URL,
  ASSISTANT_LLM_API_KEY: env.ASSISTANT_LLM_API_KEY,
  ASSISTANT_LLM_MODEL: env.ASSISTANT_LLM_MODEL,
}) {
  return {
    baseUrl: source.ASSISTANT_LLM_BASE_URL,
    apiKey: source.ASSISTANT_LLM_API_KEY,
    model: source.ASSISTANT_LLM_MODEL,
  };
}

// Parse ASSISTANT_LLM_FALLBACKS (optional JSON array) into provider configs.
// Malformed JSON or a non-array value is ignored — an optional feature must
// never crash startup — and only fully specified providers are kept.
function parseFallbackConfigs(raw?: string): OpenAICompatibleConfig[] {
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => ({
      baseUrl: typeof entry.baseUrl === "string" ? entry.baseUrl : undefined,
      apiKey: typeof entry.apiKey === "string" ? entry.apiKey : undefined,
      model: typeof entry.model === "string" ? entry.model : undefined,
      timeoutMs: typeof entry.timeoutMs === "number" ? entry.timeoutMs : undefined,
    }))
    .filter((config) => config.baseUrl && config.apiKey && config.model);
}

// The primary provider (ASSISTANT_LLM_*) followed by the ordered fallbacks.
export function resolveAssistantLanguageModelConfigs(source: AssistantLanguageModelEnvSource = {
  ASSISTANT_LLM_BASE_URL: env.ASSISTANT_LLM_BASE_URL,
  ASSISTANT_LLM_API_KEY: env.ASSISTANT_LLM_API_KEY,
  ASSISTANT_LLM_MODEL: env.ASSISTANT_LLM_MODEL,
  ASSISTANT_LLM_FALLBACKS: env.ASSISTANT_LLM_FALLBACKS,
}): OpenAICompatibleConfig[] {
  const primary: OpenAICompatibleConfig = {
    baseUrl: source.ASSISTANT_LLM_BASE_URL,
    apiKey: source.ASSISTANT_LLM_API_KEY,
    model: source.ASSISTANT_LLM_MODEL,
  };
  return [primary, ...parseFallbackConfigs(source.ASSISTANT_LLM_FALLBACKS)];
}

// Build the assistant model: a single OpenAICompatibleLanguageModel when only
// one provider is configured (unchanged behavior), or a FallbackLanguageModel
// over all fully-configured providers in order. Keeping the lone primary when
// nothing is configured preserves the existing "not configured" error.
export function buildAssistantLanguageModel(
  configs: OpenAICompatibleConfig[] = resolveAssistantLanguageModelConfigs(),
): AssistantLanguageModel {
  const configured = configs.filter((config) => config.baseUrl && config.apiKey && config.model);
  const effective = configured.length > 0 ? configured : configs.slice(0, 1);
  const models = effective.map((config) => new OpenAICompatibleLanguageModel(config));
  return models.length === 1 ? models[0] : new FallbackLanguageModel(models);
}

export function getAssistantLanguageModel(): AssistantLanguageModel {
  if (!languageModel) {
    languageModel = buildAssistantLanguageModel();
  }
  return languageModel;
}

export interface AudioTranscriptionEnvSource {
  AUDIO_TRANSCRIPTION_BASE_URL?: string;
  AUDIO_TRANSCRIPTION_API_KEY?: string;
  AUDIO_TRANSCRIPTION_MODEL?: string;
  ASSISTANT_LLM_BASE_URL?: string;
  ASSISTANT_LLM_API_KEY?: string;
  ASSISTANT_TRANSCRIPTION_MODEL?: string;
}

export function resolveAudioTranscriptionConfig(source: AudioTranscriptionEnvSource = {
  AUDIO_TRANSCRIPTION_BASE_URL: env.AUDIO_TRANSCRIPTION_BASE_URL,
  AUDIO_TRANSCRIPTION_API_KEY: env.AUDIO_TRANSCRIPTION_API_KEY,
  AUDIO_TRANSCRIPTION_MODEL: env.AUDIO_TRANSCRIPTION_MODEL,
  ASSISTANT_LLM_BASE_URL: env.ASSISTANT_LLM_BASE_URL,
  ASSISTANT_LLM_API_KEY: env.ASSISTANT_LLM_API_KEY,
  ASSISTANT_TRANSCRIPTION_MODEL: process.env.ASSISTANT_TRANSCRIPTION_MODEL,
}) {
  return {
    baseUrl: source.AUDIO_TRANSCRIPTION_BASE_URL || source.ASSISTANT_LLM_BASE_URL,
    apiKey: source.AUDIO_TRANSCRIPTION_API_KEY || source.ASSISTANT_LLM_API_KEY,
    model: source.AUDIO_TRANSCRIPTION_MODEL || source.ASSISTANT_TRANSCRIPTION_MODEL || "whisper-1",
  };
}

export function getAssistantAudioTranscriptionService(): AudioTranscriptionService {
  if (!transcriptionService) {
    transcriptionService = new OpenAIAudioTranscriptionService(resolveAudioTranscriptionConfig());
  }
  return transcriptionService;
}

export function _resetAssistantRuntimeForTests(): void {
  transientStore = undefined;
  whatsappProvider = undefined;
  gupshupProvider = undefined;
  languageModel = undefined;
  transcriptionService = undefined;
}
