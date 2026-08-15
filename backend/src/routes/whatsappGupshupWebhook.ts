import { Router, raw as expressRaw } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { logger } from "../lib/logger";
import {
  getAssistantLanguageModel,
  getRuntimeTransientStore,
  getWhatsAppProvider,
} from "../lib/assistantRuntime";
import { handleWhatsAppInboundText } from "../services/whatsappTextAdapter";
import { GUPSHUP_PROVIDER_NAME } from "../services/whatsappProvider";
import type { GupshupWhatsAppProvider } from "../services/gupshupProvider";
import type { AssistantLanguageModel } from "../services/assistantLanguageModel";
import type { AssistantDomainServices } from "../services/assistantCommandService";
import type { TransientStore } from "../lib/transientStore";
import type { DB } from "../lib/db";

// ── Gupshup provider webhook (A3.G1) ─────────────────────────────────────
// POST /api/webhooks/whatsapp/gupshup → Gupshup inbound message callback.
// Gupshup Self-Serve provides NO cryptographic signature and no verification
// handshake; the documented authenticity boundary is the inbound IP allowlist
// (GUPSHUP_WEBHOOK_IP_ALLOWLIST), enforced fail-closed here. When no allowlist
// is configured the route returns 503 and nothing is processed. The route is
// mounted BEFORE the JSON parser (raw bytes) and BEFORE the session chain,
// exactly like the Meta webhook — provider authenticity replaces session auth.
// Docs: the callback must be acknowledged with a fast 2xx EMPTY response
// (Gupshup retries non-2xx within ~10s; optimal ack < 100ms).

export function makeGupshupWebhookRouter(deps?: {
  db?: DB;
  provider?: GupshupWhatsAppProvider;
  store?: TransientStore | null;
  languageModel?: AssistantLanguageModel;
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

      const events = provider.normalizeInbound(payload);
      for (const event of events) {
        // Per-event outcome is logged masked; the webhook is always
        // acknowledged so Gupshup does not retry (duplicate delivery stays
        // safe: the idempotency claim runs before any side effect).
        try {
          const outcome = await handleWhatsAppInboundText({
            db: deps?.db ?? prisma,
            store,
            provider,
            languageModel: deps?.languageModel ?? getAssistantLanguageModel(),
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