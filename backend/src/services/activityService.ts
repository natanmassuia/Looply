import type { DB } from "../lib/db";
import type { Prisma } from "@prisma/client";
import { notFound } from "../lib/errors";
import type { ActivityType } from "@prisma/client";

type ActivityDB = DB | Prisma.TransactionClient;

export async function createActivity(
  db: ActivityDB,
  input: { companyId: string; jobId: string; actorUserId?: string; type: ActivityType; metadata?: unknown },
) {
  return db.activity.create({
    data: {
      companyId: input.companyId,
      jobId: input.jobId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      metadata: input.metadata as never,
    },
  });
}

export async function listJobActivities(db: DB, companyId: string, jobId: string) {
  const job = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
  if (!job) throw notFound("Job não encontrado");
  return db.activity.findMany({
    where: { companyId, jobId },
    orderBy: { createdAt: "asc" },
    select: { id: true, jobId: true, actorUserId: true, type: true, metadata: true, createdAt: true },
  });
}
