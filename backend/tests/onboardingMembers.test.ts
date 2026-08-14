import { describe, it, expect } from "vitest";
import {
  provisionWorkspace,
  getOnboardingStatus,
  selectTemplate,
  completeOnboarding,
  assertNewPasswordOk,
} from "../src/services/onboardingService";
import {
  createInvitation,
  acceptInvitation,
  updateMember,
  revokeInvitation,
} from "../src/services/memberService";
import { hashPassword, verifyPassword, newSessionToken, hashToken } from "../src/lib/password";
import { randomToken } from "../src/lib/token";
import type { DB } from "../src/lib/db";

// ── Fake DB ──────────────────────────────────────────────────────────────
function makeFakeDB() {
  const state: Record<string, any[]> = {
    users: [], companies: [], members: [], sessions: [], invitations: [],
  };
  const db: any = {
    user: {
      findUnique: async ({ where }: any) =>
        state.users.find((u) => u.id === where.id || u.email === where.email) ?? null,
      findFirst: async () => null,
      create: async ({ data }: any) => (state.users.push({ id: `u${state.users.length + 1}`, ...data }), state.users.at(-1)),
      update: async ({ where, data }: any) => {
        const u = state.users.find((u) => u.id === where.id);
        Object.assign(u, data);
        return u;
      },
      updateMany: async ({ where, data }: any) => {
        let n = 0;
        for (const s of state.users) if (s.id === where.id) { Object.assign(s, data); n++; }
        return { count: n };
      },
    },
    company: {
      findUnique: async ({ where }: any) =>
        state.companies.find((c) => c.id === where.id || c.slug === where.slug) ?? null,
      create: async ({ data }: any) => (state.companies.push({ id: `c${state.companies.length + 1}`, ...data }), state.companies.at(-1)),
      update: async ({ where, data }: any) => {
        const c = state.companies.find((c) => c.id === where.id);
        Object.assign(c, data);
        return c;
      },
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
      findFirst: async ({ where }: any) => {
        // Used by: existingMember check (companyId + user.email) and others.
        if (where?.user?.email) {
          const u = state.users.find((x) => x.email === where.user.email);
          return (
            state.members.find(
              (m) => m.companyId === where.companyId && u && m.userId === u.id,
            ) ?? null
          );
        }
        return state.members.find((m) => Object.entries(where).every(([k, v]) => m[k] === v)) ?? null;
      },
      findMany: async ({ where }: any) =>
        state.members.filter((m) => m.companyId === where.companyId),
      count: async ({ where }: any) =>
        state.members.filter((m) => m.companyId === where.companyId && m.role === where.role && m.isActive).length,
      create: async ({ data }: any) => (state.members.push({ id: `m${state.members.length + 1}`, ...data }), state.members.at(-1)),
      update: async ({ where, data }: any) => {
        const m = state.members.find((m) => m.id === where.id);
        Object.assign(m, data);
        return m;
      },
      updateMany: async ({ where, data }: any) => {
        const m = state.members.find((m) => m.id === where.id && m.companyId === where.companyId);
        if (!m) return { count: 0 };
        Object.assign(m, data);
        return { count: 1 };
      },
    },
    session: {
      findUnique: async ({ where }: any) => state.sessions.find((s) => s.id === where.id) ?? null,
      create: async ({ data }: any) => (state.sessions.push(data), data),
      updateMany: async ({ where, data }: any) => {
        let n = 0;
        for (const s of state.sessions) if (s.userId === where.userId && !s.revokedAt) { Object.assign(s, data); n++; }
        return { count: n };
      },
    },
    invitation: {
      findUnique: async ({ where }: any) =>
        state.invitations.find((i) => i.id === where.id || i.tokenHash === where.tokenHash) ?? null,
      findFirst: async ({ where }: any) =>
        state.invitations.find(
          (i) =>
            i.companyId === where.companyId &&
            (!where.email || i.email === where.email) &&
            !i.acceptedAt && !i.revokedAt,
        ) ?? null,
      findMany: async () => state.invitations,
      create: async ({ data }: any) => (state.invitations.push({ id: `i${state.invitations.length + 1}`, ...data }), state.invitations.at(-1)),
      update: async ({ where, data }: any) => {
        const i = state.invitations.find((i) => i.id === where.id);
        Object.assign(i, data);
        return i;
      },
      updateMany: async ({ where, data }: any) => {
        const i = state.invitations.find((i) => i.id === where.id && i.companyId === where.companyId);
        if (!i) return { count: 0 };
        Object.assign(i, data);
        return { count: 1 };
      },
    },
  };
  return { db: db as unknown as DB, state };
}

