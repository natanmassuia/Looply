import { isIP } from "node:net";
import { logger } from "./logger";

// ── SSRF Guard (Security Hardening for External Media Download) ───────────
// Strict validation for external media URLs downloaded by WhatsApp/Gupshup
// providers. Enforces HTTPS only, blocks loopback, RFC1918, link-local,
// cloud metadata, and restricts hostnames to trusted provider domain patterns.

export interface SsrfValidationResult {
  valid: boolean;
  reason?: string;
}

// Trusted domain patterns for WhatsApp (Meta) and Gupshup media delivery
export const DEFAULT_ALLOWED_MEDIA_HOST_PATTERNS: RegExp[] = [
  // Meta / WhatsApp Graph API & CDN domains
  /^graph\.facebook\.com$/,
  /^[a-z0-9.-]+\.fbcdn\.net$/,
  /^[a-z0-9.-]+\.fbsbx\.com$/,
  /^[a-z0-9.-]+\.facebook\.com$/,
  /^[a-z0-9.-]+\.whatsapp\.net$/,
  // Gupshup media domains
  /^[a-z0-9.-]+\.gupshup\.io$/,
  /^media\.gupshup\.io$/,
  /^filex\.gupshup\.io$/,
  /^api\.gupshup\.io$/,
];

export function isPrivateOrReservedIp(ip: string): boolean {
  // Normalize IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
  const normalizedIp = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  // IPv4 checks
  if (isIP(normalizedIp) === 4) {
    const parts = normalizedIp.split(".").map((p) => Number.parseInt(p, 10));
    const [b0, b1] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 10.0.0.0/8 (RFC1918 Private)
    if (b0 === 10) return true;
    // 172.16.0.0/12 (RFC1918 Private)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16 (RFC1918 Private)
    if (b0 === 192 && b1 === 168) return true;
    // 169.254.0.0/16 (Link-local / AWS/GCP/Azure Metadata 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT / Tailscale CGNAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;
    if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;
    if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (b0 >= 224) return true;
    return false;
  }

  // IPv6 checks
  if (isIP(normalizedIp) === 6) {
    const lower = normalizedIp.toLowerCase();
    // Loopback ::1
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
    // Unspecified ::
    if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
    // Link-local fe80::/10
    if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    // Unique local fc00::/7 (fc00:: and fd00::)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // IPv4-compatible or mapped
    if (lower.startsWith("::ffff:") || lower.startsWith("::")) return true;
    return false;
  }

  return false;
}

export function validateMediaUrl(
  rawUrl: string,
  allowedPatterns: RegExp[] = DEFAULT_ALLOWED_MEDIA_HOST_PATTERNS,
): SsrfValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: "invalid_url_format" };
  }

  // 1. Enforce HTTPS only (reject http, ftp, file, gopher, etc.)
  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "insecure_protocol_https_required" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject localhost names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "ip6-localhost" ||
    hostname === "ip6-loopback" ||
    hostname === "local" ||
    hostname.endsWith(".local")
  ) {
    return { valid: false, reason: "localhost_forbidden" };
  }

  // 3. Reject direct IP addresses if private or reserved
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, reason: "private_or_reserved_ip_forbidden" };
    }
    // Even if public IP, direct IP is forbidden unless matching an allowed pattern
    const matchesPattern = allowedPatterns.some((pattern) => pattern.test(hostname));
    if (!matchesPattern) {
      return { valid: false, reason: "untrusted_ip_host" };
    }
  }

  // 4. Validate hostname against trusted provider pattern allowlist
  const isAllowedHost = allowedPatterns.some((pattern) => pattern.test(hostname));
  if (!isAllowedHost) {
    return { valid: false, reason: "untrusted_media_host" };
  }

  // 5. Reject custom ports (must be standard HTTPS 443 / default)
  if (parsed.port && parsed.port !== "443") {
    return { valid: false, reason: "non_standard_port_forbidden" };
  }

  return { valid: true };
}

export interface SafeFetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRedirects?: number;
  allowedPatterns?: RegExp[];
}

export async function safeMediaDownload(
  url: string,
  headers: Record<string, string> = {},
  options: SafeFetchOptions = {},
): Promise<{ buffer: Buffer; contentType: string }> {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxRedirects = options.maxRedirects ?? 3;
  const allowedPatterns = options.allowedPatterns ?? DEFAULT_ALLOWED_MEDIA_HOST_PATTERNS;

  let currentUrl = url;
  let redirectsRemaining = maxRedirects;

  while (redirectsRemaining >= 0) {
    const validation = validateMediaUrl(currentUrl, allowedPatterns);
    if (!validation.valid) {
      logger.warn("ssrf_guard_blocked_request", { url: currentUrl, reason: validation.reason });
      throw new Error(`SSRF Guard blocked media URL: ${validation.reason}`);
    }

    const response = await doFetch(currentUrl, {
      method: "GET",
      headers,
      redirect: "manual", // Do NOT automatically follow redirects; inspect each location
      signal: AbortSignal.timeout(timeoutMs),
    });

    // Check for redirect responses (301, 302, 303, 307, 308)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect response missing location header");
      }
      redirectsRemaining--;
      if (redirectsRemaining < 0) {
        throw new Error("Too many redirects during media download");
      }
      // Resolve relative or absolute redirect URL against current URL
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Media download failed with HTTP status ${response.status}`);
    }

    const arrayBuf = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    return { buffer: Buffer.from(arrayBuf), contentType };
  }

  throw new Error("Too many redirects");
}
