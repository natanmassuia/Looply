import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import { createActivity } from "./activityService";
import { assertStageInWorkflow } from "./workflowService";
import type { JobLifecycleStatus, ContentStatus } from "@prisma/client";
import { getWorkflow, ensureDefaultWorkflow } from "./workflowService";

export interface CreateJobInput {
  title: string;
  clientId: string;
  notes?: string;
  format?: "POST" | "REELS" | "STORY" | "CAROUSEL" | "VIDEO" | "IMAGE";
}

export interface JobListQuery {
  clientId?: string;
  workflowId?: string;
  stageId?: string;
  lifecycleStatus?: JobLifecycleStatus;
  search?: string;
  sort?: "updatedAt" | "createdAt" | "title";
  direction?: "asc" | "desc";
  page?: number;
  limit?: number;
}

const LIFECYCLE_TRANSITIONS: Record<JobLifecycleStatus, readonly JobLifecycleStatus[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function listJobs(db: DB, companyId: string, query: JobListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const where = {
    companyId,
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.workflowId ? { workflowId: query.workflowId } : {}),
    ...(query.stageId ? { currentStageId: query.stageId } : {}),
    ...(query.lifecycleStatus ? { lifecycleStatus: query.lifecycleStatus } : {}),
    ...(query.search ? {
      OR: [
        { title: { contains: query.search, mode: "insensitive" as const } },
        { client: { name: { contains: query.search, mode: "insensitive" as const } } },
      ],
    } : {}),
  };
  const orderBy = { [query.sort ?? "updatedAt"]: query.direction ?? "desc" } as const;
  const [total, jobs] = await Promise.all([
    db.job.count({ where }),
    db.job.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        companyId: true,
        client: { select: { id: true, name: true, brandColor: true } },
        lifecycleStatus: true,
        status: true,
        workflow: { select: { id: true, name: true, template: true } },
        currentStage: { select: { id: true, name: true, position: true, terminal: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  return { jobs, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getJobBoard(db: DB, companyId: string, workflowId?: string) {
  const workflow = workflowId
    ? await getWorkflow(db, companyId, workflowId)
    : await ensureDefaultWorkflow(db, companyId);
  const jobs = await db.job.findMany({
    where: { companyId, workflowId: workflow.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      companyId: true,
      client: { select: { id: true, name: true, brandColor: true } },
      lifecycleStatus: true,
      status: true,
      currentStageId: true,
      updatedAt: true,
    },
  });
  const grouped = workflow.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    position: stage.position,
    terminal: stage.terminal,
    count: jobs.filter((job) => job.currentStageId === stage.id).length,
    jobs: jobs.filter((job) => job.currentStageId === stage.id),
  }));
  return {
    workflow: { id: workflow.id, name: workflow.name, template: workflow.template },
    stages: grouped,
    unassignedCount: jobs.filter((job) => !job.currentStageId).length,
  };
}

export async function getJobSummary(db: DB, companyId: string) {
  const [byStage, byLifecycle] = await Promise.all([
    db.job.groupBy({ by: ["currentStageId"], where: { companyId }, _count: { _all: true } }),
    db.job.groupBy({ by: ["lifecycleStatus"], where: { companyId }, _count: { _all: true } }),
  ]);
  return {
    byStage: byStage.map((row) => ({ stageId: row.currentStageId, count: row._count._all })),
    byLifecycle: byLifecycle.map((row) => ({ lifecycleStatus: row.lifecycleStatus, count: row._count._all })),
  };
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

export async function createJob(db: DB, companyId: string, actorUserId: string | null, input: CreateJobInput) {
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
      actorUserId: actorUserId ?? undefined,
      type: "JOB_CREATED",
      metadata: { stageId: firstStage.id },
    });
    return job;
  });
}