const past = () => new Date(Date.now() - 3600_000);

// ── Provisioning + first login ───────────────────────────────────────────
describe("provisioning", () => {
  it("creates user with temp password + unconfigured company + OWNER membership", async () => {
    const { db, state } = makeFakeDB();
    const r = await provisionWorkspace(db, { ownerName: "Ana", ownerEmail: "Ana@Corp.com", companyName: "Corp" });
    expect(r.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(state.users[0].email).toBe("ana@corp.com"); // lowercased
    expect(state.users[0].mustChangePassword).toBe(true);
    expect(state.users[0].passwordHash.startsWith("scrypt$")).toBe(true);
    expect(state.companies[0].workspaceTemplate).toBeUndefined(); // null-ish = UNCONFIGURED
    expect(state.members[0].role).toBe("OWNER");
    // Temp password verifies against the hash
    expect(await verifyPassword(r.temporaryPassword, state.users[0].passwordHash)).toBe(true);
  });

  it("refuses duplicate email", async () => {
    const { db } = makeFakeDB();
    await provisionWorkspace(db, { ownerName: "A", ownerEmail: "a@x.com", companyName: "C" });
    await expect(
      provisionWorkspace(db, { ownerName: "A", ownerEmail: "a@x.com", companyName: "C2" }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

// ── Onboarding state machine ─────────────────────────────────────────────
describe("onboarding", () => {
  async function seeded() {
    const w = makeFakeDB();
    const r = await provisionWorkspace(w.db, { ownerName: "Ana", ownerEmail: "a@x.com", companyName: "Corp" });
    const auth = { userId: r.userId, companyId: r.companyId };
    return { ...w, auth, prov: r };
  }

  it("status: PASSWORD_CHANGE_REQUIRED right after provisioning", async () => {
    const { db, auth } = await seeded();
    const s = await getOnboardingStatus(db, auth);
    expect(s.status).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(s.mustChangePassword).toBe(true);
    expect(s.readyToComplete).toBe(false);
  });

  it("rejects invalid template, accepts valid one, blocks change after ACTIVE", async () => {
    const { db, auth } = await seeded();
    await expect(selectTemplate(db, auth.companyId, "ENTERPRISE_MEGA")).rejects.toMatchObject({ status: 400 });
    await selectTemplate(db, auth.companyId, "HIGH_TICKET");
    // simulate password changed
    await db.user.update({ where: { id: auth.userId }, data: { mustChangePassword: false } });
    await completeOnboarding(db, auth);
    await expect(selectTemplate(db, auth.companyId, "LOCAL_BUSINESS")).rejects.toMatchObject({ status: 409 });
  });

  it("complete refuses while password pending or template missing; ACTIVE only when all set", async () => {
    const { db, auth } = await seeded();
    await selectTemplate(db, auth.companyId, "LOCAL_BUSINESS");
    await expect(completeOnboarding(db, auth)).rejects.toMatchObject({ status: 400 }); // password pending
    await db.user.update({ where: { id: auth.userId }, data: { mustChangePassword: false } });
    await db.company.update({ where: { id: auth.companyId }, data: { workspaceTemplate: null } });
    await expect(completeOnboarding(db, auth)).rejects.toMatchObject({ status: 400 }); // template missing
    await selectTemplate(db, auth.companyId, "LOCAL_BUSINESS");
    const s = await completeOnboarding(db, auth);
    expect(s.status).toBe("ACTIVE");
    expect(s.company.onboardedAt).toBeTruthy();
  });

  it("password policy: min 10 chars", () => {
    expect(() => assertNewPasswordOk("short")).toThrow();
    expect(() => assertNewPasswordOk("longenough123")).not.toThrow();
    expect(() => assertNewPasswordOk(42 as unknown)).toThrow();
  });
});

// ── Members + role rules ─────────────────────────────────────────────────
describe("members", () => {
  async function world() {
    const w = makeFakeDB();
    await w.db.company.create({ data: { id: "c1", name: "A", isActive: true, workspaceTemplate: "HIGH_TICKET", onboardedAt: new Date() } });
    await w.db.company.create({ data: { id: "c2", name: "B", isActive: true, workspaceTemplate: "HIGH_TICKET", onboardedAt: new Date() } });
    await w.db.user.create({ data: { id: "u1", name: "O", email: "o@a.com", active: true } });
    await w.db.user.create({ data: { id: "u2", name: "M", email: "m@a.com", active: true } });
    await w.db.companyMember.create({ data: { id: "m1", userId: "u1", companyId: "c1", role: "OWNER", isActive: true } });
    await w.db.companyMember.create({ data: { id: "m2", userId: "u2", companyId: "c1", role: "MEMBER", isActive: true } });
    await w.db.companyMember.create({ data: { id: "m3", userId: "u2", companyId: "c2", role: "OWNER", isActive: true } }); // u2 owner of OTHER company
    return w;
  }

  it("non-OWNER cannot manage members", async () => {
    const { db } = await world();
    await expect(updateMember(db, "c1", "m1", "MEMBER", { role: "ADMIN" })).rejects.toMatchObject({ status: 403 });
  });

  it("cannot demote/deactivate the last active OWNER", async () => {
    const { db } = await world();
    await expect(updateMember(db, "c1", "m1", "OWNER", { role: "MEMBER" })).rejects.toMatchObject({ status: 409 });
    await expect(updateMember(db, "c1", "m1", "OWNER", { isActive: false })).rejects.toMatchObject({ status: 409 });
  });

  it("OWNER can promote MEMBER; a second OWNER can be demoted", async () => {
    const { db } = await world();
    await updateMember(db, "c1", "m2", "OWNER", { role: "OWNER" });
    await updateMember(db, "c1", "m1", "OWNER", { role: "MEMBER" }); // now OK, m2 is OWNER
    const m = (await db.companyMember.findUnique({ where: { id: "m1" } as any }))!;
    expect(m.role).toBe("MEMBER");
  });

  it("cross-tenant: member record of another company is not found (404), not patched", async () => {
    const { db } = await world();
    await expect(updateMember(db, "c1", "m3", "OWNER", { role: "MEMBER" })).rejects.toMatchObject({ status: 404 });
  });
});

// ── Invitations ──────────────────────────────────────────────────────────
describe("invitations", () => {
  async function world() {
    const w = makeFakeDB();
    await w.db.company.create({ data: { id: "c1", name: "A", isActive: true, workspaceTemplate: "HIGH_TICKET", onboardedAt: new Date() } });
    await w.db.company.create({ data: { id: "c2", name: "B", isActive: true, workspaceTemplate: "HIGH_TICKET", onboardedAt: new Date() } });
    await w.db.user.create({ data: { id: "u1", name: "O", email: "o@a.com", active: true } });
    await w.db.companyMember.create({ data: { id: "m1", userId: "u1", companyId: "c1", role: "OWNER", isActive: true } });
    return w;
  }
  const ownerAuth = { userId: "u1", companyId: "c1", role: "OWNER" };

  it("creates invitation with hashed token; plaintext returned once", async () => {
    const { db, state } = await world();
    const r = await createInvitation(db, ownerAuth, { email: "New@X.com", role: "MEMBER" });
    expect(r.token.length).toBeGreaterThanOrEqual(64);
    const row = state.invitations[0];
    expect(row.tokenHash).toBe(hashToken(r.token));
    expect(row.tokenHash).not.toBe(r.token);
    expect(row.email).toBe("new@x.com");
  });

  it("MEMBER cannot invite; ADMIN can only invite MEMBER", async () => {
    const { db } = await world();
    await expect(createInvitation(db, { userId: "u9", companyId: "c1", role: "MEMBER" }, { email: "z@x.com", role: "MEMBER" })).rejects.toMatchObject({ status: 403 });
    await expect(createInvitation(db, { userId: "u9", companyId: "c1", role: "ADMIN" }, { email: "z@x.com", role: "ADMIN" })).rejects.toMatchObject({ status: 403 });
    await expect(createInvitation(db, { userId: "u9", companyId: "c1", role: "ADMIN" }, { email: "z@x.com", role: "MEMBER" })).resolves.toBeTruthy();
  });

  it("duplicate pending invite and existing member are rejected", async () => {
    const { db } = await world();
    await createInvitation(db, ownerAuth, { email: "z@x.com", role: "MEMBER" });
    await expect(createInvitation(db, ownerAuth, { email: "z@x.com", role: "MEMBER" })).rejects.toMatchObject({ status: 409 });
    await expect(createInvitation(db, ownerAuth, { email: "o@a.com", role: "MEMBER" })).rejects.toMatchObject({ status: 409 });
  });

  it("cannot invite while workspace not ACTIVE", async () => {
    const { db } = await world();
    await db.company.update({ where: { id: "c1" }, data: { onboardedAt: null } });
    await expect(createInvitation(db, ownerAuth, { email: "z@x.com", role: "MEMBER" })).rejects.toMatchObject({ status: 409 });
  });

  it("accept: new user path creates user+membership and burns the token", async () => {
    const { db, state } = await world();
    const inv = await createInvitation(db, ownerAuth, { email: "z@x.com", role: "MEMBER" });
    const r = await acceptInvitation(db, { token: inv.token, name: "Zé", password: "longenough123" });
    expect(r.role).toBe("MEMBER");
    expect(state.invitations[0].acceptedAt).toBeTruthy();
    // replay fails
    await expect(acceptInvitation(db, { token: inv.token, name: "Zé", password: "longenough123" })).rejects.toMatchObject({ status: 400 });
  });

  it("accept: existing user requires matching session; wrong/absent auth rejected", async () => {
    const { db } = await world();
    await db.user.create({ data: { id: "u5", name: "E", email: "e@x.com", active: true } });
    const inv = await createInvitation(db, ownerAuth, { email: "e@x.com", role: "MEMBER" });
    await expect(acceptInvitation(db, { token: inv.token })).rejects.toMatchObject({ status: 403 });
    await expect(acceptInvitation(db, { token: inv.token, authUserId: "u1" })).rejects.toMatchObject({ status: 403 });
    const r = await acceptInvitation(db, { token: inv.token, authUserId: "u5" });
    expect(r.userId).toBe("u5");
  });

  it("accept rejects: invalid, revoked, expired, weak password", async () => {
    const { db } = await world();
    await expect(acceptInvitation(db, { token: randomToken(32) })).rejects.toMatchObject({ status: 400 });
    const rev = await createInvitation(db, ownerAuth, { email: "r@x.com", role: "MEMBER" });
    await revokeInvitation(db, "c1", "OWNER", (await (db as any).invitation.findMany({ where: {} }))[0].id);
    await db.invitation.update({ where: { id: rev.invitationId }, data: { revokedAt: new Date() } });
    await expect(acceptInvitation(db, { token: rev.token, name: "R", password: "longenough123" })).rejects.toMatchObject({ status: 400 });
    const exp = await createInvitation(db, ownerAuth, { email: "q@x.com", role: "MEMBER" });
    await db.invitation.update({ where: { id: exp.invitationId }, data: { expiresAt: past() } });
    await expect(acceptInvitation(db, { token: exp.token, name: "Q", password: "longenough123" })).rejects.toMatchObject({ status: 400 });
    const wk = await createInvitation(db, ownerAuth, { email: "w@x.com", role: "MEMBER" });
    await expect(acceptInvitation(db, { token: wk.token, name: "W", password: "short" })).rejects.toMatchObject({ status: 400 });
  });

  it("new invited user must set password of policy length; hash stored, plaintext never", async () => {
    const { db, state } = await world();
    const inv = await createInvitation(db, ownerAuth, { email: "n@x.com", role: "MEMBER" });
    await acceptInvitation(db, { token: inv.token, name: "N", password: "longenough123" });
    const u = state.users.find((u: any) => u.email === "n@x.com");
    expect(u.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(u.mustChangePassword).toBe(false);
    expect(JSON.stringify(state.invitations)).not.toContain("longenough123");
  });
});

// ── Password rotation on change ──────────────────────────────────────────
describe("password change semantics (unit)", () => {
  it("hashPassword/verifyPassword: new password valid, old rejected", async () => {
    const old = await hashPassword("temporary1234");
    const nw = await hashPassword("brand-new-pass");
    expect(await verifyPassword("temporary1234", old)).toBe(true);
    expect(await verifyPassword("temporary1234", nw)).toBe(false);
    expect(await verifyPassword("brand-new-pass", nw)).toBe(true);
  });

  it("session token helpers remain hash-based", () => {
    expect(hashToken(newSessionToken())).toMatch(/^[0-9a-f]{64}$/);
  });
});
