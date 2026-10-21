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
import type { WhatsAppProvider } from "../services/whatsappProvider";
import type { AssistantLanguageModel } from "../services/assistantLanguageModel";
import type { AudioTranscriptionService } from "../services/audioTranscriptionService";
import type { AssistantDomainServices } from "../services/assistantCommandService";
import type { TransientStore } from "../lib/transientStore";
import { getObjectStorage, type ObjectStorage } from "../lib/storage";
import { env } from "../lib/env";
import type { DB } from "../lib/db";

// ── WhatsApp provider webhook (A3.1 + F15.4) ─────────────────────────────
// GET  /api/webhooks/whatsapp → Meta subscription verification handshake.
// POST /api/webhooks/whatsapp → raw-body X-Hub-Signature-256 verification,
// status updates + normalization, then the transport adapter dispatcher.

export function makeWhatsAppWebhookRouter(deps?: {
  db?: DB;
  provider?: WhatsAppProvider;
  store?: TransientStore | null;
  languageModel?: AssistantLanguageModel;
  transcriptionService?: AudioTranscriptionService;
  storage?: ObjectStorage;
  services?: AssistantDomainServices;
}) {
  const router = Router();
  const provider = deps?.provider ?? getWhatsAppProvider();
  const store = deps?.store !== undefined ? deps.store : getRuntimeTransientStore();

  router.get("/", (req, res) => {
    if (!provider.inboundConfigured() || !provider.isValidVerification(
      typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : undefined,
      typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : undefined,
    )) {
      res.status(403).send("Forbidden");
      return;
    }
    res.status(200).send(typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "");
  });

  router.post(
    "/",
    expressRaw({ type: () => true, limit: "1mb" }),
    asyncHandler(async (req, res) => {
      if (!provider.inboundConfigured() || store === null) {
        // Fail closed: unconfigured authenticity or state layer.
        res.status(503).send("Service Unavailable");
        return;
      }
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
      if (!provider.isValidSignature(raw, req.headers["x-hub-signature-256"] as string | undefined)) {
        res.status(401).send("Unauthorized");
        return;
      }

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
            logger.error("whatsapp_status_update_failed", {
              providerMessageId: update.providerMessageId,
              status: update.status,
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      const events = provider.normalizeInbound(payload);
      for (const event of events) {
        // Per-event outcome is logged masked; webhook is always acknowledged
        // so the provider does not retry (duplicate delivery is still safe:
        // the idempotency claim runs before any side effect).
        try {
          const outcome = await dispatchWhatsAppInbound({
            db: deps?.db ?? prisma,
            store,
            provider,
            languageModel: deps?.languageModel ?? getAssistantLanguageModel(),
            transcriptionService: deps?.transcriptionService ?? getAssistantAudioTranscriptionService(),
            // Production wiring: persist customer voice notes when a bucket is configured.
            storage: deps?.storage ?? (env.STORAGE_BUCKET ? getObjectStorage() : undefined),
            services: deps?.services,
          }, event);
          logger.info("whatsapp_inbound", { outcome, sender: `******${event.senderPhone.slice(-4)}` });
        } catch (error) {
          logger.error("whatsapp_inbound_failed", {
            outcome: "error",
            sender: `******${event.senderPhone.slice(-4)}`,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
      res.status(200).send("EVENT_RECEIVED");
    }),
  );

  return router;
}

export default makeWhatsAppWebhookRouter();
