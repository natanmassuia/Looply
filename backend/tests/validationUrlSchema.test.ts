import { describe, it, expect } from "vitest";
import { createVersionSchema, createContentSchema, createClientSchema } from "../src/lib/validation";

describe("A1: URL Scheme Restriction Validation", () => {
  describe("createVersionSchema", () => {
    it("accepts valid https URL", () => {
      const result = createVersionSchema.safeParse({
        caption: "Versão 1 com mídia segura",
        mediaUrl: "https://cdn.looply.example/posts/1.jpg",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mediaUrl).toBe("https://cdn.looply.example/posts/1.jpg");
      }
    });

    it("accepts empty string or undefined mediaUrl", () => {
      const emptyResult = createVersionSchema.safeParse({
        caption: "Versão sem mídia",
        mediaUrl: "",
      });
      expect(emptyResult.success).toBe(true);

      const undefinedResult = createVersionSchema.safeParse({
        caption: "Versão sem mídia undefined",
      });
      expect(undefinedResult.success).toBe(true);
    });

    it("rejects javascript: scheme in mediaUrl", () => {
      const result = createVersionSchema.safeParse({
        caption: "Payload malicioso",
        mediaUrl: "javascript:alert(1)",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toMatch(/https/i);
      }
    });

    it("rejects data: scheme in mediaUrl", () => {
      const result = createVersionSchema.safeParse({
        caption: "Payload data uri",
        mediaUrl: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toMatch(/https/i);
      }
    });

    it("rejects plain http: scheme in mediaUrl", () => {
      const result = createVersionSchema.safeParse({
        caption: "Insecure http",
        mediaUrl: "http://insecure.example.com/media.jpg",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toMatch(/https/i);
      }
    });
  });

  describe("createContentSchema", () => {
    it("rejects javascript: scheme in mediaUrl", () => {
      const result = createContentSchema.safeParse({
        title: "Novo Post",
        clientId: "client-123",
        format: "POST",
        caption: "Legenda",
        mediaUrl: "javascript:alert(1)",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createClientSchema", () => {
    it("accepts valid https logoUrl", () => {
      const result = createClientSchema.safeParse({
        name: "Cliente Teste",
        logoUrl: "https://cdn.example.com/logos/client.png",
      });
      expect(result.success).toBe(true);
    });

    it("rejects javascript: scheme in logoUrl", () => {
      const result = createClientSchema.safeParse({
        name: "Cliente Teste",
        logoUrl: "javascript:alert(1)",
      });
      expect(result.success).toBe(false);
    });
  });
});
