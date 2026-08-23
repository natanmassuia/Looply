import { describe, expect, it } from "vitest";
import {
  isPrivateOrReservedIp,
  validateMediaUrl,
  safeMediaDownload,
} from "../src/lib/ssrfGuard";

describe("SSRF Guard - IP validation", () => {
  it("identifies private and reserved IPv4 addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("127.10.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.255.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
    expect(isPrivateOrReservedIp("224.0.0.1")).toBe(true);
  });

  it("identifies public non-reserved IPv4 addresses", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("157.240.241.35")).toBe(false);
  });

  it("identifies private and reserved IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("0:0:0:0:0:0:0:1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
  });
});

describe("SSRF Guard - URL validation", () => {
  it("allows valid HTTPS media URLs from trusted Meta & Gupshup domains", () => {
    expect(validateMediaUrl("https://graph.facebook.com/v21.0/media/123").valid).toBe(true);
    expect(validateMediaUrl("https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123").valid).toBe(true);
    expect(validateMediaUrl("https://scontent.xx.fbcdn.net/v/t39.1997-6/123.ogg").valid).toBe(true);
    expect(validateMediaUrl("https://media.gupshup.io/media/audio/123.ogg").valid).toBe(true);
    expect(validateMediaUrl("https://filex.gupshup.io/download/abc").valid).toBe(true);
    expect(validateMediaUrl("https://api.gupshup.io/wa/media/123").valid).toBe(true);
    expect(validateMediaUrl("https://mmg.whatsapp.net/d/f/abc.enc").valid).toBe(true);
  });

  it("rejects non-HTTPS protocols (http, ftp, file, gopher)", () => {
    expect(validateMediaUrl("http://media.gupshup.io/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("ftp://graph.facebook.com/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("file:///etc/passwd").valid).toBe(false);
    expect(validateMediaUrl("gopher://graph.facebook.com/").valid).toBe(false);
  });

  it("rejects localhost and private network hostnames", () => {
    expect(validateMediaUrl("https://localhost/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://foo.localhost/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://app.local/audio.ogg").valid).toBe(false);
  });

  it("rejects direct IP addresses (loopback, RFC1918, metadata)", () => {
    expect(validateMediaUrl("https://127.0.0.1/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://10.0.0.1/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://172.16.0.1/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://192.168.1.1/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://169.254.169.254/latest/meta-data/").valid).toBe(false);
    expect(validateMediaUrl("https://[::1]/audio.ogg").valid).toBe(false);
  });

  it("rejects untrusted domains not matching provider allowlist", () => {
    expect(validateMediaUrl("https://evil-attacker.com/exploit.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://google.com/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://facebook.com.attacker.com/audio.ogg").valid).toBe(false);
  });

  it("rejects non-standard ports", () => {
    expect(validateMediaUrl("https://graph.facebook.com:8443/audio.ogg").valid).toBe(false);
    expect(validateMediaUrl("https://media.gupshup.io:9000/audio.ogg").valid).toBe(false);
  });
});

describe("SSRF Guard - Safe Download & Redirect Handling", () => {
  it("downloads safely when URL and response are valid", async () => {
    const fetchImpl: typeof fetch = async () => {
      return new Response(Buffer.from("valid-audio-data"), {
        status: 200,
        headers: { "content-type": "audio/ogg" },
      });
    };

    const res = await safeMediaDownload(
      "https://media.gupshup.io/audio.ogg",
      {},
      { fetchImpl },
    );
    expect(res.buffer.toString()).toBe("valid-audio-data");
    expect(res.contentType).toBe("audio/ogg");
  });

  it("blocks requests when redirect attempts to navigate to a private/internal IP or untrusted host", async () => {
    const fetchImpl: typeof fetch = async (url) => {
      if (String(url).includes("gupshup.io")) {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        });
      }
      return new Response("metadata", { status: 200 });
    };

    await expect(
      safeMediaDownload("https://media.gupshup.io/redirect.ogg", {}, { fetchImpl }),
    ).rejects.toThrow("SSRF Guard blocked media URL");
  });

  it("blocks requests that exceed maximum allowed redirects", async () => {
    let redirectCount = 0;
    const fetchImpl: typeof fetch = async () => {
      redirectCount++;
      return new Response(null, {
        status: 302,
        headers: { location: `https://media.gupshup.io/redirect-${redirectCount}.ogg` },
      });
    };

    await expect(
      safeMediaDownload("https://media.gupshup.io/loop.ogg", {}, { fetchImpl, maxRedirects: 2 }),
    ).rejects.toThrow("Too many redirects");
  });
});
