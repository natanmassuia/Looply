import { describe, expect, it } from "vitest";
import { MetaWhatsAppProvider } from "../src/services/whatsappProvider";

// Outbound must leave via the company channel's phone_number_id, falling back
// to the .env number when none is supplied (per-company sender routing).
describe("MetaWhatsAppProvider.sendText sender routing", () => {
  function makeProvider(urls: string[]) {
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return new MetaWhatsAppProvider({
      accessToken: "tok",
      phoneNumberId: "env_default_id",
      graphApiVersion: "v21.0",
      fetchImpl,
    });
  }

  it("posts to the explicit phoneNumberId when given", async () => {
    const urls: string[] = [];
    await makeProvider(urls).sendText("+5511999998888", "oi", "company_channel_id");
    expect(urls[0]).toBe("https://graph.facebook.com/v21.0/company_channel_id/messages");
  });

  it("falls back to the .env phoneNumberId when none is given", async () => {
    const urls: string[] = [];
    await makeProvider(urls).sendText("+5511999998888", "oi");
    expect(urls[0]).toBe("https://graph.facebook.com/v21.0/env_default_id/messages");
  });
});
