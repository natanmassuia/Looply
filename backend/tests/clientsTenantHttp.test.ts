import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { SESSION_COOKIE } from "../src/lib/session";
import { login, logout } from "../src/services/authService";
import { prisma } from "../src/lib/db";

// Live-DB HTTP suite: proves tenant isolation end-to-end through the real
// route stack (auth → workspace → capability CLIENTS → tenant-scoped CRUD).
// Requires DATABASE_URL + seeded demo workspace. Skipped otherwise.

const emailA = "natan@looply.dev"; // OWNER of Looply Studio (MARKETING_AGENCY)
const emailB = "dono@testecorp.com"; // OWNER of Teste Corp (HIGH_TICKET, from B4 smoke)

const createdClientIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("clients tenant isolation (HTTP)", () => {
  it("lists only own-tenant clients", async () => {
    const a = await login(prisma, emailA, "looply123");
    const b = await login(prisma, emailB, "senha-definitiva-123");
    const resA = await request(app).get("/api/clients").set("Cookie", `${SESSION_COOKIE}=${a.token}`);
    const resB = await request(app).get("/api/clients").set("Cookie", `${SESSION_COOKIE}=${b.token}`);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.clients.length).toBeGreaterThan(0);
    expect(resB.body.clients.every((c: any) => c.id)).toBe(true);
    const idsA = resA.body.clients.map((c: any) => c.id);
    const idsB = resB.body.clients.map((c: any) => c.id);
    expect(idsA.filter((id: string) => idsB.includes(id))).toEqual([]);
    // cross DB check: every client listed belongs to the right company
    for (const c of resA.body.clients) {
      const row = await prisma.client.findUnique({ where: { id: c.id }, select: { companyId: true } });
      expect(row!.companyId).toBe(a.user.companyId);
    }
    await Promise.all([logout(prisma, a.token), logout(prisma, b.token)]);
  });

  it("create: body companyId spoof does not change ownership", async () => {
    const b = await login(prisma, emailB, "senha-definitiva-123");
    const victim = await prisma.client.findFirst({
      where: { companyId: { not: b.user.companyId! } },
      select: { id: true, companyId: true },
    });
    const res = await request(app)
      .post("/api/clients")
      .set("Cookie", `${SESSION_COOKIE}=${b.token}`)
      .send({ name: `SpoofTest ${Date.now()}`, companyId: victim?.companyId });
    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(b.user.companyId);
    expect(res.body.companyId).not.toBe(victim?.companyId);
    createdClientIds.push(res.body.id);
    await logout(prisma, b.token);
  });

  it("detail/patch/delete cross-tenant → 404", async () => {
    const a = await login(prisma, emailA, "looply123");
    const b = await login(prisma, emailB, "senha-definitiva-123");
    const own = await prisma.client.findFirst({
      where: { companyId: a.user.companyId! },
      select: { id: true },
    });
    const cookieB = `${SESSION_COOKIE}=${b.token}`;
    expect((await request(app).get(`/api/clients/${own!.id}`).set("Cookie", cookieB)).status).toBe(404);
    expect(
      (await request(app).patch(`/api/clients/${own!.id}`).set("Cookie", cookieB).send({ name: "hack" })).status,
    ).toBe(404);
    expect((await request(app).delete(`/api/clients/${own!.id}`).set("Cookie", cookieB)).status).toBe(404);
    await Promise.all([logout(prisma, a.token), logout(prisma, b.token)]);
  });

  it("unauthenticated → 401", async () => {
    expect((await request(app).get("/api/clients")).status).toBe(401);
  });

  afterAll(async () => {
    for (const id of createdClientIds) {
      await prisma.client.delete({ where: { id } }).catch(() => undefined);
    }
  });
});
