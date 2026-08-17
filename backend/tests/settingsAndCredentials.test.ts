import { describe, it, expect } from "vitest";
import { resetMemberPassword } from "../src/services/memberService";
import { isValidTimezone } from "../src/routes/settings";
import { verifyPassword } from "../src/lib/password";
import type { DB } from "../src/lib/db";

function makeFakeDB() {
  const state: Record<string, any[]> = {
    users: [
      { id: "u-owner", name: "Owner User", email: "owner@looply.com", passwordHash: "hash1", mustChangePassword: false },
      { id: "u-admin", name: "Admin User", email: "admin@looply.com", passwordHash: "hash2", mustChangePassword: false },
      { id: "u-member", name: "Member User", email: "member@looply.com", passwordHash: "hash3", mustChangePassword: false },
      { id: "u-other", name: "Other Tenant", email: "other@other.com", passwordHash: "hash4", mustChangePassword: false },
    ],
    companies: [
      { id: "c1", name: "Looply Agência", timezone: "America/Sao_Paulo", isActive: true },
      { id: "c2", name: "Other Corp", timezone: "UTC", isActive: true },
    ],
    members: [
      { id: "m-owner", userId: "u-owner", companyId: "c1", role: "OWNER", isActive: true },
      { id: "m-admin", userId: "u-admin", companyId: "c1", role: "ADMIN", isActive: true },
      { id: "m-member", userId: "u-member", companyId: "c1", role: "MEMBER", isActive: true },
      { id: "m-other", userId: "u-other", companyId: "c2", role: "MEMBER", isActive: true },
    ],
    sessions: [
      { id: "s1", userId: "u-member", companyId: "c1", revokedAt: null },
      { id: "s2", userId: "u-member", companyId: "c1", revokedAt: null },
      { id: "s3", userId: "u-owner", companyId: "c1", revokedAt: null },
    ],
  };

  const db: any = {
    user: {
      findUnique: async ({ where }: any) =>
        state.users.find((u) => u.id === where.id || u.email === where.email) ?? null,
      update: async ({ where, data }: any) => {
        const u = state.users.find((u) => u.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      },
    },
    company: {
      findUnique: async ({ where }: any) =>
        state.companies.find((c) => c.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const c = state.companies.find((c) => c.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
    },
    companyMember: {
      findFirst: async ({ where }: any) => {
        const m = state.members.find(
          (x) =>
            (!where.id || x.id === where.id) &&
            (!where.companyId || x.companyId === where.companyId) &&
            (!where.userId || x.userId === where.userId),
        );
        if (!m) return null;
        const u = state.users.find((u) => u.id === m.userId);
        return { ...m, user: u };
      },
    },
    session: {
      updateMany: async ({ where, data }: any) => {
        let n = 0;
        for (const s of state.sessions) {
          if (s.userId === where.userId && (where.revokedAt === undefined || s.revokedAt === where.revokedAt)) {
            Object.assign(s, data);
            n++;
          }
        }
        return { count: n };
      },
    },
    _state: state,
  };

  return db;
}

describe("Company Settings & Timezone Validation", () => {
  it("validates standard IANA timezones accurately", () => {
    expect(isValidTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimezone("America/Manaus")).toBe(true);
    expect(isValidTimezone("America/Fortaleza")).toBe(true);
    expect(isValidTimezone("America/Cuiaba")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);

    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("Invalid/Timezone")).toBe(false);
    expect(isValidTimezone("America/Fake_City")).toBe(false);
    expect(isValidTimezone("GMT+3")).toBe(false);
  });
});

describe("User Credential Management — resetMemberPassword", () => {
  it("allows OWNER to reset MEMBER password and revokes existing sessions", async () => {
    const db = makeFakeDB();
    const result = await resetMemberPassword(db as unknown as DB, "c1", "u-owner", "OWNER", "m-member");

    expect(result.temporaryPassword).toBeDefined();
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(result.user.email).toBe("member@looply.com");

    const memberUser = db._state.users.find((u: any) => u.id === "u-member");
    expect(memberUser.mustChangePassword).toBe(true);
    expect(await verifyPassword(result.temporaryPassword, memberUser.passwordHash)).toBe(true);

    // Sessions revoked
    const memberSessions = db._state.sessions.filter((s: any) => s.userId === "u-member");
    expect(memberSessions.every((s: any) => s.revokedAt !== null)).toBe(true);
  });

  it("allows ADMIN to reset MEMBER password", async () => {
    const db = makeFakeDB();
    const result = await resetMemberPassword(db as unknown as DB, "c1", "u-admin", "ADMIN", "m-member");

    expect(result.temporaryPassword).toBeDefined();
    const memberUser = db._state.users.find((u: any) => u.id === "u-member");
    expect(memberUser.mustChangePassword).toBe(true);
  });

  it("prevents ADMIN from resetting OWNER password", async () => {
    const db = makeFakeDB();
    await expect(
      resetMemberPassword(db as unknown as DB, "c1", "u-admin", "ADMIN", "m-owner"),
    ).rejects.toThrow(/Administradores não podem redefinir senha/i);
  });

  it("prevents ADMIN from resetting another ADMIN password", async () => {
    const db = makeFakeDB();
    db._state.members.push({ id: "m-admin2", userId: "u-admin2", companyId: "c1", role: "ADMIN", isActive: true });
    db._state.users.push({ id: "u-admin2", name: "Admin 2", email: "admin2@looply.com", passwordHash: "h", mustChangePassword: false });

    await expect(
      resetMemberPassword(db as unknown as DB, "c1", "u-admin", "ADMIN", "m-admin2"),
    ).rejects.toThrow(/Administradores não podem redefinir senha/i);
  });

  it("prevents self-reset via administrative endpoint", async () => {
    const db = makeFakeDB();
    await expect(
      resetMemberPassword(db as unknown as DB, "c1", "u-owner", "OWNER", "m-owner"),
    ).rejects.toThrow(/Para alterar sua própria senha/i);
  });

  it("prevents resetting members from another company (tenant isolation)", async () => {
    const db = makeFakeDB();
    await expect(
      resetMemberPassword(db as unknown as DB, "c1", "u-owner", "OWNER", "m-other"),
    ).rejects.toThrow(/Membro não encontrado/i);
  });

  it("rejects non-owner non-admin role", async () => {
    const db = makeFakeDB();
    await expect(
      resetMemberPassword(db as unknown as DB, "c1", "u-member", "MEMBER", "m-admin"),
    ).rejects.toThrow(/Sem permissão/i);
  });

  it("supports company business phone and logoUrl updates in fake DB", async () => {
    const db = makeFakeDB();
    await db.company.update({
      where: { id: "c1" },
      data: { phone: "+55 11 98888-7777", logoUrl: "https://example.com/logo.png" },
    });
    const c1 = await db.company.findUnique({ where: { id: "c1" } });
    expect(c1.phone).toBe("+55 11 98888-7777");
    expect(c1.logoUrl).toBe("https://example.com/logo.png");
  });

  it("supports user self-service profile update with personal phone", async () => {
    const db = makeFakeDB();
    await db.user.update({
      where: { id: "u-member" },
      data: { name: "Member Updated", phone: "+55 11 99999-1234", avatarUrl: "https://example.com/avatar.jpg" },
    });
    const u = await db.user.findUnique({ where: { id: "u-member" } });
    expect(u.name).toBe("Member Updated");
    expect(u.phone).toBe("+55 11 99999-1234");
    expect(u.avatarUrl).toBe("https://example.com/avatar.jpg");
  });
});
