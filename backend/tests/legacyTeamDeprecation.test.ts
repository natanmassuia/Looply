import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { SESSION_COOKIE } from "../src/lib/session";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";

// lib/db imports lib/env which loads dotenv at import time — synchronous.
// Live-DB regression suite: proves the legacy identity-creation path is closed
// and that provisioning/invitations remain the only production user creation.
// Skipped automatically when DATABASE_URL is not configured.
describe.skipIf(!process.env.DATABASE_URL)("legacy /api/team user creation is closed", () => {
  it("POST /api/team returns 410 for OWNER/ADMIN (no User creation) — invitation flow cannot be bypassed", async () => {
    // Demo workspace is ACTIVE with definitive passwords (B4 backfill).
    const session = await login(prisma, "natan@looply.dev", "looply123");
    expect(session.user.role).toBe("OWNER");

    const before = await prisma.user.count();
    const res = await request(app)
      .post("/api/team")
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`)
      .send({ name: "Hack", email: `hax-${Date.now()}@x.com`, role: "ADMIN" });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("gone");
    expect(await prisma.user.count()).toBe(before); // nothing created

    await logout(prisma, session.token);
  });

  it("POST /api/team returns 410 for MEMBER too — no role creates users here", async () => {
    const session = await login(prisma, "marina@looply.dev", "looply123");
    expect(session.user.role).toBe("MEMBER");
    const res = await request(app)
      .post("/api/team")
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`)
      .send({ name: "Hack", email: `hax2-${Date.now()}@x.com`, role: "EDITOR" });
    expect(res.status).toBe(410);
    await logout(prisma, session.token);
  });

  it("unauthenticated POST /api/team hits the auth wall (401), not creation", async () => {
    const res = await request(app).post("/api/team").send({ name: "X", email: "x@x.com", role: "ADMIN" });
    expect(res.status).toBe(401);
  });

  it("GET /api/team still works (read-only preserved)", async () => {
    const res = await request(app).get("/api/team");
    expect([200, 401]).toContain(res.status); // 401 without cookie is correct too
  });

  // F14.1.1 — identity media projection: /api/team members and /api/auth/me
  // workspace must expose avatarUrl/logoUrl so UIs can render photos.
  it("GET /api/team projects avatarUrl for members (identity propagation)", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const res = await request(app)
      .get("/api/team")
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(res.status).toBe(200);
    const me = res.body.team.find((u: any) => u.email === "natan@looply.dev");
    expect(me).toBeDefined();
    expect(me).toHaveProperty("avatarUrl");
    await logout(prisma, session.token);
  });

  it("GET /api/auth/me workspace exposes logoUrl (company identity propagation)", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("avatarUrl");
    expect(res.body.workspace).toHaveProperty("logoUrl");
    await logout(prisma, session.token);
  });
});
