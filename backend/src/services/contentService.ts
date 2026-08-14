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
import { randomToken } from "../lib/token";

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

  return db.$transaction(async (tx) => {
    const content = await tx.content.create({
      data: {
        title: input.title,
        clientId: input.clientId,
        format: input.format,
        channel: input.channel ?? null,
        responsibleId: input.responsibleId ?? null,
        createdById: actorId ?? null,
        status: "DRAFT",
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
    return content;
  });
}

export async function listContents(db: DB, statusFilter?: ContentStatus) {
  return db.content.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, brandColor: true } },
      responsible: { select: { id: true, name: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      children: { select: { id: true, title: true, status: true, format: true } },
    },
  });
}

export async function getContent(db: DB, id: string) {
  const content = await db.content.findUnique({
    where: { id },
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

async function loadOr404(db: DB, id: string) {
  const c = await db.content.findUnique({ where: { id } });
  if (!c) throw notFound("Conteúdo não encontrado");
  return c;
}

async function latestVersionNumber(db: DB, contentId: string): Promise<number> {
  const last = await db.contentVersion.findFirst({
    where: { contentId },
    orderBy: { versionNumber: "desc" },
  });
  return last?.versionNumber ?? 0;
}

export async function moveToReview(db: DB, id: string) {
  const c = await loadOr404(db, id);
  assertCanTransition(c.status as ContentStatus, "IN_REVIEW");
  return db.content.update({ where: { id }, data: { status: "IN_REVIEW" } });
}

// Creates a fresh Approval (PENDING) with a random token bound to the latest
// version, and moves IN_REVIEW → AWAITING_CLIENT.
export async function sendForApproval(db: DB, id: string) {
  const c = await loadOr404(db, id);
  assertCanTransition(c.status as ContentStatus, "AWAITING_CLIENT");

  const maxVersion = await latestVersionNumber(db, id);
  if (maxVersion === 0) throw badRequest("Conteúdo sem versão inicial");

  const version = await db.contentVersion.findFirst({
    where: { contentId: id, versionNumber: maxVersion },
  });
  if (!version) throw notFound("Versão não encontrada");

  const token = randomToken(32);
  const [approval] = await db.$transaction([
    db.approval.create({
      data: {
        contentId: id,
        contentVersionId: version.id,
        token,
        status: "PENDING",
        clientName: null,
      },
    }),
    db.content.update({ where: { id }, data: { status: "AWAITING_CLIENT" } }),
  ]);
  return { approval, token };
}

// Create the next version (CHANGES_REQUESTED → IN_REVIEW). History is preserved:
// previous versions + their approvals remain untouched.
export async function createVersion(db: DB, id: string, input: CreateVersionInput, actorId?: string) {
  const c = await loadOr404(db, id);
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
    const version = await tx.contentVersion.create({
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
    await tx.content.update({ where: { id }, data: { status: "IN_REVIEW" } });
    return version;
  });
}

export async function schedule(db: DB, id: string, input: ScheduleInput) {
  const c = await loadOr404(db, id);
  assertCanTransition(c.status as ContentStatus, "SCHEDULED");
  const scheduledAt = new Date(input.scheduledAt);
  if (isNaN(scheduledAt.getTime())) throw badRequest("Data de agendamento inválida");
  return db.content.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt } });
}

export async function publish(db: DB, id: string) {
  const c = await loadOr404(db, id);
  assertCanTransition(c.status as ContentStatus, "PUBLISHED");
  return db.content.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
}

export async function listPublications(db: DB) {
  return db.content.findMany({
    where: {
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

export async function groupContent(db: DB, childId: string, parentId: string) {
  if (childId === parentId) throw badRequest("Um conteúdo não pode ser agrupado nele mesmo");

  const child = await loadOr404(db, childId);
  const parent = await loadOr404(db, parentId);

  if (child.clientId !== parent.clientId) {
    throw badRequest("Só é possível agrupar conteúdos da mesma empresa");
  }

  // Prevent circular grouping: parent cannot be a descendant of child
  let current = parent;
  while (current.parentId) {
    if (current.parentId === childId) {
      throw badRequest("Agrupamento circular não permitido");
    }
    current = await db.content.findUniqueOrThrow({ where: { id: current.parentId } });
  }

  return db.content.update({
    where: { id: childId },
    data: { parentId },
  });
}

export async function ungroupContent(db: DB, childId: string) {
  const child = await loadOr404(db, childId);
  if (!child.parentId) throw badRequest("Este conteúdo não está agrupado");

  return db.content.update({
    where: { id: childId },
    data: { parentId: null },
  });
}
