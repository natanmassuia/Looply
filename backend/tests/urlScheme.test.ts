// A1 (auditoria): schemas de URL vindas do usuário aceitam apenas https absoluto.
import { describe, it, expect } from "vitest";
import { createContentSchema, createVersionSchema, httpsUrl } from "../src/lib/validation";
import { z } from "zod";

const profileAvatar = z.object({
  avatarUrl: httpsUrl(500).nullable().optional(),
});

describe("httpsUrl (A1)", () => {
  it("rejeita esquemas perigosos em mediaUrl de versão", () => {
    const payload = { caption: "legenda", mediaUrl: "javascript:alert(1)" };
    expect(createVersionSchema.safeParse(payload).success).toBe(false);
    expect(
      createVersionSchema.safeParse({ ...payload, mediaUrl: "data:text/html;base64,PHNjcmlwdD4=" }).success
    ).toBe(false);
  });

  it("rejeita esquemas perigosos em mediaUrl de criação e em avatarUrl", () => {
    const base = { title: "t", clientId: "c1", format: "POST" as const, caption: "cap" };
    expect(createContentSchema.safeParse({ ...base, mediaUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(profileAvatar.safeParse({ avatarUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(profileAvatar.safeParse({ avatarUrl: "data:image/svg+xml,<svg/>" }).success).toBe(false);
  });

  it("aceita https legítimo, vazio, null e ausência (regressão)", () => {
    expect(httpsUrl(2000).safeParse("https://picsum.photos/seed/x/900/900").success).toBe(true);
    const ok = createVersionSchema.safeParse({ caption: "l", mediaUrl: "https://exemplo.com/m.jpg" });
    expect(ok.success).toBe(true);
    expect(createVersionSchema.safeParse({ caption: "l", mediaUrl: "" }).success).toBe(true);
    expect(createVersionSchema.safeParse({ caption: "l" }).success).toBe(true);
    expect(profileAvatar.safeParse({ avatarUrl: null }).success).toBe(true);
    expect(profileAvatar.safeParse({}).success).toBe(true);
  });

  it("rejeita http não seguro e lixo que não parseia", () => {
    expect(httpsUrl(2000).safeParse("http://exemplo.com/m.jpg").success).toBe(false);
    expect(httpsUrl(2000).safeParse("não é url").success).toBe(false);
  });
});
