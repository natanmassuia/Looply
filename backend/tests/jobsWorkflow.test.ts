import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { seedCredentials } from "./seedCredentials";
import { tenantBLogin } from "./fixtures";
import { SESSION_COOKIE } from "../src/lib/session";
import { DEFAULT_WORKFLOW_STAGES } from "../src/domain/jobWorkflow";

const emailA = (): string => seedCredentials().email;
const cleanupJobs: string[] = [];
const cleanupClients: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("Jobs + Workflow + Activity", () => {
  it("default workflows are deterministic and idempotent per company", async () => {
    const a = await login(prisma, emailA(), seedCredentials().password);
    const b = await tenantBLogin(prisma);
    const [wa, wb] = await Promise.all([
      request(app).get("/api/workflows").set("Cookie", `${SESSION_COOKIE}=${a.token}`),
      request(app).get("/api/workflows").set("Cookie", `${SESSION_COOKIE}=${b.token}`),
    ]);
    expect(wa.status).toBe(200);
    expect(wb.status).toBe(200);
    expect(wa.body.workflows).toHaveLength(1);
    expect(wb.body.workflows).toHaveLength(1);
    expect(wa.body.workflows[0].companyId).toBe(a.user.companyId);
    expect(wb.body.workflows[0].companyId).toBe(b.user.companyId);
    // Archived (soft-deleted) stages are excluded from the active workflow, so
    // compare only the active default stages against the template.
    expect(wa.body.workflows[0].stages.filter((s: any) => s.active).map((s: any) => s.name)).toEqual(
      DEFAULT_WORKFLOW_STAGES.MARKETING_AGENCY.map((s) => s.name),
    );
    expect(wb.body.workflows[0].stages.filter((s: any) => s.active).map((s: any) => s.name)).toEqual(
      DEFAULT_WORKFLOW_STAGES.HIGH_TICKET.map((s) => s.name),
    );
    const again = await request(app).get("/api/workflows").set("Cookie", `${SESSION_COOKIE}=${a.token}`);
    expect(again.body.workflows[0].id).toBe(wa.body.workflows[0].id);
    await Promise.all([logout(prisma, a.token), logout(prisma, b.token)]);
  });

  it("creates a Job only with a same-tenant Client and records creation Activity", async () => {
    const a = await login(prisma, emailA(), seedCredentials().password);
    const b = await tenantBLogin(prisma);
    const clientA = await prisma.client.findFirst({ where: { companyId: a.user.companyId! }, select: { id: true } });
    const clientB = await prisma.client.create({ data: { companyId: b.user.companyId!, name: `B6 Client ${Date.now()}`, channels: [] } });
    cleanupClients.push(clientB.id);

    const foreign = await request(app)
      .post("/api/jobs")
      .set("Cookie", `${SESSION_COOKIE}=${a.token}`)
      .send({ title: "Foreign", clientId: clientB.id, companyId: b.user.companyId });
    expect(foreign.status).toBe(404);

    const created = await request(app)
      .post("/api/jobs")
      .set("Cookie", `${SESSION_COOKIE}=${a.token}`)
      .send({ title: "B6 Job", clientId: clientA!.id, companyId: b.user.companyId });
    expect(created.status).toBe(201);
    expect(created.body.companyId).toBe(a.user.companyId);
    expect(created.body.currentStageId).toBeTruthy();
    cleanupJobs.push(created.body.id);

    const activities = await request(app)
      .get(`/api/jobs/${created.body.id}/activity`)
      .set("Cookie", `${SESSION_COOKIE}=${a.token}`);
    expect(activities.status).toBe(200);
    expect(activities.body.activities).toHaveLength(1);
    expect(activities.body.activities[0].type).toBe("JOB_CREATED");
    expect(activities.body.activities[0].actorUserId).toBe(a.user.id);

    const moveToForeignClient = await request(app)
      .patch(`/api/jobs/${created.body.id}`)
      .set("Cookie", `${SESSION_COOKIE}=${a.token}`)
      .send({ clientId: clientB.id });
    expect(moveToForeignClient.status).toBe(404);

    const foreignRead = await request(app)
      .get(`/api/jobs/${created.body.id}`)
      .set("Cookie", `${SESSION_COOKIE}=${b.token}`);
    expect(foreignRead.status).toBe(404);
    const foreignActivity = await request(app)
      .get(`/api/jobs/${created.body.id}/activity`)
      .set("Cookie", `${SESSION_COOKIE}=${b.token}`);
    expect(foreignActivity.status).toBe(404);
    await Promise.all([logout(prisma, a.token), logout(prisma, b.token)]);
  });

  it("transition validates stage/workflow ownership and records Activity atomically", async () => {
    const a = await login(prisma, emailA(), seedCredentials().password);
    const workflow = (await request(app).get("/api/workflows").set("Cookie", `${SESSION_COOKIE}=${a.token}`)).body.workflows[0];
    // Create a fresh job via the API so it is attached to the default workflow
    // (seeded contents have no workflow binding).
    const clientRes = await request(app).get("/api/clients").set("Cookie", `${SESSION_COOKIE}=${a.token}`);
    const clientId = clientRes.body.clients?.[0]?.id ?? clientRes.body?.[0]?.id;
    const created = await request(app)
      .post("/api/jobs")
      .set("Cookie", `${SESSION_COOKIE}=${a.token}`)
      .send({ title: "B6 Transition Job", clientId });
    expect(created.status).toBe(201);
    cleanupJobs.push(created.body.id);
    const job = { id: created.body.id as string, currentStageId: created.body.currentStageId as string };
    // R1.2 — protected stages (semanticKey) cannot be entered by a generic
    // drag, so pick a custom stage for this generic-transition assertion.
    const nextStage = workflow.stages.find((s: any) => s.id !== job.currentStageId && !s.semanticKey);
    const moved = await request(app)
      .post(`/api/jobs/${job.id}/transition`)
      .set("Cookie", `${SESSION_COOKIE}=${a.token}`)
      .send({ stageId: nextStage.id });
    expect(moved.status).toBe(200);
    const activity = await prisma.activity.findFirst({ where: { companyId: a.user.companyId!, jobId: job.id, type: "JOB_STAGE_CHANGED" } });
    expect(activity?.actorUserId).toBe(a.user.id);

    const b = await tenantBLogin(prisma);
    const foreignStage = (await request(app).get("/api/workflows").set("Cookie", `${SESSION_COOKIE}=${b.token}`)).body.workflows[0].stages[0];
    const denied = await request(app)
      .post(`/api/jobs/${job.id}/transition`)
      .set("Cookie", `${SESSION_COOKIE}=${b.token}`)
      .send({ stageId: foreignStage.id });
    expect(denied.status).toBe(404);
    await Promise.all([logout(prisma, a.token), logout(prisma, b.token)]);
  });

  it("lists only the authenticated tenant's Jobs", async () => {
    const a = await login(prisma, emailA(), seedCredentials().password);
    const b = await tenantBLogin(prisma);
    const [ra, rb] = await Promise.all([
      request(app).get("/api/jobs").set("Cookie", `${SESSION_COOKIE}=${a.token}`),
      request(app).get("/api/jobs").set("Cookie", `${SESSION_COOKIE}=${b.token}`),
    ]);
    expect(ra.body.jobs.jobs.every((j: any) => j.companyId === a.user.companyId)).toBe(true);
    expect(rb.body.jobs.jobs.every((j: any) => j.companyId === b.user.companyId)).toBe(true);
    expect(ra.body.jobs.jobs.map((j: any) => j.id).filter((id: string) => rb.body.jobs.jobs.some((j: any) => j.id === id))).toEqual([]);
    await Promise.all([logout(prisma, a.token), logout(prisma, b.token)]);
  });

  it("list supports bounded filters and summary counts stay tenant-scoped", async () => {
    const a = await login(prisma, emailA(), seedCredentials().password);
    const filtered = await request(app)
      .get("/api/jobs?lifecycleStatus=OPEN&sort=title&direction=asc&page=1&limit=2")
      .set("Cookie", `${SESSION_COOKIE}=${a.token}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.jobs.limit).toBe(2);
    expect(filtered.body.jobs.jobs.length).toBeLessThanOrEqual(2);
    expect(filtered.body.jobs.jobs.every((job: any) => job.companyId === a.user.companyId)).toBe(true);

    const summary = await request(app).get("/api/jobs/summary").set("Cookie", `${SESSION_COOKIE}=${a.token}`);
    expect(summary.status).toBe(200);
    expect(summary.body.byStage.reduce((sum: number, row: any) => sum + row.count, 0)).toBeGreaterThan(0);
    await logout(prisma, a.token);
  });

  it("board is a read-only stage projection and respects KANBAN capability", async () => {
    const a = await login(prisma, emailA(), seedCredentials().password);
    const boardA = await request(app).get("/api/jobs/board").set("Cookie", `${SESSION_COOKIE}=${a.token}`);
    expect(boardA.status).toBe(200);
    expect(boardA.body.stages.length).toBeGreaterThan(0);
    const returnedJobs = boardA.body.stages.flatMap((stage: any) => stage.jobs);
    expect(new Set(returnedJobs.map((job: any) => job.id)).size).toBe(returnedJobs.length);
    for (const stage of boardA.body.stages) {
      expect(stage.jobs.every((job: any) => job.currentStageId === stage.id)).toBe(true);
    }
    await logout(prisma, a.token);

    const b = await tenantBLogin(prisma);
    const boardB = await request(app).get("/api/jobs/board").set("Cookie", `${SESSION_COOKIE}=${b.token}`);
    expect(boardB.status).toBe(403); // HIGH_TICKET has JOBS/WORKFLOW, not KANBAN
    await logout(prisma, b.token);
  });

  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { jobId: { in: cleanupJobs } } });
    await prisma.job.deleteMany({ where: { id: { in: cleanupJobs } } });
    await prisma.client.deleteMany({ where: { id: { in: cleanupClients } } });
  });
});
