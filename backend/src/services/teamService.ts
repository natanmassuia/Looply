import type { DB } from "../lib/db";

export async function listTeam(db: DB) {
  return db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      active: true,
      createdAt: true,
    },
  });
}
