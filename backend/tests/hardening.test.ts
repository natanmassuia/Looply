import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { checkRateLimit } from "../src/lib/rateLimit";
import { PASSWORD_RESET_LIMIT } from "../src/lib/rateLimit";
import { env } from "../src/lib/env";
import { errorHandler } from "../src/lib/errors";
import { TransitionError } from "../src/domain/workflow";

describe("B12 CSRF and rate-limit primitives", () => {
  it("rejects unsafe foreign-origin cookie mutations", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: "x@example.com", password: "password" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("forbidden");
  });

  it("allows configured same-origin mutations to reach normal validation", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", env.CORS_ORIGIN)
      .send({ email: "x@example.com", password: "password" });
    expect(response.status).toBe(401); // auth validation, not CSRF
  });

  it("allows token-authenticated public approval requests through CSRF origin guard", async () => {
    const response = await request(app)
      .get("/api/public/approvals/not-real")
      .set("Origin", "https://evil.example");
    expect(response.status).toBe(404); // public token validation, not CSRF rejection
  });

  it("rate limiter permits the window then blocks deterministically", () => {
    const key = `b12-${Date.now()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(false);
  });

  it("password reset endpoint is rate-limited per IP+token and returns 429 on abuse", async () => {
    const token = `r2-3b-reset-${Date.now()}`;
    const body = { token, password: "NewSecurePassword123!" };
    // Fill the per-IP+token window past the limit.
    for (let i = 0; i < 21; i += 1) {
      await request(app).post("/api/auth/password-reset").send(body);
    }
    const limited = await request(app).post("/api/auth/password-reset").send(body);
    expect(limited.status).toBe(429);
  });

  it("password reset limiter allows valid attempts within the window", () => {
    // The PASSWORD_RESET_LIMIT middleware permits calls until the max is hit.
    const req = { ip: "127.0.0.1", body: { token: `ok-${Date.now()}` } } as any;
    const res = { setHeader: () => {}, statusCode: 0 } as any;
    let nextCalled = false;
    PASSWORD_RESET_LIMIT(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it("public approval and invitation mutation limits return 429", async () => {
    for (let i = 0; i < 20; i += 1) {
      const response = await request(app).post("/api/public/approvals/b12-rate-test/approve").send({});
      expect(response.status).toBe(404);
    }
    const approvalLimited = await request(app).post("/api/public/approvals/b12-rate-test/approve").send({});
    expect(approvalLimited.status).toBe(429);

    for (let i = 0; i < 20; i += 1) {
      const response = await request(app).post("/api/invitations/accept").send({ token: "b12-invitation-rate-test" });
      expect(response.status).toBe(400);
    }
    const invitationLimited = await request(app).post("/api/invitations/accept").send({ token: "b12-invitation-rate-test" });
    expect(invitationLimited.status).toBe(429);
  });

  it("trust proxy is explicit rather than implicitly trusting forwarded IPs", () => {
    expect(app.get("trust proxy")).toBe(env.TRUST_PROXY);
  });

  it("malformed JSON body returns 400 instead of an internal 500", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", env.CORS_ORIGIN)
      .set("Content-Type", "application/json")
      .send('{bad json');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("bad_request");
  });

  it("oversized JSON body returns 413 with no parser internals leaked", async () => {
    const oversized = JSON.stringify({ data: "x".repeat(1024 * 1024 + 1) });
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", env.CORS_ORIGIN)
      .set("Content-Type", "application/json")
      .send(oversized);
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("payload_too_large");
    expect(response.text).not.toMatch(/entity|JSON|stack|at /i);
  });

  it("invalid content-state transitions surface as 409 conflict, not 500", () => {
    const res = { statusCode: 0, locals: {}, status: (code: number) => { res.statusCode = code; return { json: () => {} }; }, json: () => {} } as any;
    errorHandler(new TransitionError("DRAFT", "PUBLISHED"), { method: "POST", path: "/test" } as any, res, (() => {}) as any);
    expect(res.statusCode).toBe(409);
  });
});
