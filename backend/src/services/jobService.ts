import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import { createActivity } from "./activityService";
import { assertStageInWorkflow, ensureDefaultWorkflow } from "./workflowService";
import type { JobLifecycleStatus } from "@prisma/client";

export interface CreateJobInput {
  title: string;
  clientId: string;
  notes?: string;
  format?: "POST" | "REELS" | "STORY" | "CAROUSEL" | "VIDEO" | "IMAGE";
}

export async function listJobs(db: DB, companyId: string) {
  return db.job.findMany({
    where: { companyId },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, brandColor: true } },
      workflow: { select: { id: true, name: true, template: true } },
      currentStage: { select: { id: true, name: true, position: true, terminal: true } },
    },
  });
}

export async function getJob(db: DB, companyId: string, jobId: string) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    include: {
      client: true,
      workflow: { include: { stages: { orderBy: { position: "asc" } } } },
      currentStage: true,
      activities: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!job) throw notFound("Job não encontrado");
  return job;
}

export async function createJob(db: DB, companyId: string, actorUserId: string, input: CreateJobInput) {
  const client = await db.client.findFirst({ where: { id: input.clientId, companyId }, select: { id: true } });
  if (!client) throw notFound("Cliente não encontrado");
  const workflow = await ensureDefaultWorkflow(db, companyId);
  const firstStage = workflow.stages[0];
  if (!firstStage) throw conflict("Workflow sem stages");

  return db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        companyId,
        clientId: input.clientId,
        title: input.title,
        notes: input.notes ?? null,
        format: input.format ?? "POST",
        status: "DRAFT",
        lifecycleStatus: "OPEN",
        workflowId: workflow.id,
        currentStageId: firstStage.id,
      },
    });
    await createActivity(tx, {
      companyId,
      jobId: job.id,
      actorUserId,
      type: "JOB_CREATED",
      metadata: { stageId: firstStage.id },
    });
    return job;
  });
}

export async function updateJob(
  db: DB,
  companyId: string,
  actorUserId: string,
  jobId: string,
  input: { title?: string; notes?: string; clientId?: string; lifecycleStatus?: JobLifecycleStatus },
) {
  const existing = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true, clientId: true, lifecycleStatus: true } });
  if (!existing) throw notFound("Job não encontrado");
  if (input.clientId) {
    const client = await db.client.findFirst({ where: { id: input.clientId, companyId }, select: { id: true } });
    if (!client) throw notFound("Cliente não encontrado");
  }
  const data = {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.clientId === undefined ? {} : { clientId: input.clientId }),
    ...(input.lifecycleStatus === undefined ? {} : { lifecycleStatus: input.lifecycleStatus }),
  };
  return db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({ where: { id: jobId, companyId }, data });
    if (updated.count === 0) throw notFound("Job não encontrado");
    await createActivity(tx, {
      companyId,
      jobId,
      actorUserId,
      type: input.lifecycleStatus === "COMPLETED" ? "JOB_COMPLETED" : input.lifecycleStatus === "CANCELLED" ? "JOB_CANCELLED" : "JOB_UPDATED",
      metadata: { fields: Object.keys(data) },
    });
    return tx.job.findFirst({ where: { id: jobId, companyId } });
  });
}

export async function transitionJob(db: DB, companyId: string, actorUserId: string, jobId: string, stageId: string) {
  const job = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true, workflowId: true, currentStageId: true } });
  if (!job) throw notFound("Job não encontrado");
  if (!job.workflowId) throw conflict("Job sem workflow");
  const stage = await assertStageInWorkflow(db, companyId, job.workflowId, stageId);
  if (job.currentStageId === stage.id) throw badRequest("Job já está neste stage");

  return db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({ where: { id: jobId, companyId, workflowId: job.workflowId }, data: { currentStageId: stage.id } });
    if (updated.count === 0) throw notFound("Job não encontrado");
    await createActivity(tx, {
      companyId,
      jobId,
      actorUserId,
      type: "JOB_STAGE_CHANGED",
      metadata: { fromStageId: job.currentStageId, toStageId: stage.id },
    });
    return tx.job.findFirst({ where: { id: jobId, companyId }, include: { currentStage: true } });
  });
}
