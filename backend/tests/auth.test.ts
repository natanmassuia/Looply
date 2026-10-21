import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { DB } from "../src/lib/db";
import { hashPassword, verifyPassword, newSessionToken, hashToken } from "../src/lib/password";
import { login, resolveAuth, switchCompany, logout } from "../src/services/authService";
import { makeRequireAuth, requireRole } from "../src/middleware/requireAuth";
import { SESSION_COOKIE, parseCookies, cookieOptions } from "../src/lib/session";
import { checkLoginRate } from "../src/lib/loginLimiter";

// ── Fake DB (no live database needed) ────────────────────────────────────
type Row = Record<string, any>;

function makeFakeDB(seed: {
  users?: Row[];
  companies?: Row[];
  members?: Row[];
  sessions?: Row[];
} = {}) {
  const state = {
    users: seed.users ?? [],
    companies: seed.companies ?? [],
    members: seed.members ?? [],
    sessions: seed.sessions ?? [],
  };
  const db: any = {
    user: {
      findUnique: async ({ where }: any) =>
        state.users.find((u) => u.id === where.id || u.email === where.email) ?? null,
    },
    company: {
      findUnique: async ({ where }: any) =>
        state.companies.find((c) => c.id === where.id || c.slug === where.slug) ?? null,
    },
    companyMember: {
      findUnique: async ({ where }: any) =>
        state.members.find(
          (m) =>
            m.id === where.id ||
            (where.userId_companyId &&
              m.userId === where.userId_companyId.userId &&
              m.companyId === where.userId_companyId.companyId),
        ) ?? null,
      findFirst: async ({ where }: any) =>
        state.members.find((m) => m.userId === where.userId && m.isActive) ?? null,
      findMany: async ({ where }: any) =>
        state.members
          .filter((m) => m.userId === where.userId && m.isActive === true)
          .map((m) => ({ ...m, company: state.companies.find((c) => c.id === m.companyId) })),
    },
    session: {
      findUnique: async ({ where }: any) =>
        state.sessions.find((s) => s.id === where.id) ?? null,
      create: async ({ data }: any) => (state.sessions.push({ ...data }), data),
      update: async ({ where, data }: any) => {
        const s = state.sessions.find((s) => s.id === where.id);
        if (s) Object.assign(s, data);
        return s;
      },
    },
  };
  return { db, state };
}

const now = () => new Date();
const future = () => new Date(Date.now() + 60 * 60 * 1000);
const past = () => new Date(Date.now() - 60 * 60 * 1000);

async function seedWorld() {
  const pass = await hashPassword("swordfish1");
  return makeFakeDB({
    users: [
      { id: "uA", name: "User A", email: "a@x.com", active: true, passwordHash: pass },
      { id: "uB", name: "User B", email: "b@x.com", active: true, passwordHash: pass },
      { id: "uInactive", name: "Off", email: "off@x.com", active: false, passwordHash: pass },
      { id: "uNoMember", name: "Lonely", email: "l@x.com", active: true, passwordHash: pass },
    ],
    companies: [
      { id: "cA", name: "Company A", slug: "a", isActive: true, workspaceTemplate: null },
      { id: "cB", name: "Company B", slug: "b", isActive: true, workspaceTemplate: null },
    ],
    members: [
      { id: "mA", userId: "uA", companyId: "cA", role: "OWNER", isActive: true },
      { id: "mB", userId: "uB", companyId: "cB", role: "MEMBER", isActive: true },
    ],
  });
}

// ── Password primitives ──────────────────────────────────────────────────
describe("password", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("swordfish1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("swordfish1", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("swordfish1", null)).toBe(false);
  });

  it("produces unique salts", async () => {
    expect(await hashPassword("x12345678")).not.toBe(await hashPassword("x12345678"));
  });

  it("session token is not stored in plaintext form usable as id", () => {
    const t = newSessionToken();
    expect(t.length).toBeGreaterThanOrEqual(64);
    expect(hashToken(t)).not.toBe(t);
  });
});