export async function updateJob(
  db: DB,
  companyId: string,
  actorUserId: string | null,
  jobId: string,
  input: {
    title?: string;
    notes?: string;
    clientId?: string;
    lifecycleStatus?: JobLifecycleStatus;
    publicationTarget?: string | null;
    scheduledAt?: string | null;
  },
) {
  const existing = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true, clientId: true } });
  if (!existing) throw notFound("Job não encontrado");
  if (input.clientId) {
    const client = await db.client.findFirst({ where: { id: input.clientId, companyId }, select: { id: true } });
    if (!client) throw notFound("Cliente não encontrado");
  }
  const parseDate = (value: string | null | undefined) => {
    if (value === undefined || value === null) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw badRequest("Data inválida");
    return date;
  };
  const data = {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.clientId === undefined ? {} : { clientId: input.clientId }),
    ...(input.publicationTarget === undefined ? {} : { publicationTarget: parseDate(input.publicationTarget) }),
    ...(input.scheduledAt === undefined ? {} : { scheduledAt: parseDate(input.scheduledAt) }),
  };
  return db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({ where: { id: jobId, companyId }, data });
    if (updated.count === 0) throw notFound("Job não encontrado");
    await createActivity(tx, {
      companyId,
      jobId,
      actorUserId: actorUserId ?? undefined,
      type: "JOB_UPDATED",
      metadata: { fields: Object.keys(data) },
    });
    return tx.job.findFirst({ where: { id: jobId, companyId } });
  });
}

export async function transitionJobLifecycle(
  db: DB,
  companyId: string,
  actorUserId: string | null,
  jobId: string,
  targetStatus: JobLifecycleStatus,
) {
  const existing = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: { id: true, companyId: true, lifecycleStatus: true },
  });
  if (!existing) throw notFound("Job não encontrado");
  if (existing.lifecycleStatus === targetStatus) {
    if (targetStatus === "CANCELLED") return existing;
    throw conflict("Job já está neste lifecycle");
  }
  if (!LIFECYCLE_TRANSITIONS[existing.lifecycleStatus].includes(targetStatus)) {
    throw conflict("Transição de lifecycle inválida");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({
      where: { id: jobId, companyId, lifecycleStatus: existing.lifecycleStatus },
      data: { lifecycleStatus: targetStatus },
    });
    if (updated.count === 0) throw notFound("Job não encontrado");
    await createActivity(tx, {
      companyId,
      jobId,
      actorUserId: actorUserId ?? undefined,
      type: targetStatus === "COMPLETED" ? "JOB_COMPLETED" : targetStatus === "CANCELLED" ? "JOB_CANCELLED" : "JOB_UPDATED",
      metadata: { fromLifecycleStatus: existing.lifecycleStatus, toLifecycleStatus: targetStatus },
    });
    return tx.job.findFirst({ where: { id: jobId, companyId } });
  });
}

export async function transitionJob(db: DB, companyId: string, actorUserId: string, jobId: string, stageId: string) {
  const job = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true, workflowId: true, currentStageId: true, status: true } });
  if (!job) throw notFound("Job não encontrado");
  if (!job.workflowId) throw conflict("Job sem workflow");
  const stage = await assertStageInWorkflow(db, companyId, job.workflowId, stageId);
  if (job.currentStageId === stage.id) throw badRequest("Job já está neste stage");

  // R1.2 — protected semantics: a generic stage transition must NOT bypass the
  // special domain operations. Moving directly into a SCHEDULED semantic stage
  // is rejected; the canonical Appointment/scheduling flow is the only path.
  if (stage.semanticKey === "SCHEDULED") {
    throw conflict("Movimento direto para a etapa de agendamento não é permitido; use o fluxo de agendamento");
  }
  // APPROVED keeps the existing approval domain rules: status can only become
  // APPROVED through the approval flow, so the stage may only be entered once
  // the job is already APPROVED. Labels never drive this — only semanticKey.
  if (stage.semanticKey === "APPROVED" && job.status !== "APPROVED") {
    throw conflict("Movimento direto para a etapa de aprovação não é permitido; o status APPROVED só muda pelo fluxo de aprovação");
  }

  // Build a coherent write: stage location always updates; when the target
  // stage carries a protected semantic, the status/lifecycle reconciles.
  const data: { currentStageId: string; status?: ContentStatus; lifecycleStatus?: JobLifecycleStatus } = { currentStageId: stage.id };
  if (stage.semanticKey === "APPROVED") data.status = "APPROVED";
  if (stage.semanticKey === "COMPLETED") data.lifecycleStatus = "COMPLETED";

  return db.$transaction(async (tx) => {
    const updated = await tx.job.updateMany({ where: { id: jobId, companyId, workflowId: job.workflowId }, data });
    if (updated.count === 0) throw notFound("Job não encontrado");
    await createActivity(tx, {
      companyId,
      jobId,
      actorUserId,
      type: "JOB_STAGE_CHANGED",
      metadata: { fromStageId: job.currentStageId, toStageId: stage.id, semanticKey: stage.semanticKey ?? null },
    });
    return tx.job.findFirst({ where: { id: jobId, companyId }, include: { currentStage: true } });
  });
}
