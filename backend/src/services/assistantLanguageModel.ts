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
