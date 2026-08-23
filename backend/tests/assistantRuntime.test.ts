import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  resolveAudioTranscriptionConfig,
  resolveAssistantLanguageModelConfig,
  getAssistantAudioTranscriptionService,
  getAssistantLanguageModel,
  _resetAssistantRuntimeForTests,
} from "../src/lib/assistantRuntime";
import { OpenAIAudioTranscriptionService } from "../src/services/audioTranscriptionService";
import { OpenAICompatibleLanguageModel } from "../src/services/assistantLanguageModel";

describe("Assistant Runtime Configuration & Provider Decoupling", () => {
  beforeEach(() => {
    _resetAssistantRuntimeForTests();
  });

  afterEach(() => {
    _resetAssistantRuntimeForTests();
  });

  it("1. uses AUDIO_TRANSCRIPTION_* when configured", () => {
    const config = resolveAudioTranscriptionConfig({
      AUDIO_TRANSCRIPTION_BASE_URL: "https://api.groq.com/openai/v1",
      AUDIO_TRANSCRIPTION_API_KEY: "gsk_test_key_123",
      AUDIO_TRANSCRIPTION_MODEL: "whisper-large-v3-turbo",
      ASSISTANT_LLM_BASE_URL: "https://api.openai.com/v1",
      ASSISTANT_LLM_API_KEY: "sk-openai-llm-key",
      ASSISTANT_TRANSCRIPTION_MODEL: "whisper-1",
    });

    expect(config.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(config.apiKey).toBe("gsk_test_key_123");
    expect(config.model).toBe("whisper-large-v3-turbo");
  });

  it("2. Assistant LLM continues using exclusively ASSISTANT_LLM_*", () => {
    const llmConfig = resolveAssistantLanguageModelConfig({
      ASSISTANT_LLM_BASE_URL: "https://api.openai.com/v1",
      ASSISTANT_LLM_API_KEY: "sk-openai-llm-key",
      ASSISTANT_LLM_MODEL: "gpt-4o-mini",
    });

    expect(llmConfig.baseUrl).toBe("https://api.openai.com/v1");
    expect(llmConfig.apiKey).toBe("sk-openai-llm-key");
    expect(llmConfig.model).toBe("gpt-4o-mini");
  });

  it("3. STT and LLM can use completely different providers concurrently", () => {
    // STT points to Groq Whisper
    const sttConfig = resolveAudioTranscriptionConfig({
      AUDIO_TRANSCRIPTION_BASE_URL: "https://api.groq.com/openai/v1",
      AUDIO_TRANSCRIPTION_API_KEY: "gsk_groq_stt_secret",
      AUDIO_TRANSCRIPTION_MODEL: "whisper-large-v3-turbo",
      ASSISTANT_LLM_BASE_URL: "https://openrouter.ai/api/v1",
      ASSISTANT_LLM_API_KEY: "sk-or-llm-secret",
    });

    // Text LLM points to OpenRouter / Claude / OpenAI
    const llmConfig = resolveAssistantLanguageModelConfig({
      ASSISTANT_LLM_BASE_URL: "https://openrouter.ai/api/v1",
      ASSISTANT_LLM_API_KEY: "sk-or-llm-secret",
      ASSISTANT_LLM_MODEL: "anthropic/claude-3.5-sonnet",
    });

    expect(sttConfig.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(sttConfig.apiKey).toBe("gsk_groq_stt_secret");
    expect(sttConfig.model).toBe("whisper-large-v3-turbo");

    expect(llmConfig.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(llmConfig.apiKey).toBe("sk-or-llm-secret");
    expect(llmConfig.model).toBe("anthropic/claude-3.5-sonnet");

    const sttService = new OpenAIAudioTranscriptionService(sttConfig);
    const llmService = new OpenAICompatibleLanguageModel(llmConfig);

    expect(sttService.getConfig().baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(sttService.getConfig().model).toBe("whisper-large-v3-turbo");
    expect(llmService.getConfig().baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(llmService.getConfig().model).toBe("anthropic/claude-3.5-sonnet");
  });

  it("4. old fallback continues to work when AUDIO_TRANSCRIPTION_* is unset", () => {
    // Case 4a: Falls back to ASSISTANT_LLM_BASE_URL, ASSISTANT_LLM_API_KEY, and ASSISTANT_TRANSCRIPTION_MODEL
    const fallbackWithCustomModel = resolveAudioTranscriptionConfig({
      ASSISTANT_LLM_BASE_URL: "https://api.openai.com/v1",
      ASSISTANT_LLM_API_KEY: "sk-openai-key",
      ASSISTANT_TRANSCRIPTION_MODEL: "whisper-custom-legacy",
    });

    expect(fallbackWithCustomModel.baseUrl).toBe("https://api.openai.com/v1");
    expect(fallbackWithCustomModel.apiKey).toBe("sk-openai-key");
    expect(fallbackWithCustomModel.model).toBe("whisper-custom-legacy");

    // Case 4b: Falls back to default "whisper-1" when neither transcription model var is set
    const fallbackDefault = resolveAudioTranscriptionConfig({
      ASSISTANT_LLM_BASE_URL: "https://api.openai.com/v1",
      ASSISTANT_LLM_API_KEY: "sk-openai-key",
    });

    expect(fallbackDefault.baseUrl).toBe("https://api.openai.com/v1");
    expect(fallbackDefault.apiKey).toBe("sk-openai-key");
    expect(fallbackDefault.model).toBe("whisper-1");
  });

  it("5. independent model configuration works and takes precedence", () => {
    // AUDIO_TRANSCRIPTION_MODEL takes precedence over legacy ASSISTANT_TRANSCRIPTION_MODEL
    const config = resolveAudioTranscriptionConfig({
      AUDIO_TRANSCRIPTION_MODEL: "whisper-large-v3-turbo",
      ASSISTANT_TRANSCRIPTION_MODEL: "whisper-1",
    });

    expect(config.model).toBe("whisper-large-v3-turbo");
  });

  it("6. runtime singletons are initialized correctly and can be reset for tests", () => {
    const service1 = getAssistantAudioTranscriptionService();
    const service2 = getAssistantAudioTranscriptionService();
    expect(service1).toBe(service2);

    const model1 = getAssistantLanguageModel();
    const model2 = getAssistantLanguageModel();
    expect(model1).toBe(model2);

    _resetAssistantRuntimeForTests();
    const service3 = getAssistantAudioTranscriptionService();
    expect(service3).not.toBe(service1);
  });
});
