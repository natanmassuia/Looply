import { describe, expect, it } from "vitest";
import {
  ensureWorkflowSemantics,
  resolveStageBySemantic,
} from "../src/services/workflowService";
import { transitionJob } from "../src/services/jobService";

type Stage = {
  id: string; workflowId: string; name: string; position: number;
  terminal: boolean; active: boolean; semanticKey: string | null;
  _count?: { jobs: number };
};

function makeDb(workflowId = "w1", companyId = "c1", template = "MARKETING_AGENCY") {
  const stages: Stage[] = [
    { id: "s1", workflowId, name: "Backlog", position: 0, terminal: false, active: true, semanticKey: null },
    { id: "s2", workflowId, name: "Em produção", position: 1, terminal: false, active: true, semanticKey: null },
    { id: "s3", workflowId, name: "Concluído", position: 2, terminal: true, active: true, semanticKey: null },
  ];
  const jobs: any[] = [{ id: "j1", companyId, workflowId, currentStageId: "s1", status: "DRAFT", lifecycleStatus: "OPEN" }];
  const state = { workflowId, companyId, stages, jobs, updatedJobs: [] as unknown[] };

  const db: any = {
    workflowDefinition: {
      findUnique: async ({ where, include }: any) => {
        if (where.id !== workflowId) return null;
        const base = { id: workflowId, companyId, template, name: "Workflow" };
        return include?.stages ? { ...base, stages: state.stages.slice().sort((a, b) => a.position - b.position) } : base;
      },
      findFirst: async ({ where, include }: any) => {
        if (where.id && where.id !== workflowId) return null;
        if (where.companyId && where.companyId !== companyId) return null;
        const base = { id: workflowId, companyId, template, name: "Workflow" };
        return include?.stages ? { ...base, stages: state.stages.slice().sort((a, b) => a.position - b.position) } : base;
      },
      findMany: async ({ where }: any) =>
        where.companyId && where.companyId !== companyId ? [] : [{ id: workflowId, companyId, template, name: "Workflow" }],
    },
    workflowStage: {
      create: async ({ data }: any) => {
        const stage = { id: `s${state.stages.length + 1}`, ...data };
        state.stages.push(stage);
        return stage;
      },
      findFirst: async ({ where, include }: any) => {
        const found = state.stages.find((s) => {
          if (where.id && s.id !== where.id) return false;
          if (where.workflowId && s.workflowId !== where.workflowId) return false;
          if (where.active !== undefined && s.active !== where.active) return false;
          if (where.semanticKey !== undefined && s.semanticKey !== where.semanticKey) return false;
          if (where.workflow && where.workflow.companyId && where.workflow.companyId !== companyId) return false;
          return true;
        });
        if (!found) return null;
        const base = { ...found, workflow: { companyId } };
        return include?._count ? { ...base, _count: { jobs: found._count?.jobs ?? 0 } } : base;
      },
      findMany: async ({ where }: any) =>
        state.stages.filter((s) => !where || (where.workflowId ? s.workflowId === where.workflowId : true) && (where.active === undefined || s.active === where.active)),
      updateMany: async ({ where, data }: any) => {
        const stage = state.stages.find((s) => s.id === where.id);
        if (!stage) return { count: 0 };
        Object.assign(stage, data);
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const stage = state.stages.find((s) => s.id === where.id);
        if (stage) Object.assign(stage, data);
        return stage;
      },
    },
    job: {
      findFirst: async ({ where }: any) =>
        state.jobs.find((j) => j.id === where.id && j.companyId === where.companyId) ?? null,
      updateMany: async ({ where, data }: any) => {
        const job = state.jobs.find((j) => j.id === where.id && j.companyId === where.companyId);
        if (!job) return { count: 0 };
        state.updatedJobs.push({ id: where.id, ...data });
        Object.assign(job, data);
        return { count: 1 };
      },
    },
    activity: { create: async () => ({}) },
    $transaction: async (fn: any) => (typeof fn === "function" ? fn(db) : Promise.all(fn)),
    __state: state,
  };
  return db;
}

describe("Workflow semantics (R1.2)", () => {
  it("adds APPROVED and SCHEDULED stages and marks terminal COMPLETED, idempotently", async () => {
    const db = makeDb();
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    const s = db.__state.stages;
    expect(s.find((x: Stage) => x.terminal)?.semanticKey).toBe("COMPLETED");
    expect(s.some((x: Stage) => x.semanticKey === "APPROVED")).toBe(true);
    expect(s.some((x: Stage) => x.semanticKey === "SCHEDULED")).toBe(true);

    // Idempotent: no duplicate protected semantics on second run.
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    const approved = s.filter((x: Stage) => x.semanticKey === "APPROVED");
    const scheduled = s.filter((x: Stage) => x.semanticKey === "SCHEDULED");
    expect(approved.length).toBe(1);
    expect(scheduled.length).toBe(1);
  });

  it("resolveStageBySemantic is tenant-scoped", async () => {
    const db = makeDb();
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    const own = await resolveStageBySemantic(db, "c1", "APPROVED");
    expect(own).not.toBeNull();
    const foreign = await resolveStageBySemantic(db, "other", "APPROVED");
    expect(foreign).toBeNull();
  });

  it("transition into a custom (semantic-null) stage updates only currentStageId", async () => {
    const db = makeDb();
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    await transitionJob(db, "c1", "u1", "j1", "s2"); // Em produção (no semantic)
    expect(db.__state.jobs[0].currentStageId).toBe("s2");
    expect(db.__state.jobs[0].status).toBe("DRAFT"); // unchanged
  });

  it("transition into an APPROVED semantic stage is rejected unless the job is already APPROVED", async () => {
    const db = makeDb();
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    const approved = db.__state.stages.find((s: Stage) => s.semanticKey === "APPROVED");
    // DRAFT job: approval domain rules cannot be bypassed by a stage drag.
    await expect(transitionJob(db, "c1", "u1", "j1", approved.id)).rejects.toMatchObject({ status: 409 });
    expect(db.__state.jobs[0].currentStageId).toBe("s1"); // unchanged
    expect(db.__state.jobs[0].status).toBe("DRAFT"); // unchanged
  });

  it("transition into an APPROVED semantic stage is allowed when status is already APPROVED", async () => {
    const db = makeDb();
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    db.__state.jobs[0].status = "APPROVED"; // approved through the canonical approval flow
    const approved = db.__state.stages.find((s: Stage) => s.semanticKey === "APPROVED");
    await transitionJob(db, "c1", "u1", "j1", approved.id);
    expect(db.__state.jobs[0].currentStageId).toBe(approved.id);
    expect(db.__state.jobs[0].status).toBe("APPROVED");
  });

  it("generic transition into a SCHEDULED semantic stage is rejected (cannot bypass Appointment)", async () => {
    const db = makeDb();
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    const scheduled = db.__state.stages.find((s: Stage) => s.semanticKey === "SCHEDULED");
    await expect(transitionJob(db, "c1", "u1", "j1", scheduled.id)).rejects.toMatchObject({ status: 409 });
    expect(db.__state.jobs[0].currentStageId).toBe("s1"); // unchanged
  });

  it("transition into COMPLETED semantic stage reconciles lifecycleStatus", async () => {
    const db = makeDb();
    await ensureWorkflowSemantics(db, "w1", "c1", "MARKETING_AGENCY");
    const terminal = db.__state.stages.find((s: Stage) => s.terminal);
    await transitionJob(db, "c1", "u1", "j1", terminal.id);
    expect(db.__state.jobs[0].lifecycleStatus).toBe("COMPLETED");
  });
});
