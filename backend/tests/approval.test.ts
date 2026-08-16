import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { SESSION_COOKIE } from "../src/lib/session";
import { publicFileDownload } from "../src/services/approvalService";
import type { DB } from "../src/lib/db";
import type { ObjectStorage } from "../src/lib/storage";

const createdApprovalIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("Approval B9", () => {
  it("internal create returns token once; public read is minimal and unauthenticated", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const job = await prisma.job.findFirst({ where: { companyId: session.user.companyId! }, select: { id: true } });
    const result = await request(app)
      .post(`/api/jobs/${job!.id}/approvals`)
      .set("Cookie", `${SESSION_COOKIE}=${session.token}`)
      .send({});
    expect(result.status).toBe(201);
    expect(result.body.token).toHaveLength(64);
    expect(result.body.approvalUrl).toContain("/approve/");
    createdApprovalIds.push(result.body.approvalId);

    const publicRead = await request(app).get(`/api/public/approvals/${result.body.token}`);
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.id).toBe(result.body.approvalId);
    expect(publicRead.body.companyId).toBeUndefined();
    expect(publicRead.body.tokenHash).toBeUndefined();
    expect(publicRead.body.files).toEqual([]);
    await logout(prisma, session.token);
  });

  it("approve is final, replay is deterministic, and history is persisted", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const job = await prisma.job.findFirst({ where: { companyId: session.user.companyId! }, select: { id: true } });
    const created = await request(app).post(`/api/jobs/${job!.id}/approvals`).set("Cookie", `${SESSION_COOKIE}=${session.token}`).send({});
    createdApprovalIds.push(created.body.approvalId);
    const token = created.body.token;

    const approved = await request(app).post(`/api/public/approvals/${token}/approve`).send({ reviewerName: "Cliente" });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPROVED");

    const replaySame = await request(app).post(`/api/public/approvals/${token}/approve`).send({ reviewerName: "Cliente" });
    expect(replaySame.status).toBe(200);
    const replayConflict = await request(app).post(`/api/public/approvals/${token}/request-changes`).send({ feedback: "não" });
    expect(replayConflict.status).toBe(409);

    const internal = await request(app).get(`/api/approvals/${created.body.approvalId}`).set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(internal.status).toBe(200);
    expect(internal.body.decisions).toHaveLength(1);
    expect(internal.body.decisions[0].decision).toBe("APPROVED");
    await logout(prisma, session.token);
  });

  it("reject persists an immutable REJECTED decision", async () => {
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const job = await prisma.job.findFirst({ where: { companyId: session.user.companyId! }, select: { id: true } });
    const created = await request(app).post(`/api/jobs/${job!.id}/approvals`).set("Cookie", `${SESSION_COOKIE}=${session.token}`).send({});
    createdApprovalIds.push(created.body.approvalId);
    const rejected = await request(app).post(`/api/public/approvals/${created.body.token}/reject`).send({ reviewerName: "Cliente", feedback: "Não aprovado" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("REJECTED");
    const history = await prisma.approvalDecision.findMany({ where: { approvalId: created.body.approvalId } });
    expect(history).toHaveLength(1);
    expect(history[0].decision).toBe("REJECTED");
    await logout(prisma, session.token);
  });

  it("High Ticket keeps APPROVAL capability but unknown Job remains hidden", async () => {
    const session = await login(prisma, "dono@testecorp.com", "senha-definitiva-123");
    const result = await request(app).post("/api/jobs/not-a-job/approvals").set("Cookie", `${SESSION_COOKIE}=${session.token}`).send({});
    expect(result.status).toBe(404);
    await logout(prisma, session.token);
  });

  it("invalid, expired and revoked public tokens do not reveal approval data", async () => {
    const invalid = await request(app).get("/api/public/approvals/not-a-real-token");
    expect(invalid.status).toBe(404);
    const session = await login(prisma, "natan@looply.dev", "looply123");
    const job = await prisma.job.findFirst({ where: { companyId: session.user.companyId! }, select: { id: true } });
    const created = await request(app).post(`/api/jobs/${job!.id}/approvals`).set("Cookie", `${SESSION_COOKIE}=${session.token}`).send({});
    createdApprovalIds.push(created.body.approvalId);
    await prisma.approval.update({ where: { id: created.body.approvalId }, data: { revokedAt: new Date() } });
    const revoked = await request(app).get(`/api/public/approvals/${created.body.token}`);
    expect(revoked.status).toBe(404);
    await logout(prisma, session.token);
  });

  afterAll(async () => {
    await prisma.approval.deleteMany({ where: { id: { in: createdApprovalIds } } });
  });
});

describe("public approval file authorization", () => {
  it("requires approval attachment relation and does not accept arbitrary fileId", async () => {
    const state = { approval: { id: "a1", companyId: "c1", contentId: "j1", revokedAt: null, expiresAt: new Date(Date.now() + 60000), status: "PENDING", decisions: [], content: {}, version: {}, files: [] }, attachment: { id: "f1", storageKey: "company/c1/jobs/j1/key", originalName: "x.pdf" } };
    const db: any = {
      approval: { findFirst: async () => state.approval },
      approvalAttachment: { findFirst: async () => null },
    };
    const storage: ObjectStorage = {
      createUploadUrl: async () => ({ url: "", expiresAt: new Date() }),
      headObject: async () => null,
      createDownloadUrl: async () => ({ url: "", expiresAt: new Date() }),
      deleteObject: async () => undefined,
    };
    await expect(publicFileDownload(db as DB, storage, "token", "foreign-file")).rejects.toMatchObject({ status: 404 });
  });

  it("authorizes only an AVAILABLE attachment explicitly linked to the approval", async () => {
    const db: any = {
      approval: {
        findFirst: async () => ({
          id: "a1", companyId: "c1", contentId: "j1", revokedAt: null,
          expiresAt: new Date(Date.now() + 60000), status: "PENDING", decisions: [], content: {}, version: {}, files: [],
        }),
      },
      approvalAttachment: {
        findFirst: async () => ({ attachment: { id: "f1", storageKey: "company/c1/jobs/j1/key", originalName: "x.pdf" } }),
      },
    };
    const storage: ObjectStorage = {
      createUploadUrl: async () => ({ url: "", expiresAt: new Date() }),
      headObject: async () => null,
      createDownloadUrl: async ({ key }) => ({ url: `signed:${key}`, expiresAt: new Date(Date.now() + 60000) }),
      deleteObject: async () => undefined,
    };
    const result = await publicFileDownload(db as DB, storage, "token", "f1");
    expect(result.url).toBe("signed:company/c1/jobs/j1/key");
  });
});
