import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeWhatsAppWebhookRouter } from "../src/routes/whatsappWebhook";
import { makeGupshupWebhookRouter } from "../src/routes/whatsappGupshupWebhook";
import { WHATSAPP_IDENTITY_PROVIDER } from "../src/services/whatsappActorService";

describe("Internal Operator WhatsApp Flow Regression (F15.2)", () => {
  const OPERATOR_PHONE = "+5511987654321";
  const UNKNOWN_EXTERNAL_PHONE = "+5511999998888";

  function makeMockDependencies() {
    const outboundSent: Array<{ to: string; text: string }> = [];
    const commandsExecuted: any[] = [];

    const db: any = {
      whatsAppIdentity: {
        findUnique: async ({ where }: any) => {
          if (where.provider_phoneNumber) {
            const { provider, phoneNumber } = where.provider_phoneNumber;
            if (provider === WHATSAPP_IDENTITY_PROVIDER && phoneNumber === OPERATOR_PHONE) {
              return {
                userId: "user_op_1",
                companyId: "comp_1",
                enabled: true,
                user: { id: "user_op_1", active: true },
                company: { id: "comp_1", isActive: true, workspaceTemplate: "MARKETING_AGENCY" },
              };
            }
          }
          return null;
        },
      },
      companyMember: {
        findUnique: async () => ({ isActive: true }),
      },
      company: {
        findUnique: async () => ({ timezone: "America/Sao_Paulo", workspaceTemplate: "MARKETING_AGENCY" }),
      },
      client: {
        findFirst: async () => {
          throw new Error("Client table must never be queried for actor resolution");
        },
      },
    };

    const store: any = {
      setIfAbsent: async () => true,
      get: async () => null,
      set: async () => undefined,
      getAndDelete: async () => null,
      delete: async () => undefined,
    };

    const provider: any = {
      inboundConfigured: () => true,
      outboundConfigured: () => true,
      isValidSignature: () => true,
      isValidVerification: () => true,
      isValidInboundSource: () => true,
      normalizeInbound: (payload: any) => payload.events ?? [],
      sendText: async (to: string, text: string) => {
        outboundSent.push({ to, text });
      },
    };

    const languageModel: any = {
      generateStructuredOutput: async () => ({
        kind: "command",
        operation: "calendar.read",
        payload: { mode: "list" },
      }),
    };

    const services: any = {
      listAppointments: async () => {
        commandsExecuted.push({ type: "listAppointments" });
        return { items: [] };
      },
    };

    return { db, store, provider, languageModel, services, outboundSent, commandsExecuted };
  }

  it("authorized internal operator phone successfully executes assistant commands", async () => {
    const deps = makeMockDependencies();
    const router = makeWhatsAppWebhookRouter(deps);
    const app = express();
    app.use("/webhook", router);

    const res = await request(app)
      .post("/webhook")
      .send({
        events: [
          {
            provider: "whatsapp",
            providerMessageId: "wamid_op_1",
            senderPhone: OPERATOR_PHONE,
            type: "text",
            text: "Quais são os agendamentos de hoje?",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(deps.commandsExecuted.length).toBe(1);
    expect(deps.outboundSent.length).toBe(1);
    expect(deps.outboundSent[0].to).toBe(OPERATOR_PHONE);
  });

  it("unknown external customer phone on internal webhook receives unauthorized and gains NO command access", async () => {
    const deps = makeMockDependencies();
    const router = makeWhatsAppWebhookRouter(deps);
    const app = express();
    app.use("/webhook", router);

    const res = await request(app)
      .post("/webhook")
      .send({
        events: [
          {
            provider: "whatsapp",
            providerMessageId: "wamid_unknown_1",
            senderPhone: UNKNOWN_EXTERNAL_PHONE,
            type: "text",
            text: "Quero listar os agendamentos",
          },
        ],
      });

    expect(res.status).toBe(200); // Webhook returns 200 to acknowledge delivery
    expect(deps.commandsExecuted.length).toBe(0); // Zero commands executed
    expect(deps.outboundSent.length).toBe(1);
    expect(deps.outboundSent[0].to).toBe(UNKNOWN_EXTERNAL_PHONE);
    expect(deps.outboundSent[0].text).toContain("não possui acesso ao Looply");
  });

  it("Gupshup webhook similarly rejects unknown external phone without internal identity", async () => {
    const deps = makeMockDependencies();
    const router = makeGupshupWebhookRouter(deps as any);
    const app = express();
    app.use("/gupshup-webhook", router);

    const res = await request(app)
      .post("/gupshup-webhook")
      .send({
        events: [
          {
            provider: "gupshup",
            providerMessageId: "gs_msg_unknown_1",
            senderPhone: UNKNOWN_EXTERNAL_PHONE,
            type: "text",
            text: "Agendar cliente",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(deps.commandsExecuted.length).toBe(0);
    expect(deps.outboundSent.length).toBe(1);
    expect(deps.outboundSent[0].text).toContain("não possui acesso ao Looply");
  });
});
