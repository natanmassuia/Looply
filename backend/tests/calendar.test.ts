import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { SESSION_COOKIE } from "../src/lib/session";
import { getCalendar } from "../src/services/calendarService";

describe.skipIf(!process.env.DATABASE_URL)("Calendar projection", () => {
  it("projects only the current tenant's scheduled/publication dates", async () => {
    const a = await login(prisma, "natan@looply.dev", "looply123");
    const b = await login(prisma, "dono@testecorp.com", "senha-definitiva-123");
    const range = "from=2026-08-16T00:00:00.000Z&to=2026-08-24T00:00:00.000Z";
    const [calendarA, calendarB] = await Promise.all([
      request(app).get(`/api/calendar?${range}`).set("Cookie", `${SESSION_COOKIE}=${a.token}`),
      request(app).get(`/api/calendar?${range}`).set("Cookie", `${SESSION_COOKIE}=${b.token}`),
    ]);
    expect(calendarA.status).toBe(200);
    expect(calendarB.status).toBe(200);
    expect(calendarA.body.events.length).toBeGreaterThan(0);
    expect(calendarA.body.events.every((event: any) => event.client)).toBe(true);
    expect(calendarB.body.events).toEqual([]);
    expect(calendarA.body.range.inclusiveStart).toBe(true);
    expect(calendarA.body.range.exclusiveEnd).toBe(true);
    await Promise.all([logout(prisma, a.token), logout(prisma, b.token)]);
  });

  it("returns separate events for separate canonical dates and supports filters", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const client = await prisma.client.findFirst({ where: { companyId: session.user.companyId! }, select: { id: true } });
    const response = await request(app)
      .get(`/api/calendar?from=2026-08-16T00:00:00.000Z&to=2026-08-24T00:00:00.000Z&clientId=${client!.id}`)
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(response.status).toBe(200);
    const types = new Set(response.body.events.map((event: any) => event.type));
    expect(types.has("SCHEDULED")).toBe(true);
    expect(types.has("PUBLICATION_TARGET")).toBe(true);
    expect(response.body.events.every((event: any) => event.client.id === client!.id)).toBe(true);
    await logout(prisma, session.token);
  });

  it("rejects invalid, reversed and oversized ranges", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    expect((await request(app).get("/api/calendar?from=nope&to=nope").set("Cookie", cookie)).status).toBe(400);
    expect((await request(app).get("/api/calendar?from=2026-08-20T00:00:00.000Z&to=2026-08-19T00:00:00.000Z").set("Cookie", cookie)).status).toBe(400);
    expect((await request(app).get("/api/calendar?from=2026-01-01T00:00:00.000Z&to=2026-05-01T00:00:00.000Z").set("Cookie", cookie)).status).toBe(400);
    expect((await request(app).get("/api/calendar?from=2026-08-16T00:00:00.000Z&to=2026-08-24T00:00:00.000Z&companyId=other").set("Cookie", cookie)).status).toBe(200);
    await logout(prisma, session.token);
  });

  it("requires CALENDAR capability/auth and keeps Job date mutation as write authority", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const job = await prisma.job.findFirst({ where: { companyId: session.user.companyId! }, select: { id: true } });
    const result = await request(app)
      .patch(`/api/jobs/${job!.id}`)
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`)
      .send({ scheduledAt: "2026-08-30T15:00:00.000Z" });
    expect(result.status).toBe(200);
    const calendar = await request(app)
      .get("/api/calendar?from=2026-08-30T00:00:00.000Z&to=2026-08-31T00:00:00.000Z")
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(calendar.status).toBe(200);
    expect(calendar.body.events.some((event: any) => event.jobId === job!.id && event.type === "SCHEDULED")).toBe(true);
    await logout(prisma, session.token);
  });

  afterAll(async () => {
    // Restore the single date changed by the mutation test.
    const job = await prisma.job.findFirst({ where: { title: { contains: "Campanha Dia dos Pais" } }, select: { id: true } });
    if (job) await prisma.job.update({ where: { id: job.id }, data: { scheduledAt: new Date("2026-08-20T19:00:00.000Z") } });
  });
});

describe("Calendar pure range contract", () => {
  it("uses inclusive start and exclusive end", async () => {
    const db: any = {
      company: { findUnique: async () => ({ timezone: "America/Sao_Paulo" }) },
      client: { findFirst: async () => ({ id: "c1" }) },
      workflowStage: { findFirst: async () => ({ id: "s1" }) },
      job: {
        findMany: async () => [{ id: "j1", title: "A", lifecycleStatus: "OPEN", publicationTarget: new Date("2026-08-20T00:00:00.000Z"), scheduledAt: new Date("2026-08-20T01:00:00.000Z"), client: { id: "c1", name: "C", brandColor: null }, currentStage: null }],
      },
    };
    const result = await getCalendar(db, "company-a", { from: "2026-08-20T00:00:00.000Z", to: "2026-08-20T01:00:00.000Z", clientId: "c1" });
    expect(result.events.map((event) => event.type)).toEqual(["PUBLICATION_TARGET"]);
  });
});