// ── Cookie helpers ───────────────────────────────────────────────────────
describe("cookie helpers", () => {
  it("parses cookies", () => {
    const c = parseCookies(`a=1; ${SESSION_COOKIE}=abc; b=2`);
    expect(c[SESSION_COOKIE]).toBe("abc");
    expect(parseCookies(undefined)).toEqual({});
  });

  it("production sets secure flag, dev does not", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(cookieOptions().secure).toBe(true);
    process.env.NODE_ENV = "development";
    expect(cookieOptions().secure).toBe(false);
    process.env.NODE_ENV = orig;
  });
});

// ── Login ────────────────────────────────────────────────────────────────
describe("login", () => {
  it("returns token + membership, never passwordHash", async () => {
    const { db } = await seedWorld();
    const r = await login(db as unknown as DB, "a@x.com", "swordfish1");
    expect(r.user.companyId).toBe("cA");
    expect(r.user.role).toBe("OWNER");
    expect(JSON.stringify(r)).not.toContain("passwordHash");
    expect(JSON.stringify(r)).not.toContain("swordfish1");
  });

  it("returns the workspace context so the frontend can route first access", async () => {
    const { db } = await seedWorld();
    const r = await login(db as unknown as DB, "a@x.com", "swordfish1");
    expect(r.workspace).toMatchObject({
      id: "cA",
      name: "Company A",
      template: null,
      status: "UNCONFIGURED",
    });
  });

  it("same generic error for unknown email, wrong password, inactive user", async () => {
    const { db } = await seedWorld();
    for (const [email, pw] of [
      ["ghost@x.com", "swordfish1"],
      ["a@x.com", "wrong-pass"],
      ["off@x.com", "swordfish1"],
    ]) {
      await expect(login(db as unknown as DB, email, pw)).rejects.toThrow(
        expect.objectContaining({ status: 401, code: "unauthorized", message: "Credenciais inválidas" }),
      );
    }
  });

  it("user without membership cannot login", async () => {
    const { db } = await seedWorld();
    await expect(login(db as unknown as DB, "l@x.com", "swordfish1")).rejects.toMatchObject({
      status: 403,
    });
  });
});

// ── Session resolution (auth middleware core) ────────────────────────────
describe("resolveAuth", () => {
  it("resolves a valid session to tenant context", async () => {
    const { db, state } = await seedWorld();
    const t = newSessionToken();
    state.sessions.push({ id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null });
    const r = await resolveAuth(db as unknown as DB, t);
    expect(r?.auth).toMatchObject({ userId: "uA", companyId: "cA", role: "OWNER" });
  });

  it("rejects: no token, unknown session, revoked, expired, inactive user, no membership", async () => {
    const { db, state } = await seedWorld();
    const mk = (over: Row = {}) => {
      const t = newSessionToken();
      state.sessions.push({
        id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null, ...over,
      });
      return t;
    };
    expect(await resolveAuth(db as unknown as DB, undefined)).toBeNull();
    expect(await resolveAuth(db as unknown as DB, newSessionToken())).toBeNull();
    expect(await resolveAuth(db as unknown as DB, mk({ revokedAt: now() }))).toBeNull();
    expect(await resolveAuth(db as unknown as DB, mk({ expiresAt: past() }))).toBeNull();
    expect(await resolveAuth(db as unknown as DB, mk({ userId: "uInactive" }))).toBeNull();
    expect(await resolveAuth(db as unknown as DB, mk({ userId: "uNoMember" }))).toBeNull();
  });

  it("membership revoked mid-session → access denied immediately", async () => {
    const { db, state } = await seedWorld();
    const t = newSessionToken();
    state.sessions.push({ id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null });
    state.members.find((m: Row) => m.id === "mA")!.isActive = false;
    expect(await resolveAuth(db as unknown as DB, t)).toBeNull();
  });

  it("falls back to first active membership when session company membership is gone", async () => {
    const { db, state } = await seedWorld();
    state.members.push({ id: "mA2", userId: "uA", companyId: "cB2", role: "MEMBER", isActive: true });
    state.companies.push({ id: "cB2", name: "C2", slug: "c2", isActive: true });
    const t = newSessionToken();
    // session points at cA but membership in cA was deactivated
    state.members.find((m: Row) => m.id === "mA")!.isActive = false;
    state.sessions.push({ id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null });
    const r = await resolveAuth(db as unknown as DB, t);
    expect(r?.auth.companyId).toBe("cB2");
  });
});

