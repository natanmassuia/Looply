import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { Capability } from "../src/domain/capabilities";
import {
  provisionWhatsAppIdentity,
  resolveWhatsAppActor,
  WHATSAPP_IDENTITY_PROVIDER,
} from "../src/services/whatsappActorService";
import { makeWhatsAppIdentitiesRouter } from "../src/routes/whatsappIdentities";

const PHONE = "+5511987654321";

function makeDb(seed: {
  identities?: any[];
  members?: any[];
}) {
  const state = {
    identities: seed.identities ?? [],
    members: seed.members ?? [],
  };
  const db: any = {
    // Client phones are never actor identities: any attempt to consult the
    // Client table for actor resolution must fail loudly in tests.
    client: {
      findFirst: async () => {
        throw new Error("actor resolution must not query clients");
      },
    },
    whatsAppIdentity: {
      findUnique: async ({ where }: any) => {
        if (where.provider_phoneNumber) {
          const { provider, phoneNumber } = where.provider_phoneNumber;
          return state.identities.find((i) => i.provider === provider && i.phoneNumber === phoneNumber) ?? null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `wi_${state.identities.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.identities.push(row);
        return row;
      },
    },
    companyMember: {
      findUnique: async ({ where }: any) => {
        const { userId, companyId } = where.userId_companyId;
        return state.members.find((m) => m.userId === userId && m.companyId === companyId) ?? null;
      },
    },
  };
  return { db, state };
}

function identityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wi1",
    userId: "u1",
    companyId: "cA",
    provider: WHATSAPP_IDENTITY_PROVIDER,
    phoneNumber: PHONE,
    enabled: true,
    user: { id: "u1", active: true },
    company: { id: "cA", isActive: true, workspaceTemplate: "MARKETING_AGENCY" },
    ...overrides,
  };
}

describe("WhatsApp actor resolution", () => {
  it("resolves a valid identity with active membership and derives capabilities from the company template", async () => {
    const { db } = makeDb({
      identities: [identityRow()],
      members: [{ userId: "u1", companyId: "cA", isActive: true }],
    });
    const actor = await resolveWhatsAppActor(db, WHATSAPP_IDENTITY_PROVIDER, "11 98765-4321");
    expect(actor).toEqual({
      userId: "u1",
      companyId: "cA",
      capabilities: expect.arrayContaining([Capability.CALENDAR, Capability.JOBS, Capability.KANBAN]),
    });
  });

  it("does not resolve unknown, disabled, inactive-user, or unconfigured-company identities", async () => {
    const cases = [
      { identities: [], members: [] }, // unknown phone
      { identities: [identityRow({ enabled: false })], members: [{ userId: "u1", companyId: "cA", isActive: true }] },
      { identities: [identityRow({ user: { id: "u1", active: false } })], members: [{ userId: "u1", companyId: "cA", isActive: true }] },
      { identities: [identityRow({ company: { id: "cA", isActive: false, workspaceTemplate: "MARKETING_AGENCY" } })], members: [{ userId: "u1", companyId: "cA", isActive: true }] },
      { identities: [identityRow({ company: { id: "cA", isActive: true, workspaceTemplate: null } })], members: [{ userId: "u1", companyId: "cA", isActive: true }] },
    ];
    for (const seed of cases) {
      const { db } = makeDb(seed);
      expect(await resolveWhatsAppActor(db, WHATSAPP_IDENTITY_PROVIDER, PHONE)).toBeNull();
    }
  });

  it("does not resolve when the stored company has no active membership (no synthesized membership)", async () => {
    const { db } = makeDb({
      identities: [identityRow()],
      members: [{ userId: "u1", companyId: "cOTHER", isActive: true }],
    });
    expect(await resolveWhatsAppActor(db, WHATSAPP_IDENTITY_PROVIDER, PHONE)).toBeNull();
  });

  it("does not resolve when the membership is deactivated even though the identity row remains", async () => {
    const { db } = makeDb({
      identities: [identityRow()],
      members: [{ userId: "u1", companyId: "cA", isActive: false }],
    });
    expect(await resolveWhatsAppActor(db, WHATSAPP_IDENTITY_PROVIDER, PHONE)).toBeNull();
  });

  it("never treats a Client phone as an actor and uses no substring matching", async () => {
    const { db } = makeDb({ identities: [identityRow({ phoneNumber: "+5511987654321" })], members: [] });
    // Different number (one digit shorter) must not match the stored identity.
    expect(await resolveWhatsAppActor(db, WHATSAPP_IDENTITY_PROVIDER, "+551198765432")).toBeNull();
    // Client table is never consulted: resolution above returned null without throwing.
  });

  it("isolates providers", async () => {
    const { db } = makeDb({
      identities: [identityRow()],
      members: [{ userId: "u1", companyId: "cA", isActive: true }],
    });
    expect(await resolveWhatsAppActor(db, "telegram", PHONE)).toBeNull();
  });
});

describe("WhatsApp identity provisioning", () => {
  it("creates a mapping for a same-company member with normalized phone", async () => {
    const { db, state } = makeDb({ members: [{ userId: "u2", companyId: "cA", isActive: true }] });
    const created = await provisionWhatsAppIdentity(db, { companyId: "cA", role: "OWNER" }, {
      userId: "u2",
      phoneNumber: "11 98765-4322",
    });
    expect(created.phoneNumber).toBe("+5511987654322");
    expect(created.companyId).toBe("cA");
    expect(state.identities).toHaveLength(1);
  });

  it("rejects foreign users, MEMBER callers, duplicates, and invalid phones", async () => {
    const { db } = makeDb({
      identities: [identityRow()],
      members: [{ userId: "u1", companyId: "cA", isActive: true }],
    });
    await expect(provisionWhatsAppIdentity(db, { companyId: "cA", role: "OWNER" }, { userId: "stranger", phoneNumber: "+5511900000000" }))
      .rejects.toMatchObject({ status: 404 });
    await expect(provisionWhatsAppIdentity(db, { companyId: "cA", role: "MEMBER" }, { userId: "u1", phoneNumber: "+5511900000000" }))
      .rejects.toMatchObject({ status: 403 });
    await expect(provisionWhatsAppIdentity(db, { companyId: "cA", role: "ADMIN" }, { userId: "u1", phoneNumber: PHONE }))
      .rejects.toMatchObject({ status: 409 });
    await expect(provisionWhatsAppIdentity(db, { companyId: "cA", role: "OWNER" }, { userId: "u1", phoneNumber: "123" }))
      .rejects.toMatchObject({ status: 400 });
  });
});

describe("WhatsApp identity provisioning HTTP route", () => {
  function app(db: any, role: string) {
    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use((req: any, _res, next) => {
      req.auth = { userId: "u1", companyId: "cA", role };
      next();
    });
    expressApp.use("/api/whatsapp-identities", makeWhatsAppIdentitiesRouter(db));
    return expressApp;
  }

  it("provisions via POST and rejects authority-field spoofing", async () => {
    const { db } = makeDb({ members: [{ userId: "u2", companyId: "cA", isActive: true }] });
    const created = await request(app(db, "OWNER"))
      .post("/api/whatsapp-identities")
      .send({ userId: "u2", phoneNumber: "11987654330" });
    expect(created.status).toBe(201);
    expect(created.body.phoneNumber).toBe("+5511987654330");
    expect(created.body.companyId).toBe("cA");

    const spoofed = await request(app(db, "OWNER"))
      .post("/api/whatsapp-identities")
      .send({ userId: "u2", phoneNumber: "+5511900000001", companyId: "cOTHER", role: "OWNER" });
    expect(spoofed.status).toBe(400);
  });

  it("forbids MEMBER callers", async () => {
    const { db } = makeDb({ members: [{ userId: "u2", companyId: "cA", isActive: true }] });
    const res = await request(app(db, "MEMBER"))
      .post("/api/whatsapp-identities")
      .send({ userId: "u2", phoneNumber: "+5511900000002" });
    expect(res.status).toBe(403);
  });
});
