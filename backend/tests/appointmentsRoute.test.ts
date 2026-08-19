import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { SESSION_COOKIE } from "../src/lib/session";
import { env } from "../src/lib/env";

describe.skipIf(!process.env.DATABASE_URL)("Appointments Router", () => {
  it("denies unauthenticated read", async () => {
    const res = await request(app).get("/api/appointments");
    expect(res.status).toBe(401);
  });

  it("denies unauthenticated create", async () => {
    const res = await request(app)
      .post("/api/appointments")
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "T", startsAt: new Date().toISOString() });
    expect(res.status).toBe(401);
  });

  it("authenticated CALENDAR user allowed to create", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const res = await request(app)
      .post("/api/appointments")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "Create API Test", startsAt: "2026-09-01T10:00:00.000Z" });
    if (res.status !== 201) console.log(res.body); expect(res.status).toBe(201);
    expect(res.body.title).toBe("Create API Test");
    expect(res.body.companyId).toBe(session.user.companyId);
    expect(res.body.createdByUserId).toBe(session.user.id);
    await logout(prisma, session.token);
  });

  it("rejects invalid startsAt", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const res = await request(app)
      .post("/api/appointments")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "Test", startsAt: "invalid" });
    expect(res.status).toBe(400);
    await logout(prisma, session.token);
  });

  it("rejects invalid interval from service", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const res = await request(app)
      .post("/api/appointments")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "Test", startsAt: "2026-09-01T10:00:00.000Z", endsAt: "2026-09-01T09:00:00.000Z" });
    expect(res.status).toBe(400);
    await logout(prisma, session.token);
  });

  it("cannot spoof tenant or creator", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const res = await request(app)
      .post("/api/appointments")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "Test", startsAt: "2026-09-01T10:00:00.000Z", companyId: "other", createdByUserId: "other", status: "CANCELLED" });
    if (res.status !== 201) console.log(res.body); expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(session.user.companyId);
    expect(res.body.createdByUserId).toBe(session.user.id);
    expect(res.body.status).toBe("SCHEDULED");
    await logout(prisma, session.token);
  });

  it("GET list returns own tenant only and parses limit", async () => {
    const session1 = await login(prisma, "natan@looply.dev", "looply123");
    const cookie1 = `${SESSION_COOKIE}=${session1.token}`;
    
    await request(app)
      .post("/api/appointments")
      .set("Cookie", cookie1)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "T1", startsAt: "2026-09-01T10:00:00.000Z" });

    const res1 = await request(app)
      .get("/api/appointments?limit=1")
      .set("Cookie", cookie1);
    
    expect(res1.status).toBe(200);
    expect(res1.body.appointments.length).toBeLessThanOrEqual(1);
    expect(res1.body.appointments[0].companyId).toBe(session1.user.companyId);
    
    await logout(prisma, session1.token);
  });

  it("GET list rejects an invalid status filter with validation_error", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const res = await request(app)
      .get("/api/appointments?status=NOT_A_STATUS")
      .set("Cookie", cookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    await logout(prisma, session.token);
  });

  it("GET detail own resource and 404 for foreign", async () => {
    const session1 = await login(prisma, "natan@looply.dev", "looply123");
    const session2 = await login(prisma, "dono@testecorp.com", "senha-definitiva-123");
    const appt = await request(app)
      .post("/api/appointments")
      .set("Cookie", `${SESSION_COOKIE}=${session1.token}`)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "T1", startsAt: "2026-09-01T10:00:00.000Z" });

    const id = appt.body.id;
    
    const resOwn = await request(app)
      .get(`/api/appointments/${id}`)
      .set("Cookie", `${SESSION_COOKIE}=${session1.token}`);
    expect(resOwn.status).toBe(200);

    const resForeign = await request(app)
      .get(`/api/appointments/${id}`)
      .set("Cookie", `${SESSION_COOKIE}=${session2.token}`);
    expect(resForeign.status).toBe(404);

    await logout(prisma, session1.token);
    await logout(prisma, session2.token);
  });

  it("PATCH title succeeds and cannot mutate protected fields", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const appt = await request(app)
      .post("/api/appointments")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "T1", startsAt: "2026-09-01T10:00:00.000Z" });

    const id = appt.body.id;
    
    const res = await request(app)
      .patch(`/api/appointments/${id}`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "New", status: "CANCELLED" });
      
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New");
    expect(res.body.status).toBe("SCHEDULED");

    await logout(prisma, session.token);
  });

  it("POST cancel succeeds idempotently", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const appt = await request(app)
      .post("/api/appointments")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "ToCancel", startsAt: "2026-09-01T10:00:00.000Z" });

    const id = appt.body.id;
    
    const res1 = await request(app)
      .post(`/api/appointments/${id}/cancel`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe("CANCELLED");

    const res2 = await request(app)
      .post(`/api/appointments/${id}/cancel`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    expect(res2.status).toBe(200);

    const patchCancelled = await request(app)
      .patch(`/api/appointments/${id}`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "WillFail" });
    expect(patchCancelled.status).toBe(409);

    await logout(prisma, session.token);
  });
});
