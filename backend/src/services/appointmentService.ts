import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import { AppointmentStatus } from "@prisma/client";
import { withTransaction } from "../lib/withTransaction";
import {
  type BusinessHours,
  type BusyInterval,
  DEFAULT_DURATION_MIN,
  effectiveEnd,
  nextFreeSlots,
  overlaps,
  withinBusinessHours,
} from "./scheduling";

export interface CreateAppointmentInput {
  title: string;
  description?: string | null;
  clientId?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
}

export interface UpdateAppointmentInput {
  title?: string;
  description?: string | null;
  clientId?: string | null;
  startsAt?: Date;
  endsAt?: Date | null;
}

export interface AppointmentListQuery {
  limit?: number;
  page?: number;
  clientId?: string;
  status?: AppointmentStatus;
}

async function assertClientBelongsToCompany(db: DB, companyId: string, clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, companyId },
    select: { id: true },
  });
  if (!client) {
    throw notFound("Cliente não encontrado");
  }
}

interface CompanyScheduling {
  timezone: string;
  hours: BusinessHours;
}

// Loads timezone + business-hours config. Degrades to "not configured" when the
// db double lacks the company model (pure-logic unit tests).
async function loadScheduling(db: DB, companyId: string): Promise<CompanyScheduling> {
  const findUnique = (db as { company?: { findUnique?: unknown } }).company?.findUnique;
  if (typeof findUnique !== "function") {
    return { timezone: "America/Sao_Paulo", hours: { start: null, end: null, days: [] } };
  }
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { timezone: true, businessHoursStart: true, businessHoursEnd: true, businessDays: true },
  });
  return {
    timezone: company?.timezone || "America/Sao_Paulo",
    hours: {
      start: company?.businessHoursStart ?? null,
      end: company?.businessHoursEnd ?? null,
      days: company?.businessDays ?? [],
    },
  };
}

function formatSlots(slots: Date[], timezone: string): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return slots.map((s) => fmt.format(s)).join("; ");
}

// Takes a per-company advisory lock so concurrent writes serialize, then rejects
// out-of-hours or overlapping slots. Must run inside a transaction. The lock is
// skipped on db doubles without $queryRaw (unit tests); production always has it.
async function assertSlotFree(
  tx: DB,
  companyId: string,
  sched: CompanyScheduling,
  startsAt: Date,
  endsAt: Date | null | undefined,
  excludeId?: string,
): Promise<void> {
  const executeRaw = (tx as { $executeRaw?: unknown }).$executeRaw;
  if (typeof executeRaw === "function") {
    // int8 key from the companyId so all writes for one company serialize.
    // $executeRaw (not $queryRaw) avoids deserializing the function's void return.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId})::int8)`;
  }

  const end = effectiveEnd(startsAt, endsAt);

  if (!withinBusinessHours(startsAt, end, sched.hours, sched.timezone)) {
    const busy = await loadBusy(tx, companyId, startsAt, excludeId);
    const slots = nextFreeSlots(startsAt, Math.round((end.getTime() - startsAt.getTime()) / 60000), busy, sched.hours, sched.timezone);
    throw conflict(
      slots.length
        ? `Esse horário está fora do funcionamento. Próximos horários livres: ${formatSlots(slots, sched.timezone)}.`
        : "Esse horário está fora do horário de funcionamento.",
    );
  }

  const busy = await loadBusy(tx, companyId, startsAt, excludeId);
  const clash = busy.some((b) => overlaps(startsAt, end, b.start, b.end));
  if (clash) {
    const durationMin = Math.round((end.getTime() - startsAt.getTime()) / 60000);
    const slots = nextFreeSlots(end, durationMin, busy, sched.hours, sched.timezone);
    throw conflict(
      slots.length
        ? `Esse horário já está ocupado. Próximos horários livres: ${formatSlots(slots, sched.timezone)}.`
        : "Esse horário já está ocupado.",
    );
  }
}

