import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { seedCredentials } from "./seedCredentials";
import { tenantBLogin } from "./fixtures";
import { SESSION_COOKIE } from "../src/lib/session";
import { getCalendar } from "../src/services/calendarService";

describe.skipIf(!process.env.DATABASE_URL)("Calendar projection", () => {
  it("projects only the current tenant's scheduled/publication dates", async () => {
    const a = await login(prisma, seedCredentials().email, seedCredentials().password);
    const b = await tenantBLogin(prisma);
    // Seed dates are relative to the run date — derive the window from the
    // demo contents so the projection assertion does not rot with the clock.
    const jobs = await prisma.job.findMany({
      where: { companyId: a.user.companyId! },
      select: { scheduledAt: true, publicationTarget: true },
    });
    const dates = jobs.flatMap((j) => [j.scheduledAt, j.publicationTarget]).filter((d): d is Date => d !== null);
    const day = 24 * 60 * 60 * 1000;
    // ponytail: parallel test files share this DB and may insert outlier-dated
    // jobs; clamp the derived window to the API's 90-day max or it 400s.
    const maxRange = 90 * day - 2 * day;
    const latest = Math.max(...dates.map((d) => d.getTime())) + day;
    const earliest = Math.max(Math.min(...dates.map((d) => d.getTime())) - day, latest - maxRange);
    const range = `from=${new Date(earliest).toISOString()}&to=${new Date(latest).toISOString()}`;
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
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    // Deterministic: pick any seeded content that carries a publication-target
    // date (seed dates are relative to the run date), then build the window
    // around its own dates — no fixed range, no reliance on heap order.
    const content = await prisma.job.findFirst({
      where: { companyId: session.user.companyId!, publicationTarget: { not: null } },
      select: { id: true, clientId: true, scheduledAt: true, publicationTarget: true },
    });
    if (!content?.publicationTarget) throw new Error("fixture: no seeded content with a publication target");
    const clientId = content.clientId;
    const anchor = content.publicationTarget;
    // Ensure this client has both event types in the window: scheduling flows
    // through the canonical calendar write path (test 3 below exercises it too).
    const patched = await request(app)
      .patch(`/api/jobs/${content.id}`)
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`)
      .send({ scheduledAt: anchor.toISOString() });
    expect(patched.status).toBe(200);
    const day = 24 * 60 * 60 * 1000;
    const from = new Date(anchor.getTime() - day).toISOString();
    const to = new Date(anchor.getTime() + day).toISOString();
    const response = await request(app)
      .get(`/api/calendar?from=${from}&to=${to}&clientId=${clientId}`)
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(response.status).toBe(200);
    const types = new Set(response.body.events.map((event: any) => event.type));
    expect(types.has("SCHEDULED")).toBe(true);
    expect(types.has("PUBLICATION_TARGET")).toBe(true);
    expect(response.body.events.every((event: any) => event.client.id === clientId)).toBe(true);
    // Restore the seeded content's original scheduledAt so runs stay stable.
    await prisma.job.update({ where: { id: content.id }, data: { scheduledAt: content.scheduledAt } });
    await logout(prisma, session.token);
  });

  it("rejects invalid, reversed and oversized ranges", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    expect((await request(app).get("/api/calendar?from=nope&to=nope").set("Cookie", cookie)).status).toBe(400);
    expect((await request(app).get("/api/calendar?from=2026-08-20T00:00:00.000Z&to=2026-08-19T00:00:00.000Z").set("Cookie", cookie)).status).toBe(400);
    expect((await request(app).get("/api/calendar?from=2026-01-01T00:00:00.000Z&to=2026-05-01T00:00:00.000Z").set("Cookie", cookie)).status).toBe(400);
    expect((await request(app).get("/api/calendar?from=2026-08-16T00:00:00.000Z&to=2026-08-24T00:00:00.000Z&companyId=other").set("Cookie", cookie)).status).toBe(200);
    await logout(prisma, session.token);
  });

  it("requires CALENDAR capability/auth and keeps Job date mutation as write authority", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
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
      appointment: {
        findMany: async () => [{ id: "a1", title: "Appt 1", startsAt: new Date("2026-08-20T00:30:00.000Z"), client: { id: "c1", name: "C", brandColor: null } }],
      },
    };
    const result = await getCalendar(db, "company-a", { from: "2026-08-20T00:00:00.000Z", to: "2026-08-20T01:00:00.000Z", clientId: "c1" });
    expect(result.events.map((event) => event.type)).toEqual(["PUBLICATION_TARGET", "APPOINTMENT"]);
  });

  it("limits globally to 500 events and sets truncated flag", async () => {
    const jobsArr = Array.from({ length: 300 }).map((_, i) => ({ id: `j${i}`, title: `J${i}`, lifecycleStatus: "OPEN", publicationTarget: new Date("2026-08-20T00:00:00.000Z"), scheduledAt: null, client: null, currentStage: null }));
    const apptsArr = Array.from({ length: 300 }).map((_, i) => ({ id: `a${i}`, title: `A${i}`, startsAt: new Date("2026-08-20T00:30:00.000Z"), client: null }));
    
    const db: any = {
      company: { findUnique: async () => ({ timezone: "America/Sao_Paulo" }) },
      job: { findMany: async () => jobsArr },
      appointment: { findMany: async () => apptsArr },
    };
    const result = await getCalendar(db, "company-a", { from: "2026-08-20T00:00:00.000Z", to: "2026-08-20T01:00:00.000Z" });
    expect(result.events.length).toBe(500);
    expect(result.totalEvents).toBe(600);
    expect(result.truncated).toBe(true);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("Calendar appointment integration", () => {
  it("projects scheduled appointments respecting overlapping interval constraints", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    
    const client = await prisma.client.findFirst({ where: { companyId: session.user.companyId! } });
    
    // Create an appointment overlapping with the range
    const appt = await prisma.appointment.create({
      data: {
        companyId: session.user.companyId!,
        clientId: client?.id,
        title: "Test Overlap Appointment",
        startsAt: new Date("2026-08-20T09:00:00.000Z"),
        endsAt: new Date("2026-08-20T11:00:00.000Z"),
        status: "SCHEDULED"
      }
    });

    const response = await request(app)
      .get(`/api/calendar?from=2026-08-20T10:00:00.000Z&to=2026-08-20T12:00:00.000Z`)
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    
    expect(response.status).toBe(200);
    const event = response.body.events.find((e: any) => e.appointmentId === appt.id);
    expect(event).toBeDefined();
    expect(event.type).toBe("APPOINTMENT");
    expect(event.title).toBe("Test Overlap Appointment");
    
    // Create a cancelled appointment
    const cancelledAppt = await prisma.appointment.create({
      data: {
        companyId: session.user.companyId!,
        title: "Test Cancelled",
        startsAt: new Date("2026-08-20T10:30:00.000Z"),
        status: "CANCELLED"
      }
    });
    
    const response2 = await request(app)
      .get(`/api/calendar?from=2026-08-20T10:00:00.000Z&to=2026-08-20T12:00:00.000Z`)
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`);
      
    const cancelledEvent = response2.body.events.find((e: any) => e.appointmentId === cancelledAppt.id);
    expect(cancelledEvent).toBeUndefined(); // Should not be returned

    await logout(prisma, session.token);
    
    // cleanup
    await prisma.appointment.delete({ where: { id: appt.id } });
    await prisma.appointment.delete({ where: { id: cancelledAppt.id } });
  });
});
