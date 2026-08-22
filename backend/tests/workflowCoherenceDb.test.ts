import { describe, expect, it, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { seedCredentials } from "./seedCredentials";
import { SESSION_COOKIE } from "../src/lib/session";
import { env } from "../src/lib/env";

// Jobs created by this suite are removed at the end so the shared dev DB does
// not accumulate residue across runs (their versions/approvals/activities
// cascade on delete).
const createdJobIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("Workflow semantic coherence (R1.2, DB-gated)", () => {
  it("scheduling a demand sets status=SCHEDULED and currentStageId to the SCHEDULED semantic stage", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const clientRes = await request(app).get("/api/clients").set("Cookie", cookie);
    const clientId = clientRes.body.clients?.[0]?.id ?? clientRes.body?.[0]?.id;
    if (!clientId) { await logout(prisma, session.token); return; }

    const created = await request(app)
      .post("/api/contents")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "R1.2 Coherence Schedule", clientId, format: "POST", caption: "cap" });
    if (created.status !== 201) { await logout(prisma, session.token); return; }
    const id = created.body.id;
    createdJobIds.push(id);

    // R1.3 — the legacy generic-status APPROVED path is closed. Approve through
    // the canonical flow: review → send-approval → client decision.
    await request(app).post(`/api/contents/${id}/review`).set("Cookie", cookie).set("Origin", env.CORS_ORIGIN);
    const sent = await request(app)
      .post(`/api/contents/${id}/send-approval`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    expect(sent.status).toBe(200);
    const approved = await request(app)
      .post(`/api/public/approvals/${sent.body.token}/approve`)
      .set("Origin", env.CORS_ORIGIN)
      .send({ reviewerName: "Cliente" });
    expect(approved.status).toBe(200);

    // Schedule (canonical endpoint).
    const sched = await request(app)
      .post(`/api/contents/${id}/schedule`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ scheduledAt: "2026-09-10T10:00:00.000Z" });
    expect(sched.status).toBe(200);
    expect(sched.body.status).toBe("SCHEDULED");

    // currentStageId resolves to a SCHEDULED semantic stage.
    const stage = await prisma.workflowStage.findFirst({
      where: { id: sched.body.currentStageId, semanticKey: "SCHEDULED" },
    });
    expect(stage).not.toBeNull();

    await logout(prisma, session.token);
  });

  it("generic stage transition into a SCHEDULED semantic stage is rejected", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const wfRes = await request(app).get("/api/workflows").set("Cookie", cookie);
    const wf = wfRes.body.workflows[0];
    const scheduledStage = wf.stages.find((s: any) => s.semanticKey === "SCHEDULED");

    // Need a job that belongs to this workflow. Create one.
    const clientRes = await request(app).get("/api/clients").set("Cookie", cookie);
    const clientId = clientRes.body.clients?.[0]?.id ?? clientRes.body?.[0]?.id;
    if (!clientId || !scheduledStage) { await logout(prisma, session.token); return; }
    const created = await request(app)
      .post("/api/contents")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "R1.2 Bypass Test", clientId, format: "POST", caption: "cap" });
    if (created.status !== 201) { await logout(prisma, session.token); return; }
    const id = created.body.id;
    createdJobIds.push(id);

    const res = await request(app)
      .post(`/api/jobs/${id}/transition`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ stageId: scheduledStage.id });
    expect([400, 409]).toContain(res.status);

    await logout(prisma, session.token);
  });

  it("user cannot set a protected semanticKey via the workflow stage API", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const wfRes = await request(app).get("/api/workflows").set("Cookie", cookie);
    const wf = wfRes.body.workflows[0];

    // Attempt to create a custom stage while smuggling a protected semanticKey.
    const res = await request(app)
      .post(`/api/workflows/${wf.id}/stages`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ name: "R1.2 Temp Injected", semanticKey: "SCHEDULED" });

    // The API accepts a name-only payload; the injected semanticKey is ignored.
    expect([201, 200]).toContain(res.status);
    const stage = await prisma.workflowStage.findFirst({
      where: { id: res.body?.id ?? "", semanticKey: "SCHEDULED" },
    });
    // The created stage must NOT carry a protected semantic.
    expect(stage?.semanticKey ?? null).toBeNull();

    // Physical cleanup (removeStage archives; here we delete the temp row directly
    // so no archived test stage leaks into the live workflow API).
    if (res.body?.id) {
      await prisma.workflowStage.deleteMany({
        where: {
          id: res.body.id,
          name: "R1.2 Temp Injected",
          semanticKey: null,
        },
      });
    }
    await logout(prisma, session.token);
  });

  it("generic PATCH status cannot force SCHEDULED directly (Appointment is authoritative)", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const clientRes = await request(app).get("/api/clients").set("Cookie", cookie);
    const clientId = clientRes.body.clients?.[0]?.id ?? clientRes.body?.[0]?.id;
    if (!clientId) { await logout(prisma, session.token); return; }
    const created = await request(app)
      .post("/api/contents")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "R1.2 PATCH SCHEDULED Block", clientId, format: "POST", caption: "cap" });
    if (created.status !== 201) { await logout(prisma, session.token); return; }
    const id = created.body.id;
    createdJobIds.push(id);

    const res = await request(app)
      .patch(`/api/contents/${id}/status`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ status: "SCHEDULED" });
    expect(res.status).toBe(409);

    const after = await prisma.job.findFirst({ where: { id, companyId: session.user.companyId! } });
    expect(after?.status).not.toBe("SCHEDULED");
    expect(after?.scheduledAt).toBeNull();

    await logout(prisma, session.token);
  });

  it("client approval sets status=APPROVED and moves currentStageId to the APPROVED semantic stage", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const clientRes = await request(app).get("/api/clients").set("Cookie", cookie);
    const clientId = clientRes.body.clients?.[0]?.id ?? clientRes.body?.[0]?.id;
    if (!clientId) { await logout(prisma, session.token); return; }
    const created = await request(app)
      .post("/api/contents")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "R1.2 Approval Coherence", clientId, format: "POST", caption: "cap" });
    if (created.status !== 201) { await logout(prisma, session.token); return; }
    const id = created.body.id;
    createdJobIds.push(id);

    await request(app).post(`/api/contents/${id}/review`).set("Cookie", cookie).set("Origin", env.CORS_ORIGIN);
    const sent = await request(app).post(`/api/contents/${id}/send-approval`).set("Cookie", cookie).set("Origin", env.CORS_ORIGIN);
    expect(sent.status).toBe(200);
    expect(sent.body.token).toBeTruthy();

    const approved = await request(app)
      .post(`/api/public/approvals/${sent.body.token}/approve`)
      .set("Origin", env.CORS_ORIGIN)
      .send({ reviewerName: "Cliente" });
    expect(approved.status).toBe(200);

    const after = await prisma.job.findFirst({
      where: { id, companyId: session.user.companyId! },
      include: { currentStage: { select: { semanticKey: true } } },
    });
    expect(after?.status).toBe("APPROVED");
    expect(after?.currentStage?.semanticKey).toBe("APPROVED");

    await logout(prisma, session.token);
  });

  it("legacy PATCH status cannot force APPROVED while an approval is pending (R1.3 remediation)", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const clientRes = await request(app).get("/api/clients").set("Cookie", cookie);
    const clientId = clientRes.body.clients?.[0]?.id ?? clientRes.body?.[0]?.id;
    if (!clientId) { await logout(prisma, session.token); return; }
    const created = await request(app)
      .post("/api/contents")
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ title: "R1.3 PATCH APPROVED Block", clientId, format: "POST", caption: "cap" });
    if (created.status !== 201) { await logout(prisma, session.token); return; }
    const id = created.body.id;
    createdJobIds.push(id);

    // Move the demand into AWAITING_CLIENT with a real pending canonical Approval.
    await request(app).post(`/api/contents/${id}/review`).set("Cookie", cookie).set("Origin", env.CORS_ORIGIN);
    const sent = await request(app)
      .post(`/api/contents/${id}/send-approval`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN);
    expect(sent.status).toBe(200);
    const token = sent.body.token;
    const approval = await prisma.approval.findFirst({ where: { contentId: id, status: "PENDING" } });
    expect(approval).not.toBeNull();
    const before = await prisma.job.findFirst({ where: { id, companyId: session.user.companyId! } });
    expect(before?.status).toBe("AWAITING_CLIENT");

    // A generic status write must be rejected unconditionally — even from
    // AWAITING_CLIENT — because it is not an approval decision.
    const res = await request(app)
      .patch(`/api/contents/${id}/status`)
      .set("Cookie", cookie)
      .set("Origin", env.CORS_ORIGIN)
      .send({ status: "APPROVED" });
    expect(res.status).toBe(409);

    const after = await prisma.job.findFirst({ where: { id, companyId: session.user.companyId! } });
    expect(after?.status).toBe("AWAITING_CLIENT");
    expect(after?.currentStageId).toBe(before?.currentStageId);

    // The canonical Approval stays undecided; no decision row or activity.
    const stillPending = await prisma.approval.findFirst({ where: { id: approval!.id } });
    expect(stillPending?.status).toBe("PENDING");
    expect(stillPending?.decidedAt).toBeNull();
    expect(await prisma.approvalDecision.count({ where: { approvalId: approval!.id } })).toBe(0);
    expect(await prisma.activity.count({ where: { jobId: id, type: "APPROVAL_APPROVED" } })).toBe(0);

    // The canonical approval flow still approves and syncs the stage.
    const approved = await request(app)
      .post(`/api/public/approvals/${token}/approve`)
      .set("Origin", env.CORS_ORIGIN)
      .send({ reviewerName: "Cliente" });
    expect(approved.status).toBe(200);
    const finalJob = await prisma.job.findFirst({
      where: { id, companyId: session.user.companyId! },
      include: { currentStage: { select: { semanticKey: true } } },
    });
    expect(finalJob?.status).toBe("APPROVED");
    expect(finalJob?.currentStage?.semanticKey).toBe("APPROVED");

    await logout(prisma, session.token);
  });

  afterAll(async () => {
    if (createdJobIds.length > 0) {
      await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    }
  });
});
