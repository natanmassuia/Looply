import { env } from "./env";
import { transientStoreFromEnv, type TransientStore } from "./transientStore";
import {
  MetaWhatsAppProvider,
  WHATSAPP_PROVIDER_NAME,
  type WhatsAppProvider,
  type WhatsAppProviderName,
} from "../services/whatsappProvider";
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
let languageModel: AssistantLanguageModel | undefined;
let transcriptionService: AudioTranscriptionService | undefined;

// null means "state layer unavailable" → callers must fail closed.
export function getRuntimeTransientStore(): TransientStore | null {
  if (transientStore === undefined) {
    transientStore = transientStoreFromEnv(env.REDIS_URL);
  }
  return transientStore;
}

// Meta WhatsApp Cloud API provider singleton. Resolves its config lazily; when
// env is absent it reports unconfigured and its routes fail closed.
export function getWhatsAppProvider(_provider: WhatsAppProviderName = WHATSAPP_PROVIDER_NAME): WhatsAppProvider {
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

export function getAssistantLanguageModel(): AssistantLanguageModel {
  if (!languageModel) {
    languageModel = new OpenAICompatibleLanguageModel(resolveAssistantLanguageModelConfig());
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
  languageModel = undefined;
  transcriptionService = undefined;
}
