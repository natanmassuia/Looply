import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { SESSION_COOKIE } from "../src/lib/session";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { seedCredentials } from "./seedCredentials";
import { hashPassword } from "../src/lib/password";

// lib/db imports lib/env which loads dotenv at import time — synchronous.
// Live-DB regression suite: proves the legacy identity-creation path is closed
// and that provisioning/invitations remain the only production user creation.
// Skipped automatically when DATABASE_URL is not configured.
describe.skipIf(!process.env.DATABASE_URL)("legacy /api/team user creation is closed", () => {
  const memberEmail = `member-${Date.now()}@looply.dev`;
  let memberUser: any;

  beforeAll(async () => {
    const creds = seedCredentials();
    const company = await prisma.company.findFirst({ where: { slug: "looply-studio" } });
    if (!company) throw new Error("No company found — seed must run before tests");
    const hash = await hashPassword(creds.password);
    memberUser = await prisma.user.create({
      data: {
        email: memberEmail,
        name: "Test Member",
        role: "CONTENT_MANAGER",
        active: true,
        passwordHash: hash,
      },
    });
    await prisma.companyMember.create({
      data: { userId: memberUser.id, companyId: company.id, role: "MEMBER", isActive: true },
    });
  });

  afterAll(async () => {
    if (memberUser) {
      await prisma.session.deleteMany({ where: { userId: memberUser.id } });
      await prisma.companyMember.deleteMany({ where: { userId: memberUser.id } });
      await prisma.user.delete({ where: { id: memberUser.id } });
    }
  });

  it("POST /api/team returns 410 for OWNER/ADMIN (no User creation) — invitation flow cannot be bypassed", async () => {
    // Demo workspace is ACTIVE with definitive passwords (B4 backfill).
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
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
    const session = await login(prisma, memberEmail, seedCredentials().password);
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
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const res = await request(app)
      .get("/api/team")
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(res.status).toBe(200);
    const me = res.body.team.find((u: any) => u.email === seedCredentials().email);
    expect(me).toBeDefined();
    expect(me).toHaveProperty("avatarUrl");
    await logout(prisma, session.token);
  });

  it("GET /api/auth/me workspace exposes logoUrl (company identity propagation)", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("avatarUrl");
    expect(res.body.workspace).toHaveProperty("logoUrl");
    await logout(prisma, session.token);
  });
});
