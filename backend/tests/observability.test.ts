import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { logger, redact } from "../src/lib/logger";
import { setErrorReporter } from "../src/lib/errorReporter";
import { requestLogger } from "../src/middleware/requestLogger";
import { errorHandler, AppError } from "../src/lib/errors";
import type { Request, Response, NextFunction } from "express";

afterEach(() => {
  setErrorReporter(null);
  vi.restoreAllMocks();
});

describe("R2.2 request correlation", () => {
  it("sets x-request-id response header and logs it", async () => {
    const logSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const res = await request(app).get("/health");
    const id = res.headers["x-request-id"] as string;
    expect(id).toBeTruthy();
    const logLine = logSpy.mock.calls.find(([m]) => m === "request");
    expect(logLine).toBeDefined();
    expect(logLine![1]).toMatchObject({ requestId: id });
  });

  it("accepts a safe incoming x-request-id and echoes it back", async () => {
    const res = await request(app).get("/health").set("x-request-id", "abc123XYZ_9");
    expect(res.headers["x-request-id"]).toBe("abc123XYZ_9");
  });

  it("ignores an unsafe incoming x-request-id and generates a fresh one", async () => {
    const res = await request(app).get("/health").set("x-request-id", "../../etc/passwd");
    const id = res.headers["x-request-id"] as string;
    expect(id).toBeTruthy();
    expect(id).not.toBe("../../etc/passwd");
  });
});

describe("R2.2 error correlation + reporting seam", () => {
  it("invokes the error reporter on unexpected 5xx with request + route context", async () => {
    const reported: unknown[] = [];
    setErrorReporter((e) => reported.push(e));
    const req = { path: "/api/x", method: "GET" } as Request;
    const res = {
      locals: { requestId: "rid-1", companyId: "co-1" },
      status: () => res,
      json: () => res,
    } as unknown as Response;
    errorHandler(new Error("boom"), req, res, () => {});
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({
      message: "Erro interno do servidor",
      requestId: "rid-1",
      companyId: "co-1",
      method: "GET",
      path: "/api/x",
      status: 500,
    });
  });

  it("does NOT report client-facing 4xx AppErrors through the seam", async () => {
    const reported: unknown[] = [];
    setErrorReporter((e) => reported.push(e));
    const req = { path: "/api/x", method: "GET" } as Request;
    const res = {
      locals: { requestId: "rid", companyId: "co-1" },
      status: () => res,
      json: () => res,
    } as unknown as Response;
    const appErr = new AppError(404, "not found", "not_found");
    errorHandler(appErr, req, res, () => {});
    expect(reported).toHaveLength(0);
  });
});

describe("R2.2 tenant correlation uses authenticated context", () => {
  it("requestLogger emits companyId from res.locals (set by requireAuth from the session)", async () => {
    const logSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const req = {
      path: "/api/x",
      method: "GET",
    } as unknown as Request;
    const res = {
      locals: { requestId: "rid", companyId: "co-auth" },
      statusCode: 200,
      on: (ev: string, cb: () => void) => {
        if (ev === "finish") cb();
        return res;
      },
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    requestLogger(req, res, next);
    const line = logSpy.mock.calls.find(([m]) => m === "request");
    expect(line).toBeDefined();
    expect(line![1]).toMatchObject({
      requestId: "rid",
      companyId: "co-auth",
      method: "GET",
      path: "/api/x",
      status: 200,
    });
    expect(next).toHaveBeenCalled();
  });
});

describe("R2.2 redaction remains effective", () => {
  it("redacts sensitive keys and never leaks nested secrets", () => {
    const out = redact({
      authorization: "Bearer secret-token",
      password: "pw",
      nested: { token: "t", apiKey: "k", ok: 1 },
      requestId: "rid",
      companyId: "co",
    });
    expect(out).toEqual({
      authorization: "[redacted]",
      password: "[redacted]",
      nested: { token: "[redacted]", apiKey: "[redacted]", ok: 1 },
      requestId: "rid",
      companyId: "co",
    });
  });
});
