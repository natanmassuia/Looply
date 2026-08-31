import { describe, it, expect, afterEach } from "vitest";
import { demoGuard, isDemoMode } from "../src/middleware/demoGuard";
import { getWhatsAppProvider } from "../src/lib/assistantRuntime";
import { MockWhatsAppProvider } from "../src/services/whatsappProvider";

describe("Looply Demo Guard & Mock Provider Suite", () => {
  const originalDemoMode = process.env.DEMO_MODE;
  const originalMockProvider = process.env.MOCK_PROVIDER;

  afterEach(() => {
    process.env.DEMO_MODE = originalDemoMode;
    process.env.MOCK_PROVIDER = originalMockProvider;
  });

  describe("demoGuard Middleware", () => {
    it("blocks destructive mutations with 403 when DEMO_MODE=true", () => {
      process.env.DEMO_MODE = "true";
      expect(isDemoMode()).toBe(true);

      let statusCode = 0;
      let responseBody: any = null;
      let nextCalled = false;

      const req: any = {};
      const res: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(body: any) {
          responseBody = body;
          return this;
        },
      };
      const next = () => {
        nextCalled = true;
      };

      demoGuard(req, res, next);

      expect(statusCode).toBe(403);
      expect(responseBody).toEqual({
        error: "Ação desativada no modo demonstração",
        code: "DEMO_MODE_BLOCKED",
      });
      expect(nextCalled).toBe(false);
    });

    it("allows operations to continue when DEMO_MODE is not true", () => {
      process.env.DEMO_MODE = "false";
      expect(isDemoMode()).toBe(false);

      let nextCalled = false;
      const req: any = {};
      const res: any = {};
      const next = () => {
        nextCalled = true;
      };

      demoGuard(req, res, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe("MockWhatsAppProvider & assistantRuntime", () => {
    it("returns MockWhatsAppProvider when MOCK_PROVIDER=true", () => {
      process.env.MOCK_PROVIDER = "true";
      process.env.DEMO_MODE = "false";

      const provider = getWhatsAppProvider("whatsapp");
      expect(provider).toBeInstanceOf(MockWhatsAppProvider);
    });

    it("returns MockWhatsAppProvider when DEMO_MODE=true", () => {
      process.env.MOCK_PROVIDER = "false";
      process.env.DEMO_MODE = "true";

      const provider = getWhatsAppProvider("whatsapp");
      expect(provider).toBeInstanceOf(MockWhatsAppProvider);
    });

    it("MockWhatsAppProvider sendText resolves safely without network calls", async () => {
      const mock = new MockWhatsAppProvider();
      const res = await mock.sendText("+5511999999999", "Mensagem de teste demo");
      expect(res).toBeDefined();
      expect(res?.providerMessageId).toMatch(/^mock_/);
      expect(res?.provider).toBe("whatsapp");
    });
  });
});
