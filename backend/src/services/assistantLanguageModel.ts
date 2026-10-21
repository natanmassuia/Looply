import { z } from "zod";

export interface AssistantLanguageModelRequest {
  systemPrompt: string;
  message: string;
  currentTimestamp: string;
  timezone: string;
}

export interface AssistantLanguageModel {
  generateStructuredOutput(request: AssistantLanguageModelRequest): Promise<unknown>;
}

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
  })).min(1),
});

export interface OpenAICompatibleConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class OpenAICompatibleLanguageModel implements AssistantLanguageModel {
  constructor(private readonly config: OpenAICompatibleConfig) {}

  getConfig(): Readonly<OpenAICompatibleConfig> {
    return { ...this.config };
  }

  async generateStructuredOutput(request: AssistantLanguageModelRequest): Promise<unknown> {
    if (!this.config.baseUrl || !this.config.apiKey || !this.config.model) {
      throw new Error("Assistant language model is not configured");
    }

    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: `Current timestamp: ${request.currentTimestamp}\nCompany timezone: ${request.timezone}\nUser message: ${request.message}` },
        ],
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 10000),
    });
    if (!response.ok) throw new Error("Assistant language model request failed");

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Assistant language model response was malformed");
    try {
      return JSON.parse(parsed.data.choices[0].message.content) as unknown;
    } catch {
      throw new Error("Assistant language model output was not JSON");
    }
  }
}

// Ordered multi-provider wrapper: tries each model in turn and returns the
// first success. On any failure (network, timeout, HTTP error, malformed /
// non-JSON output) it falls through to the next provider; if every provider
// fails it rethrows the last error, so the caller's existing error handling
// (ASSISTANT_LANGUAGE_MODEL_ERROR) still applies. This is for AVAILABILITY —
// put the best provider first; cheaper/free fallbacks only serve when the
// primary is down or rate-limited. Implements the same interface, so no caller
// changes are needed.
export class FallbackLanguageModel implements AssistantLanguageModel {
  constructor(private readonly models: AssistantLanguageModel[]) {
    if (models.length === 0) {
      throw new Error("FallbackLanguageModel requires at least one provider");
    }
  }

  async generateStructuredOutput(request: AssistantLanguageModelRequest): Promise<unknown> {
    let lastError: unknown;
    for (const model of this.models) {
      try {
        return await model.generateStructuredOutput(request);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("All assistant language model providers failed");
  }
}
