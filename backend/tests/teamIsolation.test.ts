import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { SESSION_COOKIE } from "../src/lib/session";

// R2-01 — Tenant isolation proof for GET /api/team.
//
// The vulnerable pre-fix implementation ran db.user.findMany() globally, so any
// authenticated member of ANY company could enumerate every registered user's
// email/name/role (cross-tenant PII). These tests prove the endpoint now returns
// ONLY the authenticated company's members and never leaks another tenant's PII.
// They would FAIL against the pre-fix implementation.

const TENANT_A = { email: "natan@looply.dev", password: "looply123" }; // Loyal Tech (OWNER)
const TENANT_B = { email: "dono@testecorp.com", password: "senha-definitiva-123" }; // Teste Corp (OWNER)
const TENANT_B_MEMBER = "membro@testecorp.com";

// Resolve the companyId for a known tenant email, then return that company's
// member user identities (email, id, name).
async function memberIdentities(tenantEmail: string) {
  const myMembership = await prisma.companyMember.findFirst({
    where: { user: { email: tenantEmail } },
    select: { companyId: true },
  });
  if (!myMembership) throw new Error(`No membership for ${tenantEmail}`);
  const members = await prisma.companyMember.findMany({
    where: { companyId: myMembership.companyId },
    select: { user: { select: { email: true, id: true, name: true } } },
  });
  return {
    emails: members.map((m) => m.user.email),
    ids: members.map((m) => m.user.id),
    names: members.map((m) => m.user.name),
  };
}

describe.skipIf(!process.env.DATABASE_URL)("R2-01 /api/team tenant isolation", () => {
  it("Tenant A (Loyal Tech) sees ONLY A members and no Tenant B PII", async () => {
    const session = await login(prisma, TENANT_A.email, TENANT_A.password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const res = await request(app).get("/api/team").set("Cookie", cookie);
    expect(res.status).toBe(200);

    const emails = (res.body.team as { email: string }[]).map((u) => u.email);
    const ids = (res.body.team as { id: string }[]).map((u) => u.id);
    const names = (res.body.team as { name: string }[]).map((u) => u.name);
    const a = await memberIdentities(TENANT_A.email);
    const b = await memberIdentities(TENANT_B.email);

    // The authenticated OWNER is present (same-tenant behavior preserved).
    expect(emails).toContain(TENANT_A.email);
    // Every returned member is a Company A member; every Company A member appears.
    expect(emails.sort()).toEqual([...a.emails].sort());

    // No Tenant B PII leaks: no B email, no B user id, no B name.
    expect(emails.some((e) => b.emails.includes(e))).toBe(false);
    expect(ids.some((id) => b.ids.includes(id))).toBe(false);
    expect(names.some((n) => b.names.includes(n))).toBe(false);

    await logout(prisma, session.token);
  });

  it("Tenant B (Teste Corp) sees ONLY B members and no Tenant A PII", async () => {
    const session = await login(prisma, TENANT_B.email, TENANT_B.password);
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const res = await request(app).get("/api/team").set("Cookie", cookie);
    expect(res.status).toBe(200);

    const emails = (res.body.team as { email: string }[]).map((u) => u.email);
    const ids = (res.body.team as { id: string }[]).map((u) => u.id);
    const names = (res.body.team as { name: string }[]).map((u) => u.name);
    const a = await memberIdentities(TENANT_A.email);
    const b = await memberIdentities(TENANT_B.email);

    expect(emails).toContain(TENANT_B.email);
    expect(emails).toContain(TENANT_B_MEMBER);
    expect(emails.sort()).toEqual([...b.emails].sort());

    // No Tenant A PII leaks.
    expect(emails.some((e) => a.emails.includes(e))).toBe(false);
    expect(ids.some((id) => a.ids.includes(id))).toBe(false);
    expect(names.some((n) => a.names.includes(n))).toBe(false);

    await logout(prisma, session.token);
  });

  it("a non-owner MEMBER (marina@looply.dev) is also confined to Company A", async () => {
    const session = await login(prisma, "marina@looply.dev", "looply123");
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const res = await request(app).get("/api/team").set("Cookie", cookie);
    expect(res.status).toBe(200);

    const emails = (res.body.team as { email: string }[]).map((u) => u.email);
    // MEMBER sees their own company only.
    expect(emails).toContain("marina@looply.dev");
    expect(emails).not.toContain(TENANT_B.email);
    expect(emails).not.toContain(TENANT_B_MEMBER);

    await logout(prisma, session.token);
  });

  it("unauthenticated GET /api/team is blocked (401)", async () => {
    const res = await request(app).get("/api/team");
    expect(res.status).toBe(401);
  });
});
