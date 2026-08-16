import { describe, expect, it } from "vitest";
import { transitionJobLifecycle, updateJob } from "../src/services/jobService";

function makeDb(status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" = "OPEN") {
  const state = {
    jobs: [{ id: "j1", companyId: "c1", clientId: "cl1", lifecycleStatus: status }],
    updates: [] as unknown[],
    activities: [] as unknown[],
  };
  const db: any = {
    client: { findFirst: async () => ({ id: "cl1" }) },
    job: {
      findFirst: async ({ where }: any) => state.jobs.find((job) => job.id === where.id && job.companyId === where.companyId) ?? null,
      updateMany: async ({ where, data }: any) => {
        state.updates.push(data);
        const job = state.jobs.find((item) => item.id === where.id && item.companyId === where.companyId && (!where.lifecycleStatus || item.lifecycleStatus === where.lifecycleStatus));
        if (!job) return { count: 0 };
        Object.assign(job, data);
        return { count: 1 };
      },
    },
    activity: { create: async ({ data }: any) => state.activities.push(data) },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
    __state: state,
  };
  return db;
}

describe("Job lifecycle transitions", () => {
  it("does not let generic updateJob mutate lifecycleStatus", async () => {
    const db = makeDb();
    await updateJob(db, "c1", "u1", "j1", { title: "Updated", lifecycleStatus: "CANCELLED" } as never);
    expect(db.__state.jobs[0].lifecycleStatus).toBe("OPEN");
    expect(db.__state.updates).toEqual([{ title: "Updated" }]);
  });

  it.each([
    ["OPEN", "IN_PROGRESS"],
    ["IN_PROGRESS", "COMPLETED"],
    ["OPEN", "CANCELLED"],
    ["IN_PROGRESS", "CANCELLED"],
  ] as const)("allows %s -> %s", async (from, to) => {
    const db = makeDb(from);
    const result = await transitionJobLifecycle(db, "c1", "u1", "j1", to);
    expect(result?.lifecycleStatus).toBe(to);
  });

  it.each([
    ["CANCELLED", "OPEN"],
    ["CANCELLED", "IN_PROGRESS"],
    ["COMPLETED", "OPEN"],
    ["COMPLETED", "CANCELLED"],
  ] as const)("rejects %s -> %s", async (from, to) => {
    const db = makeDb(from);
    await expect(transitionJobLifecycle(db, "c1", "u1", "j1", to)).rejects.toMatchObject({ status: 409 });
    expect(db.__state.jobs[0].lifecycleStatus).toBe(from);
  });

  it("returns CANCELLED idempotently without deleting the Job", async () => {
    const db = makeDb("CANCELLED");
    const result = await transitionJobLifecycle(db, "c1", "u1", "j1", "CANCELLED");
    expect(result?.id).toBe("j1");
    expect(db.__state.jobs).toHaveLength(1);
    expect(db.__state.updates).toEqual([]);
  });

  it("rejects a foreign Job", async () => {
    const db = makeDb();
    await expect(transitionJobLifecycle(db, "other", "u1", "j1", "CANCELLED")).rejects.toMatchObject({ status: 404 });
  });

  it("uses the authenticated company in the update predicate", async () => {
    const db = makeDb();
    await transitionJobLifecycle(db, "c1", "u1", "j1", "CANCELLED");
    expect(db.__state.jobs[0].companyId).toBe("c1");
    expect(db.__state.jobs[0].lifecycleStatus).toBe("CANCELLED");
  });
});
