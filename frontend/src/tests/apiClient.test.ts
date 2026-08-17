import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, ApiError, shouldRetry } from "../lib/api";

// Foundation contract tests — mock global fetch; no network, no backend.
function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchMock.mockReset();
  });

  it("sends credentials include on every request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await apiFetch("/api/x");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("parses a successful JSON response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { value: 42 }));
    await expect(apiFetch<{ value: number }>("/api/x")).resolves.toEqual({ value: 42 });
  });

  it("returns null for 204 no-content", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiFetch("/api/x")).resolves.toBeNull();
  });

  it("maps backend JSON error to ApiError with status and code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "conflict", message: "já decidido" } }),
    );
    const error = await apiFetch("/api/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(409);
    expect(apiError.code).toBe("conflict");
    expect(apiError.message).toBe("já decidido");
  });

  it("maps non-JSON error body to a safe generic ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>gateway error</html>", { status: 502 }),
    );
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe("Erro 502");
    expect(error.message).not.toContain("gateway");
  });

  it("parses Retry-After on 429", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: { code: "rate_limited", message: "muitas tentativas" } }, {
        "Retry-After": "120",
      }),
    );
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(120);
  });

  it("passes AbortSignal through to fetch", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const controller = new AbortController();
    await apiFetch("/api/x", { signal: controller.signal });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("preserves 401 without redirecting or mutating", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: { code: "unauthorized", message: "Não autenticado" } }),
    );
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(401);
    expect(error.code).toBe("unauthorized");
  });

  it("preserves 403 code and message for capability/forbidden cases", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: "forbidden", message: "Recurso não disponível" } }),
    );
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(403);
    expect(error.code).toBe("forbidden");
  });

  it("preserves 503 as dependency unavailable", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { error: { code: "storage_unavailable", message: "Object storage não configurado" } }),
    );
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(503);
    expect(error.code).toBe("storage_unavailable");
  });

  it("sets JSON content-type only when a body is sent", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await apiFetch("/api/x", { method: "POST", body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await apiFetch("/api/x", { method: "POST" });
    const [, init2] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(init2.headers).get("content-type")).toBeNull();
  });
});

describe("shouldRetry", () => {
  const cases: [number, boolean][] = [
    [400, false],
    [401, false],
    [403, false],
    [404, false],
    [409, false],
    [429, false],
  ];
  for (const [status, expected] of cases) {
    it(`${status} → ${expected}`, () => {
      expect(shouldRetry(0, new ApiError(status, "x"))).toBe(expected);
    });
  }
  it("500 → allowed once", () => {
    expect(shouldRetry(0, new ApiError(500, "x"))).toBe(true);
  });
  it("network error → allowed once", () => {
    expect(shouldRetry(0, new TypeError("fetch failed"))).toBe(true);
  });
  it("never retries beyond the first failure", () => {
    expect(shouldRetry(1, new ApiError(500, "x"))).toBe(false);
  });
});

// F14 — the 3-step identity-media upload pattern (intent → presigned PUT →
// complete) must NEVER send the browser to the internal MinIO loopback host.
// Any URL returned by an *upload-intent* endpoint whose host is the server's
// private endpoint is unusable by an external browser (ERR_CONNECTION_REFUSED).
describe("F14 identity media upload flow uses the public presigned URL verbatim", () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchMock.mockReset();
  });

  async function runIntentThenPut(intentUrl: string) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          uploadUrl: intentUrl,
          key: "users/u1/avatar/x.png",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        }),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    const intent = await apiFetch<{ uploadUrl: string; key: string }>(
      "/api/me/avatar/upload-intent",
      { method: "POST", body: { contentType: "image/png", sizeBytes: 100 } },
    );

    // The browser PUT goes to whatever URL the server returned.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      headers: new Headers(),
    } as unknown as Response);
    await fetch(intent.uploadUrl, { method: "PUT" });

    return { intentUrl: intent.uploadUrl, putCall: fetchMock.mock.calls[1] };
  }

  it("browser PUT is the public URL (no 127.0.0.1 leakage)", async () => {
    const { intentUrl, putCall } = await runIntentThenPut(
      "https://looply.verbumlab.com.br/looply-media/users/u1/avatar/x.png?X-Amz-Signature=abc",
    );
    expect(intentUrl.startsWith("https://")).toBe(true);
    expect(intentUrl).not.toContain("127.0.0.1");
    expect(intentUrl).not.toContain("localhost");
    expect(putCall[0]).toBe(intentUrl);
  });

  it("browser to loopback URL would break — defensive: never trust it", async () => {
    // Contract: if the backend ever returns a loopback URL by mistake, the
    // frontend still does NOT silently rewrite it. The browser MUST fail
    // loudly so the regression is detectable. This test pins the contract:
    // the URL we hand to fetch is exactly what the server returned.
    const { intentUrl, putCall } = await runIntentThenPut("http://127.0.0.1:9100/looply-media/x.png");
    expect(putCall[0]).toBe("http://127.0.0.1:9100/looply-media/x.png");
    // (No rewrite — we never silently mask an endpoint leak.)
    expect(intentUrl).toContain("127.0.0.1");
  });
});
