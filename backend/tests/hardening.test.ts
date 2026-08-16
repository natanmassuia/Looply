import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { checkRateLimit } from "../src/lib/rateLimit";
import { env } from "../src/lib/env";

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
    expect(app.get("trust proxy")).toBe(false);
  });
});
