import { describe, expect, it } from "vitest";
import {
  FallbackLanguageModel,
  type AssistantLanguageModel,
  type AssistantLanguageModelRequest,
} from "../src/services/assistantLanguageModel";
import {
  resolveAssistantLanguageModelConfigs,
  buildAssistantLanguageModel,
} from "../src/lib/assistantRuntime";

const req: AssistantLanguageModelRequest = {
  systemPrompt: "s",
  message: "m",
  currentTimestamp: "2026-01-01T00:00:00.000Z",
  timezone: "America/Sao_Paulo",
};

function fakeModel(result: unknown, opts: { throws?: boolean } = {}) {
  const model = {
    calls: 0,
    async generateStructuredOutput(): Promise<unknown> {
      model.calls += 1;
      if (opts.throws) throw new Error("provider down");
      return result;
    },
  };
  return model as AssistantLanguageModel & { calls: number };
}

describe("FallbackLanguageModel", () => {
  it("returns the first provider's result without calling the rest", async () => {
    const a = fakeModel({ ok: 1 });
    const b = fakeModel({ ok: 2 });
    const model = new FallbackLanguageModel([a, b]);
    expect(await model.generateStructuredOutput(req)).toEqual({ ok: 1 });
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(0);
  });

  it("falls through to the next provider when one fails", async () => {
    const a = fakeModel(null, { throws: true });
    const b = fakeModel({ ok: "second" });
    const model = new FallbackLanguageModel([a, b]);
    expect(await model.generateStructuredOutput(req)).toEqual({ ok: "second" });
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it("rethrows the last error when every provider fails", async () => {
    const model = new FallbackLanguageModel([
      fakeModel(null, { throws: true }),
      fakeModel(null, { throws: true }),
    ]);
    await expect(model.generateStructuredOutput(req)).rejects.toThrow("provider down");
  });

  it("requires at least one provider", () => {
    expect(() => new FallbackLanguageModel([])).toThrow();
  });
});

describe("resolveAssistantLanguageModelConfigs", () => {
  const primary = {
    ASSISTANT_LLM_BASE_URL: "https://api.groq.com/openai/v1",
    ASSISTANT_LLM_API_KEY: "gsk-primary",
    ASSISTANT_LLM_MODEL: "llama-3.3-70b-versatile",
  };

  it("returns only the primary when no fallbacks are set", () => {
    const configs = resolveAssistantLanguageModelConfigs(primary);
    expect(configs).toHaveLength(1);
    expect(configs[0].apiKey).toBe("gsk-primary");
  });

  it("parses ASSISTANT_LLM_FALLBACKS as an ordered provider list", () => {
    const configs = resolveAssistantLanguageModelConfigs({
      ...primary,
      ASSISTANT_LLM_FALLBACKS: JSON.stringify([
        { baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-deepseek", model: "deepseek-chat" },
        { baseUrl: "https://g/v1", apiKey: "k", model: "gemini-2.0-flash" },
      ]),
    });
    expect(configs).toHaveLength(3);
    expect(configs[1].model).toBe("deepseek-chat");
    expect(configs[2].apiKey).toBe("k");
  });

  it("drops incomplete fallback entries and ignores malformed JSON", () => {
    const withIncomplete = resolveAssistantLanguageModelConfigs({
      ...primary,
      ASSISTANT_LLM_FALLBACKS: JSON.stringify([{ baseUrl: "only-base-url" }]),
    });
    expect(withIncomplete).toHaveLength(1);

    const withBadJson = resolveAssistantLanguageModelConfigs({
      ...primary,
      ASSISTANT_LLM_FALLBACKS: "{not json",
    });
    expect(withBadJson).toHaveLength(1);
  });
});

describe("buildAssistantLanguageModel", () => {
  it("wraps multiple providers in a FallbackLanguageModel", () => {
    const model = buildAssistantLanguageModel([
      { baseUrl: "b1", apiKey: "a1", model: "m1" },
      { baseUrl: "b2", apiKey: "a2", model: "m2" },
    ]);
    expect(model).toBeInstanceOf(FallbackLanguageModel);
  });

  it("returns a single (unwrapped) model when only one provider is configured", () => {
    const model = buildAssistantLanguageModel([{ baseUrl: "b1", apiKey: "a1", model: "m1" }]);
    expect(model).not.toBeInstanceOf(FallbackLanguageModel);
  });
});
