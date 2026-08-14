import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("requestId middleware", () => {
  it("generates an id and echoes it in the x-request-id header", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("honors a safe incoming x-request-id", async () => {
    const res = await request(app).get("/health").set("x-request-id", "abc12345");
    expect(res.headers["x-request-id"]).toBe("abc12345");
  });

  it("replaces an unsafe incoming x-request-id", async () => {
    const res = await request(app).get("/health").set("x-request-id", "drop table users; --");
    expect(res.headers["x-request-id"]).not.toContain("drop");
    expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});

describe("error contract", () => {
  it("includes requestId in 404 error payload", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
    expect(res.body.error.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(res.body.error.stack).toBeUndefined();
  });
});

describe("GET /health/ready", () => {
  it("reports readiness shape (200 ready or 503 unavailable)", async () => {
    const res = await request(app).get("/health/ready");
    expect([200, 503]).toContain(res.status);
    expect(["ready", "unavailable"]).toContain(res.body.status);
    expect(Object.keys(res.body)).toEqual(["status"]);
  });
});
