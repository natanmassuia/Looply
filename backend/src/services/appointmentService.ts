import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import { AppointmentStatus } from "@prisma/client";

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

  return db.appointment.create({
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

  return db.appointment.update({
    where: { id: existing.id },
    data: {
      title: finalTitle,
      description: input.description !== undefined ? input.description : existing.description,
      clientId: finalClientId,
      startsAt: finalStartsAt,
      endsAt: finalEndsAt,
    },
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
