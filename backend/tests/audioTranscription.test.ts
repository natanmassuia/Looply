import { describe, expect, it } from "vitest";
import type { AssistantDomainServices } from "../src/services/assistantCommandService";
import type { AssistantLanguageModel, AssistantLanguageModelRequest } from "../src/services/assistantLanguageModel";
import type { TransientStore } from "../src/lib/transientStore";
import { MetaWhatsAppProvider, WHATSAPP_PROVIDER_NAME, type WhatsAppInboundEvent, type WhatsAppMediaPayload } from "../src/services/whatsappProvider";
import { handleWhatsAppInboundText } from "../src/services/whatsappTextAdapter";
import {
  OpenAIAudioTranscriptionService,
  isAllowedAudioMime,
  MAX_AUDIO_SIZE_BYTES,
  type AudioTranscriptionService,
  type AudioTranscriptionRequest,
} from "../src/services/audioTranscriptionService";
import { confirmationPrompt, WHATSAPP_COPY } from "../src/services/whatsappReplyFormatter";

// ── Fakes ────────────────────────────────────────────────────────────────

class FakeStore implements TransientStore {
  data = new Map<string, { value: string; expiresAt: number }>();
  unavailable = false;
  private guard() { if (this.unavailable) throw new Error("store unavailable"); }
  async get(key: string) {
    this.guard();
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) { this.data.delete(key); return null; }
    return e.value;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.guard();
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    this.guard();
    if (await this.get(key) !== null) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }
  async getAndDelete(key: string) {
    this.guard();
    const e = this.data.get(key);
    this.data.delete(key);
    if (!e || e.expiresAt <= Date.now()) return null;
    return e.value;
  }
  async delete(key: string) { this.guard(); this.data.delete(key); }
}

class FakeLanguageModel implements AssistantLanguageModel {
  public requests: AssistantLanguageModelRequest[] = [];
  private queue: unknown[];
  constructor(output: unknown | unknown[]) {
    this.queue = Array.isArray(output) ? [...output] : [output];
  }
  async generateStructuredOutput(req: AssistantLanguageModelRequest) {
    this.requests.push(req);
    const next = this.queue.length > 1 ? this.queue.shift() : this.queue[0];
    return next;
  }
}

class FakeWhatsAppProvider extends MetaWhatsAppProvider {
  public sent: Array<{ to: string; text: string }> = [];
  public mediaToReturn: { buffer: Buffer; contentType: string } = {
    buffer: Buffer.from("fake-audio-bytes"),
    contentType: "audio/ogg",
  };
  public failDownload = false;
  public downloadCalls = 0;

  constructor() {
    super({
      verifyToken: "verify-token",
      appSecret: "app-secret",
      accessToken: "token",
      phoneNumberId: "phone-id",
      fetchImpl: (async () => ({ ok: true })) as never,
    });
  }

  override async sendText(to: string, text: string) {
    this.sent.push({ to, text });
  }

  override async downloadMedia(_media: WhatsAppMediaPayload) {
    this.downloadCalls++;
    if (this.failDownload) throw new Error("media download failed");
    return this.mediaToReturn;
  }
}

class FakeTranscriptionService implements AudioTranscriptionService {
  public requests: AudioTranscriptionRequest[] = [];
  public textToReturn = "cria um compromisso amanhã às 15h";
  public failTranscription = false;

  async transcribe(request: AudioTranscriptionRequest): Promise<{ text: string }> {
    this.requests.push(request);
    if (this.failTranscription) throw new Error("transcription api error");
    return { text: this.textToReturn };
  }
}

function makeDb(seed: { identity?: boolean; membershipActive?: boolean } = {}) {
  return {
    whatsAppIdentity: {
      findUnique: async () => (seed.identity !== false)
        ? { userId: "u1", companyId: "c1", enabled: true, user: { id: "u1", active: true }, company: { id: "c1", isActive: true, workspaceTemplate: "MARKETING_AGENCY" } }
        : null,
    },
    companyMember: {
      findUnique: async () => ({ isActive: seed.membershipActive !== false }),
    },
    company: {
      findUnique: async () => ({ timezone: "America/Sao_Paulo" }),
    },
  } as never;
}

