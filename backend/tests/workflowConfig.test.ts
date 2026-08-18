import { describe, expect, it } from "vitest";
import {
  addStage,
  renameStage,
  reorderStages,
  removeStage,
} from "../src/services/workflowService";

function makeDb(stages: { id: string; name: string; position: number; terminal: boolean; active: boolean; _count?: { jobs: number } }[]) {
  const state = {
    workflow: { id: "w1", companyId: "c1" },
    stages: stages.map((s) => ({ workflowId: "w1", ...s })) as any[],
    updates: [] as unknown[],
  };
  const db: any = {
    workflowDefinition: {
      findFirst: async ({ where, include }: any) => {
        if (state.workflow.companyId !== where.companyId || where.id !== state.workflow.id) return null;
        const base = { id: state.workflow.id, companyId: state.workflow.companyId };
        return include?.stages
          ? { ...base, stages: state.stages.slice().sort((a, b) => a.position - b.position) }
          : base;
      },
    },
    workflowStage: {
      create: async ({ data }: any) => {
        const stage = { id: `s${state.stages.length + 1}`, ...data };
        state.stages.push(stage);
        return stage;
      },
      findFirst: async ({ where }: any) => {
        const found = state.stages.find(
          (s) =>
            s.id === where.id &&
            s.workflowId === where.workflowId &&
            (where.active === undefined || s.active === where.active),
        );
        return found ?? null;
      },
      findMany: async ({ where }: any) =>
        state.stages
          .filter(
            (s) =>
              (!where || !where.workflowId || s.workflowId === where.workflowId) &&
              (where?.active === undefined || s.active === where.active),
          )
          .sort((a, b) => a.position - b.position),
      updateMany: async ({ where, data }: any) => {
        const stage = state.stages.find((s) => s.id === where.id && s.workflowId === where.workflowId);
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
    $transaction: async (fn: any) => (typeof fn === "function" ? fn(db) : Promise.all(fn)),
    __state: state,
  };
  return db;
}

const baseStages = [
  { id: "s1", workflowId: "w1", name: "Novo", position: 0, terminal: false, active: true },
  { id: "s2", workflowId: "w1", name: "Em andamento", position: 1, terminal: false, active: true },
  { id: "s3", workflowId: "w1", name: "Concluído", position: 2, terminal: true, active: true },
];

describe("Workflow stage configuration (R1)", () => {
  it("adds a custom non-terminal stage at the next position", async () => {
    const db = makeDb(baseStages);
    const stage = await addStage(db, "c1", "w1", { name: "Revisão" });
    expect(stage.position).toBe(3);
    expect(stage.terminal).toBe(false);
    expect(stage.name).toBe("Revisão");
  });

  it("rejects a blank or over-long stage name", async () => {
    const db = makeDb(baseStages);
    await expect(addStage(db, "c1", "w1", { name: "   " })).rejects.toMatchObject({ status: 400 });
    await expect(addStage(db, "c1", "w1", { name: "x".repeat(81) })).rejects.toMatchObject({ status: 400 });
  });

  it("renames an editable stage", async () => {
    const db = makeDb(baseStages);
    const stage = await renameStage(db, "c1", "w1", "s1", { name: "Backlog" });
    expect(stage!.name).toBe("Backlog");
  });

  it("rejects rename of a stage not in the tenant workflow", async () => {
    const db = makeDb(baseStages);
    await expect(renameStage(db, "other", "w1", "s1", { name: "X" })).rejects.toMatchObject({ status: 404 });
    await expect(renameStage(db, "c1", "other", "s1", { name: "X" })).rejects.toMatchObject({ status: 404 });
  });

  it("reorders active stages deterministically", async () => {
    const db = makeDb(baseStages);
    await reorderStages(db, "c1", "w1", ["s2", "s1", "s3"]);
    expect(db.__state.stages.find((s: any) => s.id === "s2").position).toBe(0);
    expect(db.__state.stages.find((s: any) => s.id === "s1").position).toBe(1);
    expect(db.__state.stages.find((s: any) => s.id === "s3").position).toBe(2);
  });

  it("rejects a reorder that does not match the active stage set", async () => {
    const db = makeDb(baseStages);
    await expect(reorderStages(db, "c1", "w1", ["s1", "s2"])).rejects.toMatchObject({ status: 400 });
    await expect(reorderStages(db, "c1", "w1", ["s1", "s1", "s3"])).rejects.toMatchObject({ status: 400 });
  });

  it("blocks removal of the protected terminal stage", async () => {
    const db = makeDb(baseStages);
    await expect(removeStage(db, "c1", "w1", "s3")).rejects.toMatchObject({ status: 400 });
  });

  it("blocks removal of a stage that has jobs", async () => {
    const withJobs = baseStages.map((s) =>
      s.id === "s2" ? { ...s, _count: { jobs: 3 } } : { ...s, _count: { jobs: 0 } },
    );
    const db = makeDb(withJobs);
    await expect(removeStage(db, "c1", "w1", "s2")).rejects.toMatchObject({ status: 409 });
  });

  it("archives an unused custom stage without deleting the row", async () => {
    const withCustom = [...baseStages, { id: "s4", workflowId: "w1", name: "Revisão", position: 3, terminal: false, active: true, _count: { jobs: 0 } }];
    const db = makeDb(withCustom);
    await removeStage(db, "c1", "w1", "s4");
    const archived = db.__state.stages.find((s: any) => s.id === "s4");
    expect(archived.active).toBe(false); // soft archive, row preserved
  });

  it("rejects cross-tenant workflow mutation", async () => {
    const db = makeDb(baseStages);
    await expect(addStage(db, "other", "w1", { name: "X" })).rejects.toMatchObject({ status: 404 });
    await expect(removeStage(db, "other", "w1", "s2")).rejects.toMatchObject({ status: 404 });
  });

  it("adds a dense position after archiving (no tombstone inflation)", async () => {
    const withCustom = [...baseStages, { id: "s4", workflowId: "w1", name: "Temp", position: 3, terminal: false, active: true, _count: { jobs: 0 } }];
    const db = makeDb(withCustom);
    await removeStage(db, "c1", "w1", "s4"); // archives s4 at position 10000
    const added = await addStage(db, "c1", "w1", { name: "Nova" });
    // The archived tombstone (position 10000) must NOT inflate the next position.
    expect(added.position).toBe(3);
  });
});
