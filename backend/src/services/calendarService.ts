import type { DB } from "../lib/db";
import { badRequest, notFound } from "../lib/errors";

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 500;

export interface CalendarQuery {
  from: string;
  to: string;
  clientId?: string;
  stageId?: string;
  lifecycleStatus?: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

export async function getCalendar(db: DB, companyId: string, query: CalendarQuery) {
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw badRequest("Range de datas inválido");
  if (from >= to) throw badRequest("from deve ser anterior a to");
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) throw badRequest("Range máximo de 90 dias");

  const company = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  if (!company) throw notFound("Workspace não encontrado");

  if (query.clientId) {
    const client = await db.client.findFirst({ where: { id: query.clientId, companyId }, select: { id: true } });
    if (!client) throw notFound("Cliente não encontrado");
  }
  if (query.stageId) {
    const stage = await db.workflowStage.findFirst({ where: { id: query.stageId, active: true, workflow: { companyId } }, select: { id: true } });
    if (!stage) throw notFound("Stage não encontrado");
  }

  const jobs = await db.job.findMany({
    where: {
      companyId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.stageId ? { currentStageId: query.stageId } : {}),
      ...(query.lifecycleStatus ? { lifecycleStatus: query.lifecycleStatus } : {}),
      OR: [
        { publicationTarget: { gte: from, lt: to } },
        { scheduledAt: { gte: from, lt: to } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: MAX_EVENTS + 1,
    select: {
      id: true,
      title: true,
      lifecycleStatus: true,
      publicationTarget: true,
      scheduledAt: true,
      client: { select: { id: true, name: true, brandColor: true } },
      currentStage: { select: { id: true, name: true, position: true } },
    },
  });

  const appointments = await db.appointment.findMany({
    where: {
      companyId,
      status: "SCHEDULED",
      ...(query.clientId ? { clientId: query.clientId } : {}),
      startsAt: { lt: to },
      OR: [
        { endsAt: null },
        { endsAt: { gt: from } },
      ],
    },
    orderBy: { startsAt: "asc" },
    take: MAX_EVENTS + 1,
    select: {
      id: true,
      title: true,
      startsAt: true,
      client: { select: { id: true, name: true, brandColor: true } },
    },
  });

  const events: any[] = jobs.flatMap((job) => {
    const projected = [];
    if (job.publicationTarget && job.publicationTarget >= from && job.publicationTarget < to) {
      projected.push({ id: `${job.id}:publication-target`, jobId: job.id, type: "PUBLICATION_TARGET" as const, at: job.publicationTarget, title: job.title, client: job.client, lifecycleStatus: job.lifecycleStatus, currentStage: job.currentStage });
    }
    if (job.scheduledAt && job.scheduledAt >= from && job.scheduledAt < to) {
      projected.push({ id: `${job.id}:scheduled`, jobId: job.id, type: "SCHEDULED" as const, at: job.scheduledAt, title: job.title, client: job.client, lifecycleStatus: job.lifecycleStatus, currentStage: job.currentStage });
    }
    return projected;
  });

  appointments.forEach(appointment => {
    events.push({
      id: `${appointment.id}:appointment`,
      appointmentId: appointment.id,
      type: "APPOINTMENT" as const,
      at: appointment.startsAt,
      title: appointment.title,
      client: appointment.client,
    });
  });

  events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));

  return {
    timezone: company.timezone,
    range: { from: from.toISOString(), to: to.toISOString(), inclusiveStart: true, exclusiveEnd: true },
    events: events.slice(0, MAX_EVENTS),
    totalEvents: events.length,
    truncated: events.length > MAX_EVENTS,
  };
}
