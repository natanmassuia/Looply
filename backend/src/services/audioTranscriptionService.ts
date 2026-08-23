// Provider-agnostic audio transcription service (A3.2 Audio Transcription V1).
// Translates raw audio buffers (OGG, Opus, MP3, etc.) into text for the
// single existing Assistant command router. No domain rules, no second Assistant.

export interface AudioTranscriptionRequest {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

export interface AudioTranscriptionService {
  transcribe(request: AudioTranscriptionRequest): Promise<{ text: string }>;
}

export interface OpenAITranscriptionConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/ogg",
  "audio/opus",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/webm",
  "audio/amr",
]);

export const MAX_AUDIO_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB max
export const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 15000;

export function isAllowedAudioMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase().trim();
  if (ALLOWED_AUDIO_MIME_TYPES.has(normalized)) return true;
  const base = normalized.split(";")[0].trim();
  return ALLOWED_AUDIO_MIME_TYPES.has(base);
}

function mimeToExtension(mimeType: string): string {
  const base = mimeType.toLowerCase().split(";")[0].trim();
  switch (base) {
    case "audio/ogg":
    case "audio/opus":
      return "ogg";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return "m4a";
    case "audio/wav":
      return "wav";
    case "audio/webm":
      return "webm";
    case "audio/aac":
      return "aac";
    case "audio/amr":
      return "amr";
    default:
      return "ogg";
  }
}

export class OpenAIAudioTranscriptionService implements AudioTranscriptionService {
  constructor(private readonly config: OpenAITranscriptionConfig) {}

  async transcribe(request: AudioTranscriptionRequest): Promise<{ text: string }> {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error("Audio transcription service is not configured");
    }

    const doFetch = this.config.fetchImpl ?? fetch;
    const model = this.config.model || "whisper-1";
    const ext = mimeToExtension(request.mimeType);
    const filename = request.filename || `audio.${ext}`;

    const formData = new FormData();
    const blob = new Blob([request.buffer], { type: request.mimeType });
    formData.append("file", blob, filename);
    formData.append("model", model);
    formData.append("language", "pt");
    formData.append("response_format", "json");

    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
    const response = await doFetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(this.config.timeoutMs ?? DEFAULT_TRANSCRIPTION_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Transcription request failed with status ${response.status}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new Error("Malformed transcription response");
    }

    if (typeof json !== "object" || json === null || typeof (json as { text?: unknown }).text !== "string") {
      throw new Error("Malformed transcription response: text field missing");
    }

    return { text: (json as { text: string }).text.trim() };
  }
}
