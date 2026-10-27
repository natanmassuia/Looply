import type { DB } from "../lib/db";
import { Capability, hasCapability, resolveWorkspaceContext } from "../domain/capabilities";
import { getCalendar } from "./calendarService";
import { zonedDayRange } from "./scheduling";

const RECENT_LIMIT = 10;
const ATTENTION_LIMIT = 10;
const UPCOMING_DAYS = 7;
const ACTIVE_DEMAND_DASHBOARD_LIMIT = 5; // F14.2: Dashboard shows a 5-item summary only

export async function getDashboardForCompany(
  db: DB,
  companyId: string,
  now = new Date(),
) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, logoUrl: true, timezone: true, workspaceTemplate: true, appearancePreset: true, appearanceMode: true, appearanceCustomPrimary: true, appearanceCustomSecondary: true, appearanceCustomAccent: true, appearanceCustomSurface: true, appearanceCustomText: true, appearanceCustomBorder: true } });
  if (!company || !company.workspaceTemplate) throw new Error("Workspace não configurado");
  const capabilities = Object.values(Capability).filter((capability) => hasCapability(company.workspaceTemplate, capability));
  const can = (capability: Capability) => capabilities.includes(capability);
  const availableSections = ["summary", "attention", "recent"];
  if (can(Capability.WORKFLOW)) availableSections.push("stages");
  if (can(Capability.KANBAN)) availableSections.push("board");
  if (can(Capability.APPROVAL)) availableSections.push("approvals");
  if (can(Capability.CALENDAR)) availableSections.push("upcoming");
  if (can(Capability.ACTIVITY)) availableSections.push("activity");
  availableSections.push("attendance");

  // "Today" is the company's local calendar day, not the server's.
  const { start: dayStart, end: dayEnd } = zonedDayRange(now, company.timezone || "America/Sao_Paulo");

  const [clientCounts, lifecycleCounts, legacyStatusCounts, totalTeam, recentJobs, attentionJobs, stageCounts, stageNames, approvalCounts, upcoming, recentActivity, convStatusCounts, conversationsActiveToday, appointmentsToday] = await Promise.all([
    db.client.groupBy({ by: ["status"], where: { companyId: company.id }, _count: { _all: true } }),
    db.job.groupBy({ by: ["lifecycleStatus"], where: { companyId: company.id }, _count: { _all: true } }),
    db.job.groupBy({ by: ["status"], where: { companyId: company.id }, _count: { _all: true } }),
    db.companyMember.count({ where: { companyId: company.id, isActive: true } }),
    db.job.findMany({
      where: { companyId: company.id },
      take: ACTIVE_DEMAND_DASHBOARD_LIMIT,
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, name: true, brandColor: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        currentStage: { select: { id: true, name: true, position: true } },
      },
    }),
    db.job.findMany({
      where: { companyId: company.id, status: { in: ["AWAITING_CLIENT", "CHANGES_REQUESTED"] } },
      take: ATTENTION_LIMIT,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true, lifecycleStatus: true, client: { select: { id: true, name: true } }, currentStage: { select: { id: true, name: true } } },
    }),
    can(Capability.WORKFLOW)
      ? db.job.groupBy({ by: ["currentStageId"], where: { companyId: company.id }, _count: { _all: true } })
      : Promise.resolve([]),
    can(Capability.WORKFLOW)
      ? db.workflowStage.findMany({ where: { active: true, workflow: { companyId: company.id } }, orderBy: [{ workflowId: "asc" }, { position: "asc" }], select: { id: true, name: true, position: true, workflowId: true } })
      : Promise.resolve([]),
    can(Capability.APPROVAL)
      ? Promise.all([
        db.approval.count({ where: { companyId: company.id, status: "PENDING", revokedAt: null, expiresAt: { gt: now } } }),
        db.approval.count({ where: { companyId: company.id, status: "CHANGES_REQUESTED", revokedAt: null, expiresAt: { gt: now } } }),
      ])
      : Promise.resolve(null),
    can(Capability.CALENDAR)
      ? getCalendar(db, company.id, { from: now.toISOString(), to: new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000).toISOString() })
      : Promise.resolve(null),
    can(Capability.ACTIVITY)
      ? db.activity.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: RECENT_LIMIT, select: { id: true, type: true, jobId: true, actorUserId: true, createdAt: true, job: { select: { title: true } } } })
      : Promise.resolve([]),
    // Attendance KPIs (A3): all tenant-scoped, no migration required.
    db.conversation.groupBy({ by: ["aiStatus"], where: { companyId: company.id }, _count: { _all: true } }),
    db.conversation.count({ where: { companyId: company.id, lastMessageAt: { gte: dayStart } } }),
    db.appointment.count({ where: { companyId: company.id, status: "SCHEDULED", startsAt: { gte: dayStart, lt: dayEnd } } }),
  ]);

  const clientsActive = clientCounts.find((row) => row.status === "ACTIVE")?._count._all ?? 0;
  const clientsTotal = clientCounts.reduce((sum, row) => sum + row._count._all, 0);
  const lifecycle = Object.fromEntries(lifecycleCounts.map((row) => [row.lifecycleStatus, row._count._all]));
  const legacyStatus = Object.fromEntries(legacyStatusCounts.map((row) => [row.status, row._count._all]));
  const byStage = stageCounts.map((row) => ({
    stageId: row.currentStageId,
    stageName: stageNames.find((stage) => stage.id === row.currentStageId)?.name ?? null,
    count: row._count._all,
  }));
  const pendingApprovals = approvalCounts ? approvalCounts[0] : undefined;
  const changesRequestedApprovals = approvalCounts ? approvalCounts[1] : undefined;
  const upcomingEvents = upcoming?.events ?? [];

  const convByStatus = Object.fromEntries(convStatusCounts.map((row) => [row.aiStatus, row._count._all]));
  const conversationsNeedingAttention = convByStatus.NEEDS_ATTENTION ?? 0;
  const attendance = {
    conversationsNeedingAttention,
    conversationsActiveToday,
    appointmentsToday,
    activeDemands: (lifecycle.OPEN ?? 0) + (lifecycle.IN_PROGRESS ?? 0),
  };

  const attention = {
    jobs: attentionJobs,
    conversationsNeedingAttention,
    ...(can(Capability.APPROVAL) ? { pendingApprovals, changesRequestedApprovals } : {}),
    ...(can(Capability.CALENDAR) ? { upcoming: upcomingEvents.slice(0, ATTENTION_LIMIT) } : {}),
  };

  return {
    workspace: resolveWorkspaceContext(company),
    capabilities,
    availableSections,
    summary: {
      clients: { active: clientsActive },
      jobs: {
        open: lifecycle.OPEN ?? 0,
        inProgress: lifecycle.IN_PROGRESS ?? 0,
        completed: lifecycle.COMPLETED ?? 0,
        cancelled: lifecycle.CANCELLED ?? 0,
        total: lifecycleCounts.reduce((sum, row) => sum + row._count._all, 0),
      },
      team: { active: totalTeam },
      ...(can(Capability.WORKFLOW) ? { byStage } : {}),
    },
    attention,
    attendance,
    upcoming: can(Capability.CALENDAR) ? upcoming : undefined,
    recent: {
      jobs: recentJobs,
      activity: can(Capability.ACTIVITY) ? recentActivity : undefined,
    },
    // Legacy response fields remain bounded and tenant-scoped for the current shell.
    counts: {
      totalContents: lifecycleCounts.reduce((sum, row) => sum + row._count._all, 0),
      totalJobs: lifecycleCounts.reduce((sum, row) => sum + row._count._all, 0),
      totalClients: clientsTotal,
      totalTeam,
      draft: legacyStatus.DRAFT ?? 0,
      inReview: legacyStatus.IN_REVIEW ?? 0,
      awaitingClient: attentionJobs.filter((job) => job.status === "AWAITING_CLIENT").length,
      changesRequested: attentionJobs.filter((job) => job.status === "CHANGES_REQUESTED").length,
      approved: legacyStatus.APPROVED ?? 0,
      scheduled: legacyStatus.SCHEDULED ?? 0,
      published: legacyStatus.PUBLISHED ?? 0,
    },
    recentContents: recentJobs,
    needingAttention: attentionJobs,
  };
}