function makeServices(calls: string[]): AssistantDomainServices {
  const fn = (name: string, result: unknown) => async () => {
    calls.push(name);
    return result;
  };
  return {
    createAppointment: fn("createAppointment", { id: "a1", title: "Reunião", startsAt: "2026-09-02T14:00:00.000Z" }),
    listAppointments: fn("listAppointments", { appointments: [] }),
    getAppointment: fn("getAppointment", { id: "a1", title: "Reunião" }),
    updateAppointment: fn("updateAppointment", { id: "a1" }),
    cancelAppointment: fn("cancelAppointment", { id: "a1" }),
    getCalendar: fn("getCalendar", { events: [] }),
    createJob: fn("createJob", { id: "j1", title: "Chamado" }),
    listJobs: fn("listJobs", { jobs: [{ title: "Demanda 1" }] }),
    getJob: fn("getJob", { id: "j1", title: "Chamado" }),
    updateJob: fn("updateJob", { id: "j1" }),
    transitionJobLifecycle: fn("transitionJobLifecycle", { id: "j1", lifecycleStatus: "CANCELLED" }),
  } as unknown as AssistantDomainServices;
}

const PHONE = "+5511987654321";

function audioEvent(overrides: Partial<WhatsAppInboundEvent> = {}): WhatsAppInboundEvent {
  return {
    provider: WHATSAPP_PROVIDER_NAME,
    providerMessageId: "wamid.audio.1",
    senderPhone: PHONE,
    type: "audio",
    media: {
      id: "media-123",
      mimeType: "audio/ogg",
    },
    ...overrides,
  };
}

function makeAudioDeps(modelOutput: unknown, opts: { identity?: boolean; membershipActive?: boolean } = {}) {
  const calls: string[] = [];
  const store = new FakeStore();
  const provider = new FakeWhatsAppProvider();
  const model = new FakeLanguageModel(modelOutput);
  const transcriptionService = new FakeTranscriptionService();
  const deps = {
    db: makeDb(opts),
    store,
    provider,
    languageModel: model,
    transcriptionService,
    services: makeServices(calls),
  };
  return { deps, calls, store, provider, model, transcriptionService };
}

describe("Audio Transcription Service (Unit & MIME validation)", () => {
  it("allows standard voice note and audio MIME types", () => {
    expect(isAllowedAudioMime("audio/ogg")).toBe(true);
    expect(isAllowedAudioMime("audio/ogg; codecs=opus")).toBe(true);
    expect(isAllowedAudioMime("audio/opus")).toBe(true);
    expect(isAllowedAudioMime("audio/mpeg")).toBe(true);
    expect(isAllowedAudioMime("audio/mp3")).toBe(true);
    expect(isAllowedAudioMime("audio/mp4")).toBe(true);
    expect(isAllowedAudioMime("audio/m4a")).toBe(true);
    expect(isAllowedAudioMime("audio/x-m4a")).toBe(true);
    expect(isAllowedAudioMime("audio/wav")).toBe(true);
    expect(isAllowedAudioMime("audio/webm")).toBe(true);
    expect(isAllowedAudioMime("audio/amr")).toBe(true);
  });

  it("rejects non-audio or unsupported MIME types", () => {
    expect(isAllowedAudioMime("application/pdf")).toBe(false);
    expect(isAllowedAudioMime("image/png")).toBe(false);
    expect(isAllowedAudioMime("text/plain")).toBe(false);
    expect(isAllowedAudioMime(undefined)).toBe(false);
    expect(isAllowedAudioMime("")).toBe(false);
  });

  it("OpenAIAudioTranscriptionService builds FormData and parses response", async () => {
    let capturedBody: FormData | undefined;
    let capturedHeaders: Record<string, string> | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      capturedHeaders = init?.headers as Record<string, string>;
      capturedBody = init?.body as FormData;
      return new Response(JSON.stringify({ text: "  Áudio transcrito com sucesso  " }), { status: 200 });
    };

    const service = new OpenAIAudioTranscriptionService({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      fetchImpl,
    });

    const result = await service.transcribe({
      buffer: Buffer.from("audio-bytes"),
      mimeType: "audio/ogg",
    });

    expect(result.text).toBe("Áudio transcrito com sucesso");
    expect(capturedHeaders?.authorization).toBe("Bearer test-key");
    expect(capturedBody).toBeInstanceOf(FormData);
  });

  it("OpenAIAudioTranscriptionService handles HTTP errors, timeouts, and malformed responses", async () => {
    const errorService = new OpenAIAudioTranscriptionService({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      fetchImpl: async () => new Response("Internal error", { status: 500 }),
    });
    await expect(errorService.transcribe({ buffer: Buffer.from("a"), mimeType: "audio/ogg" })).rejects.toThrow("500");

    const malformedService = new OpenAIAudioTranscriptionService({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      fetchImpl: async () => new Response("not-json", { status: 200 }),
    });
    await expect(malformedService.transcribe({ buffer: Buffer.from("a"), mimeType: "audio/ogg" })).rejects.toThrow("Malformed");

    const missingTextField = new OpenAIAudioTranscriptionService({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "test-key",
      fetchImpl: async () => new Response(JSON.stringify({ not_text: 123 }), { status: 200 }),
    });
    await expect(missingTextField.transcribe({ buffer: Buffer.from("a"), mimeType: "audio/ogg" })).rejects.toThrow("missing");
  });
});

