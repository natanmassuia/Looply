import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { MVP } from "../src/config/mvp";

// Mock dependencies
const mockFindFirst = vi.fn();
const mockSendTemplateMessage = vi.fn();

vi.mock("../src/lib/db", () => ({
  prisma: {
    whatsAppChannel: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("../src/services/whatsappManagementService", () => ({
  listPhoneNumbers: vi.fn().mockResolvedValue([]),
  listMessageTemplates: vi.fn().mockResolvedValue([]),
  sendTemplateMessage: (...args: unknown[]) => mockSendTemplateMessage(...args),
}));

import router from "../src/routes/whatsappManagement";

function buildApp(role = "ADMIN") {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.auth = { userId: "u1", companyId: "c1", role };
    next();
  });
  app.use("/api/whatsapp", router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

describe("POST /api/whatsapp/templates/send (MVP lockTemplateToSelf guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({ sourcePhoneNumber: "+55 (11) 99999-0000" });
    mockSendTemplateMessage.mockResolvedValue({ messages: [{ id: "wamid.123" }] });
  });

  it("rejects sending to a different customer phone number when lockTemplateToSelf is true", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/whatsapp/templates/send")
      .send({
        to: "5511988887777",
        templateName: "hello_world",
        languageCode: "pt_BR",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Até o P0-A, templates só podem ser enviados para o número da própria empresa");
    expect(mockSendTemplateMessage).not.toHaveBeenCalled();
  });

  it("allows sending to the company's own WhatsApp number when lockTemplateToSelf is true", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/whatsapp/templates/send")
      .send({
        to: "5511999990000",
        templateName: "hello_world",
        languageCode: "pt_BR",
      });

    expect(res.status).toBe(200);
    expect(mockSendTemplateMessage).toHaveBeenCalledWith("5511999990000", "hello_world", "pt_BR", undefined);
  });

  it("allows sending to arbitrary customer numbers when lockTemplateToSelf is disabled", async () => {
    const prev = MVP.lockTemplateToSelf;
    (MVP as any).lockTemplateToSelf = false;
    try {
      const app = buildApp();
      const res = await request(app)
        .post("/api/whatsapp/templates/send")
        .send({
          to: "5511988887777",
          templateName: "hello_world",
          languageCode: "pt_BR",
        });

      expect(res.status).toBe(200);
      expect(mockSendTemplateMessage).toHaveBeenCalledWith("5511988887777", "hello_world", "pt_BR", undefined);
    } finally {
      (MVP as any).lockTemplateToSelf = prev;
    }
  });
});
