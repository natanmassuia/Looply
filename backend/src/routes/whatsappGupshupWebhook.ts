import { Router, raw as expressRaw } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { logger } from "../lib/logger";
import {
  getAssistantAudioTranscriptionService,
  getAssistantLanguageModel,
  getRuntimeTransientStore,
  getWhatsAppProvider,
} from "../lib/assistantRuntime";
import {
  dispatchWhatsAppInbound,
  handleWhatsAppStatusUpdate,
} from "../services/whatsappTextAdapter";
import { GUPSHUP_PROVIDER_NAME } from "../services/whatsappProvider";
import type { GupshupWhatsAppProvider } from "../services/gupshupProvider";
import type { AssistantLanguageModel } from "../services/assistantLanguageModel";
import type { AudioTranscriptionService } from "../services/audioTranscriptionService";
import type { AssistantDomainServices } from "../services/assistantCommandService";
import type { TransientStore } from "../lib/transientStore";
import type { ObjectStorage } from "../lib/storage";
import type { DB } from "../lib/db";

// ── Gupshup provider webhook (A3.G1 + F15.4) ─────────────────────────────
// POST /api/webhooks/whatsapp/gupshup → Gupshup inbound message callback.
// Gupshup Self-Serve provides NO cryptographic signature and no verification
// handshake; the documented authenticity boundary is the inbound IP allowlist
// (GUPSHUP_WEBHOOK_IP_ALLOWLIST), enforced fail-closed here. When no allowlist
// is configured the route returns 503 and nothing is processed.

export function makeGupshupWebhookRouter(deps?: {
  db?: DB;
  provider?: GupshupWhatsAppProvider;
  store?: TransientStore | null;
  languageModel?: AssistantLanguageModel;
  transcriptionService?: AudioTranscriptionService;
  storage?: ObjectStorage;
  services?: AssistantDomainServices;
}) {
  const router = Router();
  // getWhatsAppProvider("gupshup") resolves the Gupshup singleton (safe cast).
  const provider = deps?.provider ?? (getWhatsAppProvider(GUPSHUP_PROVIDER_NAME) as GupshupWhatsAppProvider);
  const store = deps?.store !== undefined ? deps.store : getRuntimeTransientStore();

  router.post(
    "/",
    expressRaw({ type: () => true, limit: "1mb" }),
    asyncHandler(async (req, res) => {
      if (!provider.inboundConfigured() || store === null) {
        // Fail closed: unconfigured authenticity boundary or state layer.
        res.status(503).send("Service Unavailable");
        return;
      }
      if (!provider.isValidInboundSource(req.ip)) {
        res.status(401).send("Unauthorized");
        return;
      }

      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
      let payload: unknown;
      try {
        payload = JSON.parse(raw.toString("utf8"));
      } catch {
        res.status(400).send("Bad Request");
        return;
      }

      // Process status updates first if present
      if (provider.normalizeStatusUpdates) {
        const statusUpdates = provider.normalizeStatusUpdates(payload);
        for (const update of statusUpdates) {
          try {
            await handleWhatsAppStatusUpdate(deps?.db ?? prisma, update);
          } catch (error) {
            logger.error("gupshup_status_update_failed", {
              providerMessageId: update.providerMessageId,
              status: update.status,
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      const events = provider.normalizeInbound(payload);
      for (const event of events) {
        // Per-event outcome is logged masked; the webhook is always
        // acknowledged so Gupshup does not retry (duplicate delivery stays
        // safe: the idempotency claim runs before any side effect).
        try {
          const outcome = await dispatchWhatsAppInbound({
            db: deps?.db ?? prisma,
            store,
            provider,
            languageModel: deps?.languageModel ?? getAssistantLanguageModel(),
            transcriptionService: deps?.transcriptionService ?? getAssistantAudioTranscriptionService(),
            storage: deps?.storage,
            services: deps?.services,
          }, event);
          logger.info("gupshup_inbound", { outcome, sender: `******${event.senderPhone.slice(-4)}` });
        } catch (error) {
          logger.error("gupshup_inbound_failed", {
            outcome: "error",
            sender: `******${event.senderPhone.slice(-4)}`,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
      res.status(200).send();
    }),
  );

  return router;
}

export default makeGupshupWebhookRouter();