describe("Audio Inbound WhatsApp Pipeline", () => {
  it("routes valid voice note through download, transcription, and assistant router", async () => {
    const { deps, calls, provider, transcriptionService } = makeAudioDeps({
      kind: "command",
      operation: "calendar.create",
      payload: { title: "Reunião Presencial", startsAt: "2026-09-02T15:00:00.000Z" },
    });

    transcriptionService.textToReturn = "marcar reunião amanhã às 15 horas";
    const outcome = await handleWhatsAppInboundText(deps, audioEvent());

    expect(outcome).toBe("processed");
    expect(provider.downloadCalls).toBe(1);
    expect(transcriptionService.requests).toHaveLength(1);
    expect(calls).toEqual(["createAppointment"]);
    expect(provider.sent.at(-1)?.text).toBe("Compromisso criado com sucesso.");
  });

  it("rejects unsupported MIME upfront in webhook metadata without downloading", async () => {
    const { deps, provider, transcriptionService, calls } = makeAudioDeps({});
    const event = audioEvent({ media: { id: "m1", mimeType: "audio/unsupported-codec" } });

    const outcome = await handleWhatsAppInboundText(deps, event);
    expect(outcome).toBe("unsupported_media");
    expect(provider.downloadCalls).toBe(0);
    expect(transcriptionService.requests).toHaveLength(0);
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(WHATSAPP_COPY.unsupportedAudioMime);
  });

  it("rejects unsupported MIME returned from download stream", async () => {
    const { deps, provider, transcriptionService, calls } = makeAudioDeps({});
    provider.mediaToReturn = { buffer: Buffer.from("audio"), contentType: "video/mp4" };
    const event = audioEvent({ media: { id: "m1" } }); // mimeType absent in metadata

    const outcome = await handleWhatsAppInboundText(deps, event);
    expect(outcome).toBe("unsupported_media");
    expect(provider.downloadCalls).toBe(1);
    expect(transcriptionService.requests).toHaveLength(0);
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(WHATSAPP_COPY.unsupportedAudioMime);
  });

  it("rejects audio exceeding the 16MB size limit", async () => {
    const { deps, provider, transcriptionService, calls } = makeAudioDeps({});
    // Buffer larger than MAX_AUDIO_SIZE_BYTES
    provider.mediaToReturn = {
      buffer: Buffer.alloc(MAX_AUDIO_SIZE_BYTES + 1024),
      contentType: "audio/ogg",
    };

    const outcome = await handleWhatsAppInboundText(deps, audioEvent());
    expect(outcome).toBe("malformed");
    expect(transcriptionService.requests).toHaveLength(0);
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(WHATSAPP_COPY.audioTooLarge);
  });

  it("handles provider download failure gracefully with transient failure reply", async () => {
    const { deps, provider, transcriptionService, calls } = makeAudioDeps({});
    provider.failDownload = true;

    const outcome = await handleWhatsAppInboundText(deps, audioEvent());
    expect(outcome).toBe("transient_failure");
    expect(transcriptionService.requests).toHaveLength(0);
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(WHATSAPP_COPY.audioDownloadFailure);
  });

  it("handles transcription API failure gracefully with transient failure reply", async () => {
    const { deps, provider, transcriptionService, calls } = makeAudioDeps({});
    transcriptionService.failTranscription = true;

    const outcome = await handleWhatsAppInboundText(deps, audioEvent());
    expect(outcome).toBe("transient_failure");
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(WHATSAPP_COPY.transcriptionFailure);
  });

  it("handles empty transcription with a polite prompt to user", async () => {
    const { deps, provider, transcriptionService, calls } = makeAudioDeps({});
    transcriptionService.textToReturn = "   ";

    const outcome = await handleWhatsAppInboundText(deps, audioEvent());
    expect(outcome).toBe("processed");
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(WHATSAPP_COPY.emptyAudio);
  });

  it("reutilizes the exact confirmation flow when audio commands request mutation", async () => {
    const deleteOutput = { kind: "command", operation: "ticket.delete", payload: { jobId: "j1" } };
    const { deps, calls, provider, transcriptionService } = makeAudioDeps(deleteOutput);

    transcriptionService.textToReturn = "cancela o chamado número 123";
    const outcome1 = await handleWhatsAppInboundText(deps, audioEvent({ providerMessageId: "wamid.audio.del" }));
    expect(outcome1).toBe("processed");
    expect(calls).toEqual([]);
    expect(provider.sent.at(-1)?.text).toBe(confirmationPrompt("ticket.delete"));

    // User responds SIM (either via text or audio) -> consumes confirmation and executes
    const outcome2 = await handleWhatsAppInboundText(deps, {
      provider: WHATSAPP_PROVIDER_NAME,
      providerMessageId: "wamid.text.sim",
      senderPhone: PHONE,
      type: "text",
      text: "SIM",
    });
    expect(outcome2).toBe("processed");
    expect(calls).toEqual(["transitionJobLifecycle"]);
    expect(provider.sent.at(-1)?.text).toBe("Chamado cancelado.");
  });

  it("deduplicates repeated audio events via idempotency store", async () => {
    const { deps, provider, transcriptionService } = makeAudioDeps({
      kind: "command",
      operation: "ticket.read",
      payload: { mode: "list" },
    });

    const event = audioEvent({ providerMessageId: "wamid.audio.dedup" });
    const first = await handleWhatsAppInboundText(deps, event);
    expect(first).toBe("processed");
    expect(provider.downloadCalls).toBe(1);
    expect(transcriptionService.requests).toHaveLength(1);

    // Repeated event with same providerMessageId
    const second = await handleWhatsAppInboundText(deps, event);
    expect(second).toBe("duplicate");
    expect(provider.downloadCalls).toBe(1); // No second download
    expect(transcriptionService.requests).toHaveLength(1); // No second transcription
  });

  it("text events continue to work seamlessly without downloading media", async () => {
    const { deps, calls, provider, transcriptionService } = makeAudioDeps({
      kind: "command",
      operation: "ticket.read",
      payload: { mode: "list" },
    });

    const textEvt: WhatsAppInboundEvent = {
      provider: WHATSAPP_PROVIDER_NAME,
      providerMessageId: "wamid.text.1",
      senderPhone: PHONE,
      type: "text",
      text: "quais chamados em aberto?",
    };

    const outcome = await handleWhatsAppInboundText(deps, textEvt);
    expect(outcome).toBe("processed");
    expect(provider.downloadCalls).toBe(0);
    expect(transcriptionService.requests).toHaveLength(0);
    expect(calls).toEqual(["listJobs"]);
  });
});
