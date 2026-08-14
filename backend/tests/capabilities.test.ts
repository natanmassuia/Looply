import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  Capability,
  TEMPLATE_REGISTRY,
  capabilitiesForTemplate,
  hasCapability,
  resolveWorkspaceContext,
} from "../src/domain/capabilities";
import { makeRequireCapability } from "../src/middleware/requireCapability";
import { SESSION_COOKIE } from "../src/lib/session";
import { hashToken, newSessionToken } from "../src/lib/password";

// ── Registry ─────────────────────────────────────────────────────────────
describe("template registry", () => {
  it("LOCAL_BUSINESS resolves exactly the expected capabilities", () => {
    expect(capabilitiesForTemplate("LOCAL_BUSINESS")).toEqual([
      Capability.CLIENTS,
      Capability.JOBS,
      Capability.WORKFLOW,
      Capability.FILES,
      Capability.CALENDAR,
      Capability.ACTIVITY,
      Capability.DASHBOARD,
    ]);
  });

  it("HIGH_TICKET resolves exactly the expected capabilities (no KANBAN)", () => {
    expect(capabilitiesForTemplate("HIGH_TICKET")).toEqual([
      Capability.CLIENTS,
      Capability.JOBS,
      Capability.WORKFLOW,
      Capability.FILES,
      Capability.APPROVAL,
      Capability.CALENDAR,
      Capability.ACTIVITY,
      Capability.DASHBOARD,
    ]);
  });

  it("MARKETING_AGENCY resolves the full capability set", () => {
    expect(capabilitiesForTemplate("MARKETING_AGENCY")).toEqual([
      Capability.CLIENTS,
      Capability.JOBS,
      Capability.WORKFLOW,
      Capability.KANBAN,
      Capability.FILES,
      Capability.APPROVAL,
      Capability.CALENDAR,
      Capability.ACTIVITY,
      Capability.DASHBOARD,
    ]);
  });

  it("unconfigured workspace (null) resolves to ZERO capabilities — no fallback", () => {
    expect(capabilitiesForTemplate(null)).toEqual([]);
    expect(capabilitiesForTemplate(undefined)).toEqual([]);
  });

  it("registry covers all three templates with a coherent capability lattice", () => {
    const keys = Object.keys(TEMPLATE_REGISTRY) as (keyof typeof TEMPLATE_REGISTRY)[];
    expect([...keys].sort()).toEqual(["HIGH_TICKET", "LOCAL_BUSINESS", "MARKETING_AGENCY"]);
    const local = new Set(TEMPLATE_REGISTRY.LOCAL_BUSINESS.capabilities);
    const high = new Set(TEMPLATE_REGISTRY.HIGH_TICKET.capabilities);
    const agency = new Set(TEMPLATE_REGISTRY.MARKETING_AGENCY.capabilities);
    // LOCAL_BUSINESS is a strict subset of HIGH_TICKET; agency is a superset.
    for (const cap of local) expect(high.has(cap)).toBe(true);
    expect(high.has(Capability.KANBAN)).toBe(false);
    expect(agency.has(Capability.KANBAN)).toBe(true);
    for (const cap of high) expect(agency.has(cap)).toBe(true);
  });
});

// ── hasCapability / resolveWorkspaceContext ──────────────────────────────
describe("hasCapability + workspace context", () => {
  it("true when present, false when absent", () => {
    expect(hasCapability("MARKETING_AGENCY", Capability.KANBAN)).toBe(true);
    expect(hasCapability("HIGH_TICKET", Capability.KANBAN)).toBe(false);
    expect(hasCapability(null, Capability.DASHBOARD)).toBe(false);
  });

  it("returns a copy (callers cannot mutate the registry)", () => {
    const a = capabilitiesForTemplate("HIGH_TICKET");
    a.push(Capability.KANBAN);
    expect(capabilitiesForTemplate("HIGH_TICKET")).not.toContain(Capability.KANBAN);
  });

  it("resolveWorkspaceContext reports UNCONFIGURED for null template", () => {
    const ctx = resolveWorkspaceContext({ id: "c1", name: "X", workspaceTemplate: null });
    expect(ctx.status).toBe("UNCONFIGURED");
    expect(ctx.capabilities).toEqual([]);
    expect(ctx.template).toBeNull();
  });

  it("resolveWorkspaceContext reports ACTIVE with capabilities", () => {
    const ctx = resolveWorkspaceContext({
      id: "c1",
      name: "X",
      workspaceTemplate: "LOCAL_BUSINESS",
    });
    expect(ctx.status).toBe("ACTIVE");
    expect(ctx.capabilities).toContain(Capability.CLIENTS);
    expect(ctx.capabilities).not.toContain(Capability.APPROVAL);
  });
});

