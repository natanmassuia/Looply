import { describe, it, expect } from "vitest";
import { createJob, transitionJob } from "../src/services/jobService";

function makeTransactionalFake() {
  const state = {
    jobs: [{ id: "j1", companyId: "c1", clientId: "cl1", workflowId: "w1", currentStageId: "s1" }],
    activities: [] as unknown[],
  };
  const workflow = {
    id: "w1",
    companyId: "c1",
    template: "LOCAL_BUSINESS",
    stages: [{ id: "s1", position: 0 }, { id: "s2", position: 1 }],
  };
  const db: any = {
    company: { findUnique: async () => ({ workspaceTemplate: "LOCAL_BUSINESS", isActive: true }) },
    client: { findFirst: async () => ({ id: "cl1" }) },
    workflowDefinition: {
      findUnique: async () => workflow,
      create: async () => workflow,
    },
    workflowStage: { findFirst: async ({ where }: any) => workflow.stages.find((s) => s.id === where.id) ?? null },
    job: {
      findFirst: async ({ where }: any) => state.jobs.find((j) => j.id === where.id && j.companyId === where.companyId) ?? null,
      create: async ({ data }: any) => {
        const job = { id: "created", ...data };
        state.jobs.push(job);
        return job;
      },
      updateMany: async ({ where, data }: any) => {
        const job = state.jobs.find((j) => j.id === where.id && j.companyId === where.companyId);
        if (!job) return { count: 0 };
        Object.assign(job, data);
        return { count: 1 };
      },
    },
    activity: {
      create: async () => {
        throw new Error("simulated activity failure");
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const snapshot = JSON.parse(JSON.stringify(state));
      try {
        return await fn(db);
      } catch (error) {
        state.jobs = snapshot.jobs;
        state.activities = snapshot.activities;
        throw error;
      }
    },
  };
  return { db, state };
}

describe("Job transaction boundaries", () => {
  it("rolls back Job creation when JOB_CREATED Activity fails", async () => {
    const { db, state } = makeTransactionalFake();
    await expect(createJob(db, "c1", "u1", { title: "Atomic", clientId: "cl1" })).rejects.toThrow("simulated activity failure");
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].id).toBe("j1");
  });

  it("rolls back stage transition when JOB_STAGE_CHANGED Activity fails", async () => {
    const { db, state } = makeTransactionalFake();
    await expect(transitionJob(db, "c1", "u1", "j1", "s2")).rejects.toThrow("simulated activity failure");
    expect(state.jobs[0].currentStageId).toBe("s1");
  });
});
