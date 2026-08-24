import { describe, expect, it, vi, afterEach } from "vitest";
import { OpenAICompatibleLanguageModel } from "../src/services/assistantLanguageModel";

describe("OpenAICompatibleLanguageModel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validConfig = {
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: "gsk-test-key",
    model: "openai/gpt-oss-120b",
  };

  const sampleRequest = {
    systemPrompt: "You are a helpful assistant.",
    message: "Responda somente com: LOOPLY_LLM_OK",
    currentTimestamp: "2026-08-24T18:00:00.000Z",
    timezone: "America/Sao_Paulo",
  };

  it("successfully parses valid OpenAI-compatible chat completion response with metadata", async () => {
    const validProviderResponse = {
      id: "chatcmpl-test-id",
      object: "chat.completion",
      created: 1724522400,
      model: "openai/gpt-oss-120b",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ status: "LOOPLY_LLM_OK" }),
            reasoning: null,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 8,
        total_tokens: 23,
      },
      system_fingerprint: "fp_test",
      x_groq: { id: "req_123" },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(validProviderResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const model = new OpenAICompatibleLanguageModel(validConfig);
    const result = await model.generateStructuredOutput(sampleRequest);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer gsk-test-key",
        },
      }),
    );

    expect(result).toEqual({ status: "LOOPLY_LLM_OK" });
  });

  it("throws descriptive error when response is missing required choices structure", async () => {
    const malformedResponses = [
      {},
      { choices: [] },
      { choices: [{}] },
      { choices: [{ message: {} }] },
      { choices: [{ message: { content: 123 } }] },
      { choices: "not-an-array" },
      null,
    ];

    for (const body of malformedResponses) {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const model = new OpenAICompatibleLanguageModel(validConfig);
      await expect(model.generateStructuredOutput(sampleRequest)).rejects.toThrow(
        "Assistant language model response was malformed",
      );
    }
  });

  it("throws descriptive error when response content is not valid JSON", async () => {
    const responseWithNonJsonContent = {
      choices: [
        {
          message: {
            content: "Plain text string without json",
          },
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(responseWithNonJsonContent), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const model = new OpenAICompatibleLanguageModel(validConfig);
    await expect(model.generateStructuredOutput(sampleRequest)).rejects.toThrow(
      "Assistant language model output was not JSON",
    );
  });

  it("throws error when HTTP status is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate limit exceeded" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );

    const model = new OpenAICompatibleLanguageModel(validConfig);
    await expect(model.generateStructuredOutput(sampleRequest)).rejects.toThrow(
      "Assistant language model request failed",
    );
  });

  it("throws error when unconfigured", async () => {
    const model = new OpenAICompatibleLanguageModel({});
    await expect(model.generateStructuredOutput(sampleRequest)).rejects.toThrow(
      "Assistant language model is not configured",
    );
  });
});
