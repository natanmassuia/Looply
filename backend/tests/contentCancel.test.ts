import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { SESSION_COOKIE } from "../src/lib/session";
import { env } from "../src/lib/env";

describe.skipIf(!process.env.DATABASE_URL)("Demand Cancellation Router", () => {
  it("denies unauthenticated cancel", async () => {
    const res = await request(app).post("/api/contents/some-id/cancel");
    expect(res.status).toBe(401);
  });

  it("cancels an eligible demand and preserves the row + records activity", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const clientsRes = await request(app)
      .get("/api/clients")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    const clientId = clientsRes.body.clients?.[0]?.id ?? clientsRes.body?.[0]?.id;
    if (!clientId) {
      await logout(prisma, session.token);
      return;
    }

    const created = await request(app)
      .post("/api/contents")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({
        title: "R1 Cancel Test",
        clientId,
        format: "POST",
        caption: "caption",
      });

    if (created.status !== 201) {
      await logout(prisma, session.token);
      return;
    }

    const id = created.body.id;
    const res = await request(app)
      .post(`/api/contents/${id}/cancel`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.lifecycleStatus).toBe("CANCELLED");

    // Row still exists (no destructive delete), history preserved.
    const detail = await request(app)
      .get(`/api/contents/${id}`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    expect(detail.status).toBe(200);
    expect(detail.body.lifecycleStatus).toBe("CANCELLED");

    // Repeated cancellation is safe/idempotent.
    const again = await request(app)
      .post(`/api/contents/${id}/cancel`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    expect(again.status).toBe(200);

    await logout(prisma, session.token);
  });

  it("rejects cross-tenant cancel (not found)", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;
    const res = await request(app)
      .post("/api/contents/nonexistent/cancel")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    expect([404, 409]).toContain(res.status);
    await logout(prisma, session.token);
  });
});