// ── Cross-tenant ─────────────────────────────────────────────────────────
describe("cross-tenant isolation", () => {
  it("user A cannot switch to company B", async () => {
    const { db, state } = await seedWorld();
    const t = newSessionToken();
    state.sessions.push({ id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null });
    await expect(switchCompany(db as unknown as DB, t, "cB")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("user B cannot switch to company A", async () => {
    const { db, state } = await seedWorld();
    const t = newSessionToken();
    state.sessions.push({ id: hashToken(t), userId: "uB", companyId: "cB", expiresAt: future(), revokedAt: null });
    await expect(switchCompany(db as unknown as DB, t, "cA")).rejects.toMatchObject({ status: 403 });
  });

  it("inactive membership denies switch even for own company", async () => {
    const { db, state } = await seedWorld();
    state.members.find((m: Row) => m.id === "mA")!.isActive = false;
    const t = newSessionToken();
    state.sessions.push({ id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null });
    await expect(switchCompany(db as unknown as DB, t, "cA")).rejects.toMatchObject({ status: 403 });
  });

  it("companyId in a request body NEVER appears in auth context", async () => {
    const { db, state } = await seedWorld();
    const t = newSessionToken();
    state.sessions.push({ id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null });
    const app = express();
    app.use(makeRequireAuth(db as unknown as DB));
    app.post("/probe", (req, res) => res.json({ auth: req.auth }));
    const res = await request(app)
      .post("/probe")
      .set("Cookie", `${SESSION_COOKIE}=${t}`)
      .send({ companyId: "cB" }); // attacker tries to select tenant B
    expect(res.status).toBe(200);
    expect(res.body.auth.companyId).toBe("cA"); // still tenant A
    expect(res.body.auth.companyId).not.toBe("cB");
  });

  it("middleware: 401 without cookie, 401 with forged cookie", async () => {
    const { db } = await seedWorld();
    const app = express();
    app.use(makeRequireAuth(db as unknown as DB));
    app.get("/probe", (req, res) => res.json({ auth: req.auth }));
    expect((await request(app).get("/probe")).status).toBe(401);
    expect(
      (await request(app).get("/probe").set("Cookie", `${SESSION_COOKIE}=deadbeef`)).status,
    ).toBe(401);
  });

  it("requireRole gates company-level roles", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).auth = { userId: "uA", companyId: "cA", role: "MEMBER" };
      next();
    });
    app.get("/admin", requireRole("OWNER", "ADMIN"), (_req, res) => res.json({ ok: true }));
    expect((await request(app).get("/admin")).status).toBe(403);
  });
});

// ── Logout ───────────────────────────────────────────────────────────────
describe("logout", () => {
  it("revokes the session and is idempotent", async () => {
    const { db, state } = await seedWorld();
    const t = newSessionToken();
    state.sessions.push({ id: hashToken(t), userId: "uA", companyId: "cA", expiresAt: future(), revokedAt: null });
    await logout(db as unknown as DB, t);
    expect(state.sessions[0].revokedAt).toBeTruthy();
    await expect(logout(db as unknown as DB, t)).resolves.toBeUndefined();
    expect(await resolveAuth(db as unknown as DB, t)).toBeNull();
  });
});

// ── Login rate limiter ───────────────────────────────────────────────────
describe("loginLimiter", () => {
  it("blocks after max attempts in window", () => {
    for (let i = 0; i < 10; i++) expect(checkLoginRate("k|v")).toBe(true);
    expect(checkLoginRate("k|v")).toBe(false);
    expect(checkLoginRate("other|v")).toBe(true);
  });
});
