import type { DB } from "../lib/db";
import { prisma } from "../lib/db";

export async function getDashboard(db: DB = prisma) {
  const grouped = await db.job.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<
    string,
    number
  >;

  const [totalContents, totalClients, totalTeam, recentContents, awaiting, changes] =
    await Promise.all([
      db.job.count(),
      db.client.count(),
      db.user.count(),
      db.job.findMany({
        take: 6,
        orderBy: { updatedAt: "desc" },
        include: {
          client: { select: { id: true, name: true, brandColor: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      }),
      db.job.count({ where: { status: "AWAITING_CLIENT" } }),
      db.job.count({ where: { status: "CHANGES_REQUESTED" } }),
    ]);

  return {
    counts: {
      totalContents,
      totalClients,
      totalTeam,
      draft: byStatus.DRAFT ?? 0,
      inReview: byStatus.IN_REVIEW ?? 0,
      awaitingClient: awaiting,
      changesRequested: changes,
      approved: byStatus.APPROVED ?? 0,
      scheduled: byStatus.SCHEDULED ?? 0,
      published: byStatus.PUBLISHED ?? 0,
    },
    recentContents,
    needingAttention: recentContents.filter((c) =>
      ["AWAITING_CLIENT", "CHANGES_REQUESTED"].includes(c.status),
    ),
  };
}
