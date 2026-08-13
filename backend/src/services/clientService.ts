import type { DB } from "../lib/db";
import { Prisma } from "@prisma/client";

export async function listClients(db: DB) {
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          content: {
            where: {
              status: { in: ["DRAFT", "IN_REVIEW", "AWAITING_CLIENT", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED"] },
            },
          },
        },
      },
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

export async function getClient(db: DB, id: string) {
  const client = await db.client.findUnique({
    where: { id },
    include: {
      content: {
        orderBy: { updatedAt: "desc" },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      },
    },
  });
  if (!client) {
    throw new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion: "5.22.0" });
  }
  return client;
}

export async function createClient(db: DB, data: Prisma.ClientCreateInput) {
  return db.client.create({ data });
}