// Scheduled appointments that could overlap `from` onward (bounded: explicit
// ends after `from`, or open-ended rows whose implicit end may reach it).
async function loadBusy(tx: DB, companyId: string, from: Date, excludeId?: string): Promise<BusyInterval[]> {
  const horizonEnd = new Date(from.getTime() + 14 * 24 * 60 * 60_000 + DEFAULT_DURATION_MIN * 60_000);
  const rows = await tx.appointment.findMany({
    where: {
      companyId,
      status: "SCHEDULED",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { lt: horizonEnd },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date(from.getTime() - 24 * 60 * 60_000) } }],
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true },
    take: 500,
  });
  // Exclude self in memory too: db test doubles may ignore the `id` filter.
  return rows
    .filter((r) => !excludeId || r.id !== excludeId)
    .map((r) => ({ start: r.startsAt, end: effectiveEnd(r.startsAt, r.endsAt) }));
}

function validateDates(startsAt: Date, endsAt?: Date | null) {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    throw badRequest("startsAt inválido");
  }
  if (endsAt !== undefined && endsAt !== null) {
    if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) {
      throw badRequest("endsAt inválido");
    }
    if (endsAt <= startsAt) {
      throw badRequest("endsAt deve ser maior que startsAt");
    }
  }
}

export async function createAppointment(
  db: DB,
  companyId: string,
  actorUserId: string | null,
  input: CreateAppointmentInput
) {
  const title = input.title?.trim();
  if (!title) {
    throw badRequest("title é obrigatório");
  }

  validateDates(input.startsAt, input.endsAt);

  if (input.clientId) {
    await assertClientBelongsToCompany(db, companyId, input.clientId);
  }

  const sched = await loadScheduling(db, companyId);

  return withTransaction(db, async (tx) => {
    await assertSlotFree(tx, companyId, sched, input.startsAt, input.endsAt);
    return tx.appointment.create({
      data: {
        companyId,
        title,
        description: input.description ?? null,
        clientId: input.clientId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        status: "SCHEDULED",
        createdByUserId: actorUserId,
      },
    });
  });
}

export async function listAppointments(
  db: DB,
  companyId: string,
  query: AppointmentListQuery = {}
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  
  const where = {
    companyId,
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, appointments] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { appointments, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getAppointment(
  db: DB,
  companyId: string,
  appointmentId: string
) {
  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, companyId },
  });
  if (!appointment) {
    throw notFound("Compromisso não encontrado");
  }
  return appointment;
}

export async function updateAppointment(
  db: DB,
  companyId: string,
  appointmentId: string,
  input: UpdateAppointmentInput
) {
  const existing = await getAppointment(db, companyId, appointmentId);

  if (existing.status === "CANCELLED") {
    throw conflict("Não é possível atualizar um compromisso cancelado");
  }

  let finalTitle = existing.title;
  if (input.title !== undefined) {
    finalTitle = input.title.trim();
    if (!finalTitle) {
      throw badRequest("title não pode ser vazio");
    }
  }

  const finalStartsAt = input.startsAt ?? existing.startsAt;
  const finalEndsAt = input.endsAt !== undefined ? input.endsAt : existing.endsAt;

  validateDates(finalStartsAt, finalEndsAt);

  let finalClientId = existing.clientId;
  if (input.clientId !== undefined) {
    if (input.clientId) {
      await assertClientBelongsToCompany(db, companyId, input.clientId);
    }
    finalClientId = input.clientId;
  }

  const timesChanged =
    input.startsAt !== undefined ||
    (input.endsAt !== undefined && input.endsAt !== existing.endsAt);
  const sched = timesChanged ? await loadScheduling(db, companyId) : null;

  return withTransaction(db, async (tx) => {
    if (sched) {
      await assertSlotFree(tx, companyId, sched, finalStartsAt, finalEndsAt, existing.id);
    }
    return tx.appointment.update({
      where: { id: existing.id },
      data: {
        title: finalTitle,
        description: input.description !== undefined ? input.description : existing.description,
        clientId: finalClientId,
        startsAt: finalStartsAt,
        endsAt: finalEndsAt,
      },
    });
  });
}

export async function cancelAppointment(
  db: DB,
  companyId: string,
  appointmentId: string
) {
  const existing = await getAppointment(db, companyId, appointmentId);

  if (existing.status === "CANCELLED") {
    return existing;
  }

  return db.appointment.update({
    where: { id: existing.id },
    data: { status: "CANCELLED" },
  });
}
