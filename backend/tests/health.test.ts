import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("GET /health", () => {
  it("returns 200 and status ok without touching the database", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("looply-backend");
    expect(res.body.time).toBeTruthy();
  });

  it("returns 401 for unknown /api routes without a session (auth wall), 404 elsewhere", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    const res2 = await request(app).get("/does-not-exist");
    expect(res2.status).toBe(404);
    expect(res2.body.error).toBeDefined();
  });
});
