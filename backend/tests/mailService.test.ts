import { describe, it, expect, vi, afterEach } from "vitest";
import { ResendMailService } from "../src/services/mailService";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithCapturedHtml(name: string, token: string): Promise<string> {
  // Set the env before constructing so the service picks up the key and is
  // not in test-simulation mode; restore afterwards.
  const prevKey = process.env.RESEND_API_KEY;
  const prevNode = process.env.NODE_ENV;
  (process.env as any).RESEND_API_KEY = "test-key";
  (process.env as any).NODE_ENV = "production";

  let capturedHtml = "";
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String((init as any)?.body ?? "{}"));
    capturedHtml = body.html as string;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "resend-test-id" }),
    } as any;
  });

  const svc = new ResendMailService();
  return svc
    .sendPasswordResetEmail({ to: "dest@test.com", name, token })
    .then(() => {
      if (prevKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prevKey;
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
      return capturedHtml;
    });
}

describe("ResendMailService password-reset email template", () => {
  it("renders recipient name, reset URL, CTA, 1-hour validity, and security notice", async () => {
    const name = "Ana Teste";
    const token = "abc123";
    // Mirror the service's own app-URL resolution (mailService.ts) instead of
    // a hardcoded fallback — the configured origin may differ per environment.
    const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || process.env.PUBLIC_APP_URL || "https://looply.verbumlab.com.br").replace(/\/$/, "");
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const html = await renderWithCapturedHtml(name, token);

    // Recipient name rendered
    expect(html).toContain(name);
    // Reset URL rendered (CTA + fallback)
    expect(html).toContain(resetUrl);
    // CTA exists
    expect(html).toContain("Redefinir senha");
    // 1-hour validity copy
    expect(html).toContain("Este link expira em 1 hora e pode ser usado apenas uma vez.");
    // Eyebrow + title
    expect(html).toContain("RECUPERAÇÃO DE ACESSO");
    expect(html).toContain("Redefina sua senha");
    // Security notice (semantics unchanged)
    expect(html).toContain("ignore este e-mail com segurança");
  });

  it("keeps the token only inside the encoded reset URL, never in plaintext body", async () => {
    const token = "sensitive token xyz+/=";
    const html = await renderWithCapturedHtml("Dest", token);
    // Encoded token is present (in the URL)
    expect(html).toContain(encodeURIComponent(token));
    // Raw token is not leaked as a bare string
    expect(html).not.toContain(token);
  });
});
