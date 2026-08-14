import type { DB } from "../lib/db";
import {
  assertCanTransition,
  nextVersionNumber,
  type ContentStatus,
} from "../domain/workflow";
import {
  AppError,
  badRequest,
  notFound,
} from "../lib/errors";
import type { CreateContentInput, CreateVersionInput, ScheduleInput } from "../lib/validation";
import { ensureDefaultWorkflow } from "./workflowService";
import { createActivity } from "./activityService";
import { createApproval } from "./approvalService";

export async function createContent(
  db: DB,
  input: CreateContentInput,
  companyId: string,
  actorId?: string,
) {
  const client = await db.client.findFirst({ where: { id: input.clientId, companyId } });
  if (!client) throw notFound("Cliente não encontrado");

  if (input.responsibleId) {
    const u = await db.user.findUnique({ where: { id: input.responsibleId } });
    if (!u) throw notFound("Responsável não encontrado");
  }

  const workflow = await ensureDefaultWorkflow(db, companyId);
  const firstStage = workflow.stages[0];
  if (!firstStage) throw badRequest("Workflow sem stage inicial");

  return db.$transaction(async (tx) => {
    const content = await tx.job.create({
      data: {
        companyId,
        title: input.title,
        clientId: input.clientId,
        format: input.format,
        channel: input.channel ?? null,
        responsibleId: input.responsibleId ?? null,
        createdById: actorId ?? null,
        status: "DRAFT",
        lifecycleStatus: "OPEN",
        workflowId: workflow.id,
        currentStageId: firstStage.id,
        publicationTarget: input.publicationTarget ? new Date(input.publicationTarget) : null,
        notes: input.notes ?? null,
        versions: {
          create: {
            versionNumber: 1,
            caption: input.caption,
            mediaUrl: input.mediaUrl || null,
            mediaType: input.mediaType ?? null,
            createdById: actorId ?? null,
          },
        },
      },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    await createActivity(tx, {
      companyId,
      jobId: content.id,
      actorUserId: actorId,
      type: "JOB_CREATED",
      metadata: { legacyAdapter: true, stageId: firstStage.id },
    });
    return content;
  });
}

export async function listContents(db: DB, companyId: string, statusFilter?: ContentStatus) {
  return db.job.findMany({
    where: { companyId, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, brandColor: true } },
      responsible: { select: { id: true, name: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      children: { select: { id: true, title: true, status: true, format: true } },
    },
  });
}

export async function getContent(db: DB, companyId: string, id: string) {
  const content = await db.job.findUnique({
    where: { id, companyId },
    include: {
      client: true,
      responsible: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "asc" },
        include: {
          approvals: { orderBy: { createdAt: "desc" } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!content) throw notFound("Conteúdo não encontrado");
  return content;
}

async function loadOr404(db: DB, companyId: string, id: string) {
  const c = await db.job.findFirst({ where: { id, companyId } });
  if (!c) throw notFound("Conteúdo não encontrado");
  return c;
}

async function latestVersionNumber(db: DB, contentId: string): Promise<number> {
  const last = await db.jobVersion.findFirst({
    where: { contentId },
    orderBy: { versionNumber: "desc" },
  });
  return last?.versionNumber ?? 0;
}

export async function moveToReview(db: DB, companyId: string, id: string) {
  const c = await loadOr404(db, companyId, id);
  assertCanTransition(c.status as ContentStatus, "IN_REVIEW");
  await db.job.updateMany({ where: { id, companyId }, data: { status: "IN_REVIEW" } });
  return db.job.findFirst({ where: { id, companyId } });
}

// Creates a fresh Approval (PENDING) with a random token bound to the latest
// version, and moves IN_REVIEW → AWAITING_CLIENT.
export async function sendForApproval(db: DB, companyId: string, id: string) {
  const c = await loadOr404(db, companyId, id);
  assertCanTransition(c.status as ContentStatus, "AWAITING_CLIENT");
  const result = await createApproval(db, { companyId, jobId: id });
  await db.job.updateMany({ where: { id, companyId }, data: { status: "AWAITING_CLIENT" } });
  return result;
}

// Create the next version (CHANGES_REQUESTED → IN_REVIEW). History is preserved:
// previous versions + their approvals remain untouched.
export async function createVersion(db: DB, companyId: string, id: string, input: CreateVersionInput, actorId?: string) {
  const c = await loadOr404(db, companyId, id);
  if (c.status !== "CHANGES_REQUESTED") {
    throw new AppError(
      409,
      "Nova versão só pode ser criada quando há alterações solicitadas",
      "invalid_state",
    );
  }
  const maxVersion = await latestVersionNumber(db, id);
  const next = nextVersionNumber(maxVersion);

  return db.$transaction(async (tx) => {
    const version = await tx.jobVersion.create({
      data: {
        contentId: id,
        versionNumber: next,
        caption: input.caption,
        mediaUrl: input.mediaUrl || null,
        mediaType: input.mediaType ?? null,
        changeNote: input.changeNote ?? null,
        createdById: actorId ?? null,
      },
    });
    await tx.job.updateMany({ where: { id, companyId }, data: { status: "IN_REVIEW" } });
    return version;
  });
}

export async function schedule(db: DB, companyId: string, id: string, input: ScheduleInput) {
  const c = await loadOr404(db, companyId, id);
  assertCanTransition(c.status as ContentStatus, "SCHEDULED");
  const scheduledAt = new Date(input.scheduledAt);
  if (isNaN(scheduledAt.getTime())) throw badRequest("Data de agendamento inválida");
  await db.job.updateMany({ where: { id, companyId }, data: { status: "SCHEDULED", scheduledAt } });
  return db.job.findFirst({ where: { id, companyId } });
}

export async function publish(db: DB, companyId: string, id: string) {
  const c = await loadOr404(db, companyId, id);
  assertCanTransition(c.status as ContentStatus, "PUBLISHED");
  await db.job.updateMany({ where: { id, companyId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  return db.job.findFirst({ where: { id, companyId } });
}

export async function listPublications(db: DB, companyId: string) {
  return db.job.findMany({
    where: {
      companyId,
      OR: [
        { status: "SCHEDULED" },
        { status: "PUBLISHED" },
        { NOT: { publicationTarget: null } },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      client: { select: { id: true, name: true, brandColor: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
}

export async function groupContent(db: DB, companyId: string, childId: string, parentId: string) {
  if (childId === parentId) throw badRequest("Um conteúdo não pode ser agrupado nele mesmo");

  const child = await loadOr404(db, companyId, childId);
  const parent = await loadOr404(db, companyId, parentId);

  if (child.clientId !== parent.clientId) {
    throw badRequest("Só é possível agrupar conteúdos da mesma empresa");
  }

  // Prevent circular grouping: parent cannot be a descendant of child
  let current = parent;
  while (current.parentId) {
    if (current.parentId === childId) {
      throw badRequest("Agrupamento circular não permitido");
    }
    current = await db.job.findFirstOrThrow({ where: { id: current.parentId, companyId } });
  }

  await db.job.updateMany({ where: { id: childId, companyId }, data: { parentId } });
  return db.job.findFirst({ where: { id: childId, companyId } });
}

export async function ungroupContent(db: DB, companyId: string, childId: string) {
  const child = await loadOr404(db, companyId, childId);
  if (!child.parentId) throw badRequest("Este conteúdo não está agrupado");

  await db.job.updateMany({ where: { id: childId, companyId }, data: { parentId: null } });
  return db.job.findFirst({ where: { id: childId, companyId } });
}
