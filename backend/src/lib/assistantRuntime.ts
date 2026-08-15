import { env } from "./env";
import { transientStoreFromEnv, type TransientStore } from "./transientStore";
import { MetaWhatsAppProvider, type WhatsAppProvider } from "../services/whatsappProvider";
import { OpenAICompatibleLanguageModel } from "../services/assistantLanguageModel";
import type { AssistantLanguageModel } from "../services/assistantLanguageModel";

// ── Application-lifecycle singletons for the WhatsApp Assistant (A3.1) ───
// Built lazily from env, once per process. No per-request clients, no
// process-memory state fallback, and env URLs/tokens are never logged.

let transientStore: TransientStore | null | undefined;
let whatsappProvider: WhatsAppProvider | undefined;
let languageModel: AssistantLanguageModel | undefined;

// null means "state layer unavailable" → callers must fail closed.
export function getRuntimeTransientStore(): TransientStore | null {
  if (transientStore === undefined) {
    transientStore = transientStoreFromEnv(env.REDIS_URL);
  }
  return transientStore;
}

export function getWhatsAppProvider(): WhatsAppProvider {
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