// ── Guard (tenant-safe) ──────────────────────────────────────────────────
function makeFakeCompanyDB(companies: Array<{ id: string; workspaceTemplate: string | null }>) {
  return {
    company: {
      findUnique: async ({ where }: any) =>
        companies.find((c) => c.id === where.id) ?? null,
    },
  } as any;
}

describe("requireCapability guard", () => {
  const probe = (db: any, cap: Capability, auth?: object) => {
    const app = express();
    app.use((req: any, _res, next) => {
      if (auth) req.auth = auth;
      next();
    });
    app.get("/probe", makeRequireCapability(db, cap), (_req, res) => res.json({ ok: true }));
    return request(app).get("/probe");
  };

  it("allows when the tenant's company has the capability", async () => {
    const db = makeFakeCompanyDB([{ id: "cA", workspaceTemplate: "MARKETING_AGENCY" }]);
    const res = await probe(db, Capability.KANBAN, { userId: "uA", companyId: "cA", role: "MEMBER" });
    expect(res.status).toBe(200);
  });

  it("rejects (403) when the template lacks the capability", async () => {
    const db = makeFakeCompanyDB([{ id: "cA", workspaceTemplate: "HIGH_TICKET" }]);
    const res = await probe(db, Capability.KANBAN, { userId: "uA", companyId: "cA", role: "OWNER" });
    expect(res.status).toBe(403);
  });

  it("rejects (403) unconfigured workspace — null grants nothing, even to OWNER", async () => {
    const db = makeFakeCompanyDB([{ id: "cA", workspaceTemplate: null }]);
    const res = await probe(db, Capability.DASHBOARD, { userId: "uA", companyId: "cA", role: "OWNER" });
    expect(res.status).toBe(403);
  });

  it("rejects without tenant context (requireAuth runs first in real app)", async () => {
    const db = makeFakeCompanyDB([{ id: "cA", workspaceTemplate: "MARKETING_AGENCY" }]);
    const res = await probe(db, Capability.KANBAN);
    expect(res.status).toBe(403);
  });

  it("role never changes capabilities: MEMBER and OWNER see the same answer", async () => {
    const db = makeFakeCompanyDB([{ id: "cA", workspaceTemplate: "LOCAL_BUSINESS" }]);
    for (const role of ["OWNER", "ADMIN", "MEMBER"]) {
      const res = await probe(db, Capability.APPROVAL, { userId: "uA", companyId: "cA", role });
      expect(res.status).toBe(403); // LOCAL_BUSINESS has no APPROVAL for any role
    }
  });

  it("tenant A never resolves tenant B's company: guard only reads auth.companyId", async () => {
    const db = makeFakeCompanyDB([{ id: "cB", workspaceTemplate: "MARKETING_AGENCY" }]);
    // A is member of cA only; db has ONLY cB. Guard asks for auth.companyId (cA) → miss → 403.
    const res = await probe(db, Capability.KANBAN, { userId: "uA", companyId: "cA", role: "OWNER" });
    expect(res.status).toBe(403);
  });

  it("body/query company spoofing never reaches the guard (it only reads req.auth)", async () => {
    const db = makeFakeCompanyDB([{ id: "cA", workspaceTemplate: "LOCAL_BUSINESS" }]);
    const app = express();
    app.use((req: any, _res, next) => {
      req.auth = { userId: "uA", companyId: "cA", role: "MEMBER" };
      next();
    });
    app.post("/probe", makeRequireCapability(db, Capability.KANBAN), (_req, res) => res.json({ ok: true }));
    const res = await request(app)
      .post("/probe")
      .send({ companyId: "cB", capabilities: ["KANBAN"], templateCapabilities: ["KANBAN"] });
    expect(res.status).toBe(403);
  });
});

// ── Session token helper regression (guard dependencies) ─────────────────
describe("session token helpers still sound", () => {
  it("hashToken differs from token", () => {
    const t = newSessionToken();
    expect(hashToken(t)).not.toBe(t);
    expect(SESSION_COOKIE).toBe("looply_session");
  });
});
