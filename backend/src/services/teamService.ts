import type { DB } from "../lib/db";

// Team listing is TENANT-SCOPED. It resolves the authenticated company's
// members through CompanyMember (the canonical membership boundary) rather
// than the global User table, so no member of another company can be
// enumerated. companyId must come from the authenticated session
// (req.auth.companyId), never from client input.
export async function listTeam(db: DB, companyId: string) {
  const members = await db.companyMember.findMany({
    where: { companyId },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          active: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => m.user);
}
