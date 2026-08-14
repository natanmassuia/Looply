import type { DB } from "../lib/db";
import { notFound, conflict, AppError } from "../lib/errors";

// ── Tenant-scoped Client domain (B5) ─────────────────────────────────────
// companyId ALWAYS comes from the authenticated tenant context (req.auth).
// Lookups use findFirst({ id, companyId }) so cross-tenant ids resolve to a
// plain 404 without revealing existence.

const ACTIVE_CONTENT_STATUSES = [
  "DRAFT", "IN_REVIEW", "AWAITING_CLIENT", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED",
] as const;

export async function listClients(db: DB, companyId: string, opts?: { status?: string; search?: string }) {
  const clients = await db.client.findMany({
    where: {
      companyId,
      ...(opts?.status ? { status: opts.status as never } : {}),
      ...(opts?.search ? { name: { contains: opts.search, mode: "insensitive" as never } } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { content: { where: { status: { in: ACTIVE_CONTENT_STATUSES as never } } } } },
    },
  });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    brandColor: c.brandColor,
    status: c.status,
    primaryContactName: c.primaryContactName,
    primaryContactEmail: c.primaryContactEmail,
    primaryContactPhone: c.primaryContactPhone,
    channels: c.channels,
    activeContents: c._count.content,
    createdAt: c.createdAt,
  }));
}

export async function getClient(db: DB, companyId: string, id: string) {
  const client = await db.client.findFirst({
    where: { id, companyId },
    include: {
      content: {
        orderBy: { updatedAt: "desc" },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      },
    },
  });
  if (!client) throw notFound("Cliente não encontrado");
  return client;
}

export interface CreateClientInput {
  name: string;
  brandColor?: string;
  status?: "ACTIVE" | "INACTIVE" | "PROSPECT";
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  channels?: string[];
}

export async function createClient(db: DB, companyId: string, input: CreateClientInput) {
  const duplicate = await db.client.findFirst({
    where: { companyId, name: input.name },
    select: { id: true },
  });
  if (duplicate) throw conflict("Já existe um cliente com este nome no workspace");
  return db.client.create({
    data: {
      companyId, // tenant ownership from auth context only
      name: input.name,
      brandColor: input.brandColor ?? null,
      status: input.status ?? "ACTIVE",
      primaryContactName: input.primaryContactName ?? null,
      primaryContactEmail: input.primaryContactEmail ?? null,
      primaryContactPhone: input.primaryContactPhone ?? null,
      channels: input.channels ?? [],
    },
  });
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}

export async function updateClient(db: DB, companyId: string, id: string, input: UpdateClientInput) {
  const existing = await db.client.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) throw notFound("Cliente não encontrado");
  if (input.name !== undefined) {
    const duplicate = await db.client.findFirst({
      where: { companyId, name: input.name, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) throw conflict("Já existe um cliente com este nome no workspace");
  }
  // companyId is deliberately NOT settable: tenant ownership is immutable.
  const data: Record<string, unknown> = {};
  for (const key of [
    "name", "brandColor", "status", "primaryContactName",
    "primaryContactEmail", "primaryContactPhone", "channels",
  ] as const) {
    if (input[key] !== undefined) data[key] = input[key];
  }
  const updated = await db.client.updateMany({ where: { id, companyId }, data });
  if (updated.count === 0) throw notFound("Cliente não encontrado");
  return db.client.findFirst({ where: { id, companyId } });
}

export async function deleteClient(db: DB, companyId: string, id: string) {
  const existing = await db.client.findFirst({
    where: { id, companyId },
    select: { id: true, _count: { select: { content: true } } },
  });
  if (!existing) throw notFound("Cliente não encontrado");
  if (existing._count.content > 0) {
    throw new AppError(409, "Cliente possui conteúdos vinculados — desative-o em vez de excluir", "conflict");
  }
  const deleted = await db.client.deleteMany({ where: { id, companyId } });
  if (deleted.count === 0) throw notFound("Cliente não encontrado");
}
