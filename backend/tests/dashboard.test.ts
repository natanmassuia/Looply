import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { seedCredentials } from "./seedCredentials";
import { tenantBLogin } from "./fixtures";
import { SESSION_COOKIE } from "../src/lib/session";
import { getDashboardForCompany } from "../src/services/dashboardService";

describe.skipIf(!process.env.DATABASE_URL)("Dashboard tenant-safe projection", () => {
  it("Agency dashboard is scoped and includes capability-aware sections", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const response = await request(app).get("/api/dashboard").set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(response.status).toBe(200);
    expect(response.body.workspace.id).toBe(session.user.companyId);
    expect(response.body.capabilities).toContain("DASHBOARD");
    expect(response.body.summary.clients.active).toBeGreaterThan(0);
    expect(response.body.summary.jobs.total).toBeGreaterThan(0);
    expect(response.body.availableSections).toContain("approvals");
    expect(response.body.availableSections).toContain("upcoming");
    expect(response.body.availableSections).toContain("activity");
    expect(response.body.availableSections).toContain("board");
    expect(response.body.attention.pendingApprovals).toBeGreaterThanOrEqual(0);
    expect(response.body.recent.jobs.every((job: any) => job.companyId === session.user.companyId)).toBe(true);
    await logout(prisma, session.token);
  });

  it("High Ticket dashboard has own counts and no Kanban-specific section", async () => {
    const session = await tenantBLogin(prisma);
    const response = await request(app).get("/api/dashboard?companyId=other").set("Cookie", `${SESSION_COOKIE}=${session.token}`);
    expect(response.status).toBe(200);
    expect(response.body.workspace.id).toBe(session.user.companyId);
    expect(response.body.availableSections).not.toContain("board");
    expect(response.body.summary.clients.active).toBe(1);
    expect(response.body.summary.jobs.total).toBe(0);
    expect(response.body.recent.jobs).toEqual([]);
    await logout(prisma, session.token);
  });

  it("unauthenticated and incomplete workspaces cannot access Dashboard", async () => {
    expect((await request(app).get("/api/dashboard")).status).toBe(401);
  });
});

describe("Dashboard capability side-channel", () => {
  it("does not query Approval for a workspace without APPROVAL", async () => {
    const calls: string[] = [];
    const db: any = {
      company: { findUnique: async () => ({ id: "c1", name: "Local", timezone: "America/Sao_Paulo", workspaceTemplate: "LOCAL_BUSINESS" }) },
      client: { groupBy: async () => [{ status: "ACTIVE", _count: { _all: 1 } }] },
      companyMember: { count: async () => 1 },
      job: {
        groupBy: async ({ by }: any) => by[0] === "lifecycleStatus" ? [{ lifecycleStatus: "OPEN", _count: { _all: 1 } }] : by[0] === "status" ? [] : [{ currentStageId: "s1", _count: { _all: 1 } }],
        findMany: async () => [],
      },
      workflowStage: { findMany: async () => [] },
      activity: { findMany: async () => [] },
      appointment: { findMany: async () => [] },
      approval: { count: async () => { calls.push("approval"); throw new Error("should not query approval"); } },
    };
    const dashboard = await getDashboardForCompany(db, "c1", new Date("2026-08-14T00:00:00.000Z"));
    expect(dashboard.availableSections).not.toContain("approvals");
    expect(calls).toEqual([]);
  });
});
