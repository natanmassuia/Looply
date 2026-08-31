import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../src/lib/db";
import { login, logout } from "../src/services/authService";
import { seedCredentials } from "./seedCredentials";
import { tenantBLogin } from "./fixtures";
import { SESSION_COOKIE } from "../src/lib/session";
import { env } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";
import {
  DEFAULT_MODE,
  DEFAULT_PRESET,
  CUSTOM_COLOR_KEYS,
  HEX_COLOR_RE,
  isHexColor,
  normalizeHex,
  resolveAppearance,
  type CustomColors,
} from "../src/domain/appearance";
import { resolveWorkspaceContext } from "../src/domain/capabilities";
import { getAppearance, updateAppearance } from "../src/services/workspaceAppearanceService";
import { customColorsSchema, updateAppearanceSchema } from "../src/lib/validation";
import app from "../src/app";

// ── Fixtures ─────────────────────────────────────────────────────────────
const COLORS: CustomColors = {
  primary: "#A1B2C3",
  secondary: "#D4E5F6",
  accent: "#123456",
  surface: "#F0F1F2",
  text: "#101112",
  border: "#C0C1C2",
};

function makeAppearanceDB(seed: { companies?: Array<Record<string, any>> } = {}) {
  const state = { companies: seed.companies ?? [] };
  const db: any = {
    company: {
      findUnique: async ({ where }: any) =>
        state.companies.find((c) => c.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const c = state.companies.find((c) => c.id === where.id);
        if (!c) return null;
        Object.assign(c, data);
        return c;
      },
    },
  };
  return { db, state };
}

// ── Defaults (1-5) ───────────────────────────────────────────────────────
describe("appearance defaults", () => {
  it("1. existing workspace without appearance rows resolves AURA/LIGHT/null", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const appearance = await getAppearance(db, "c1");
    expect(appearance).toEqual({ preset: "AURA", mode: "LIGHT", customColors: null });
  });

  it("2. resolveAppearance default preset is AURA", () => {
    expect(resolveAppearance({}).preset).toBe("AURA");
    expect(DEFAULT_PRESET).toBe("AURA");
  });

  it("3. resolveAppearance default mode is LIGHT with null custom colors", () => {
    const a = resolveAppearance({});
    expect(a.mode).toBe("LIGHT");
    expect(DEFAULT_MODE).toBe("LIGHT");
    expect(a.customColors).toBeNull();
  });

  it("4. WorkspaceContext exposes appearance resolved from the company row", () => {
    const plain = resolveWorkspaceContext({ id: "c1", name: "X", workspaceTemplate: "LOCAL_BUSINESS" });
    expect(plain.appearance).toEqual({ preset: "AURA", mode: "LIGHT", customColors: null });
    const custom = resolveWorkspaceContext({
      id: "c2",
      name: "Y",
      workspaceTemplate: "MARKETING_AGENCY",
      appearancePreset: "CUSTOM",
      appearanceMode: "DARK",
      appearanceCustomPrimary: "#111111",
      appearanceCustomSecondary: "#222222",
      appearanceCustomAccent: "#333333",
      appearanceCustomSurface: "#444444",
      appearanceCustomText: "#555555",
      appearanceCustomBorder: "#666666",
    });
    expect(custom.appearance.preset).toBe("CUSTOM");
    expect(custom.appearance.mode).toBe("DARK");
    expect(custom.appearance.customColors?.primary).toBe("#111111");
  });

  it("5. getAppearance is scoped to the queried company only", async () => {
    const { db } = makeAppearanceDB({
      companies: [
        { id: "cA", appearancePreset: "CUSTOM", appearanceCustomPrimary: "#111111", appearanceCustomSecondary: "#222222", appearanceCustomAccent: "#333333", appearanceCustomSurface: "#444444", appearanceCustomText: "#555555", appearanceCustomBorder: "#666666" },
        { id: "cB" },
      ],
    });
    expect((await getAppearance(db, "cA")).preset).toBe("CUSTOM");
    expect(await getAppearance(db, "cB")).toEqual({ preset: "AURA", mode: "LIGHT", customColors: null });
    await expect(getAppearance(db, "cMissing")).rejects.toMatchObject({ status: 400 });
  });
});

// ── Presets (6-11) ───────────────────────────────────────────────────────
describe("appearance presets", () => {
  it("6. AURA accepted and persisted", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", { preset: "AURA" });
    expect(a.preset).toBe("AURA");
    expect((await getAppearance(db, "c1")).preset).toBe("AURA");
  });

  it("7. FLUX accepted and persisted", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", { preset: "FLUX" });
    expect(a.preset).toBe("FLUX");
  });

  it("8. PULSE accepted and persisted", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", { preset: "PULSE" });
    expect(a.preset).toBe("PULSE");
  });

  it("9. CUSTOM accepted with the complete six colors", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", { preset: "CUSTOM", customColors: COLORS });
    expect(a.preset).toBe("CUSTOM");
    expect(a.customColors).toEqual(COLORS);
  });

  it("10. invalid preset rejected at the contract", () => {
    const r = updateAppearanceSchema.safeParse({ preset: "NEON" });
    expect(r.success).toBe(false);
  });

  it("11. invalid mode rejected at the contract", () => {
    const r = updateAppearanceSchema.safeParse({ mode: "SEPIA" });
    expect(r.success).toBe(false);
  });
});

// ── Custom colors (12-21) ────────────────────────────────────────────────
describe("appearance custom colors", () => {
  it("12. CUSTOM without colors rejected by the service", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await expect(updateAppearance(db, "c1", { preset: "CUSTOM" })).rejects.toMatchObject({ status: 400 });
  });

  it("13. CUSTOM with a missing color rejected at the contract", () => {
    const { primary, ...missing } = COLORS;
    const r = customColorsSchema.safeParse(missing);
    expect(r.success).toBe(false);
  });

  it("14. extra arbitrary color key rejected (strict)", () => {
    const r = customColorsSchema.safeParse({ ...COLORS, brightness: "#000000" });
    expect(r.success).toBe(false);
  });

  it("15. malformed hex rejected (#GGGGGG)", () => {
    expect(isHexColor("#GGGGGG")).toBe(false);
    expect(customColorsSchema.safeParse({ ...COLORS, primary: "#GGGGGG" }).success).toBe(false);
  });

  it("16. #RGB shorthand rejected", () => {
    expect(isHexColor("#FFF")).toBe(false);
    expect(customColorsSchema.safeParse({ ...COLORS, primary: "#FFF" }).success).toBe(false);
  });

  // F14 — explicit `null` is the canonical "clear custom palette" intent
  // sent by the frontend when the chosen preset is NOT CUSTOM. Without this,
  // the Strict schema rejects every routine preset switch (FLUX/AURA/PULSE)
  // because it sends `customColors: null`.
  it("16b. explicit null accepted by the schema (canonical clear)", () => {
    expect(customColorsSchema.safeParse(null).success).toBe(true);
    const updateR = updateAppearanceSchema.safeParse({
      preset: "FLUX",
      mode: "LIGHT",
      customColors: null,
    });
    expect(updateR.success).toBe(true);
  });

  it("16c. non-CUSTOM preset + explicit null clears prior CUSTOM palette", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await updateAppearance(db, "c1", { preset: "CUSTOM", customColors: COLORS });
    const a = await updateAppearance(db, "c1", { preset: "FLUX", customColors: null });
    expect(a.preset).toBe("FLUX");
    expect(a.customColors).toBeNull();
  });

  it("17. CSS var() rejected", () => {
    expect(customColorsSchema.safeParse({ ...COLORS, primary: "var(--primary)" }).success).toBe(false);
  });

  it("18. url() rejected", () => {
    expect(customColorsSchema.safeParse({ ...COLORS, primary: "url(https://x/1.png)" }).success).toBe(false);
  });

  it("19. rgba()/hsl() rejected", () => {
    expect(customColorsSchema.safeParse({ ...COLORS, primary: "rgba(0,0,0,0.5)" }).success).toBe(false);
    expect(customColorsSchema.safeParse({ ...COLORS, primary: "hsl(0,0%,0%)" }).success).toBe(false);
  });

  it("20. valid #RRGGBB accepted and persisted", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", { preset: "CUSTOM", customColors: COLORS });
    expect(HEX_COLOR_RE.test(a.customColors!.primary)).toBe(true);
    expect((await getAppearance(db, "c1")).customColors).toEqual(COLORS);
  });

  it("21. canonical normalization is deterministic (uppercase stored)", async () => {
    const { db, state } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", {
      preset: "CUSTOM",
      customColors: { ...COLORS, primary: "#a1b2c3" },
    });
    expect(a.customColors!.primary).toBe("#A1B2C3");
    expect(normalizeHex("#a1b2c3")).toBe("#A1B2C3");
    expect(state.companies[0].appearanceCustomPrimary).toBe("#A1B2C3");
  });
});

// ── Transitions (22-27) ──────────────────────────────────────────────────
describe("appearance transitions", () => {
  it("22. AURA → CUSTOM works when colors are supplied", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", { preset: "CUSTOM", customColors: COLORS });
    expect(a.preset).toBe("CUSTOM");
    expect(a.customColors).toEqual(COLORS);
  });

  it("23. CUSTOM → FLUX works and custom colors are cleared", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await updateAppearance(db, "c1", { preset: "CUSTOM", customColors: COLORS });
    const a = await updateAppearance(db, "c1", { preset: "FLUX" });
    expect(a.preset).toBe("FLUX");
    expect(a.customColors).toBeNull();
    expect((await getAppearance(db, "c1")).customColors).toBeNull();
  });

  it("24. leaving CUSTOM clears the stored colors deterministically", async () => {
    const { db, state } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await updateAppearance(db, "c1", { preset: "CUSTOM", customColors: COLORS });
    await updateAppearance(db, "c1", { preset: "AURA" });
    expect(state.companies[0].appearanceCustomPrimary).toBeNull();
    expect(state.companies[0].appearanceCustomBorder).toBeNull();
  });

  it("25. DARK coexists with any preset", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    const a = await updateAppearance(db, "c1", { preset: "PULSE", mode: "DARK" });
    expect(a).toEqual({ preset: "PULSE", mode: "DARK", customColors: null });
  });

  it("26. mode-only PATCH preserves the preset", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await updateAppearance(db, "c1", { preset: "FLUX" });
    const a = await updateAppearance(db, "c1", { mode: "DARK" });
    expect(a.preset).toBe("FLUX");
    expect(a.mode).toBe("DARK");
  });

  it("27. preset-only PATCH preserves the mode", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await updateAppearance(db, "c1", { mode: "DARK" });
    const a = await updateAppearance(db, "c1", { preset: "FLUX" });
    expect(a.preset).toBe("FLUX");
    expect(a.mode).toBe("DARK");
  });

  it("customColors supplied with a non-CUSTOM preset is rejected", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await expect(updateAppearance(db, "c1", { preset: "FLUX", customColors: COLORS })).rejects.toMatchObject({ status: 400 });
  });
});

// ── HTTP contract (28-35) — live local dev DB ────────────────────────────
describe.skipIf(!process.env.DATABASE_URL)("appearance HTTP contract", () => {
  const cookie = (token: string) => `${SESSION_COOKIE}=${token}`;
  const memberEmail = `member-${Date.now()}@looply.dev`;
  let memberUser: any;

  beforeAll(async () => {
    await prisma.company.updateMany({
      where: { slug: "looply-studio" },
      data: {
        appearancePreset: null,
        appearanceMode: null,
        appearanceCustomPrimary: null,
        appearanceCustomSecondary: null,
        appearanceCustomAccent: null,
        appearanceCustomSurface: null,
        appearanceCustomText: null,
        appearanceCustomBorder: null,
      },
    });

    const creds = seedCredentials();
    const company = await prisma.company.findFirst({ where: { slug: "looply-studio" } });
    if (!company) throw new Error("No company found — seed must run before tests");
    const hash = await hashPassword(creds.password);
    memberUser = await prisma.user.create({
      data: {
        email: memberEmail,
        name: "Test Member",
        role: "CONTENT_MANAGER",
        active: true,
        passwordHash: hash,
      },
    });
    await prisma.companyMember.create({
      data: { userId: memberUser.id, companyId: company.id, role: "MEMBER", isActive: true },
    });
  });

  afterAll(async () => {
    if (memberUser) {
      await prisma.session.deleteMany({ where: { userId: memberUser.id } });
      await prisma.companyMember.deleteMany({ where: { userId: memberUser.id } });
      await prisma.user.delete({ where: { id: memberUser.id } });
    }
  });

  it("28. unauthenticated GET rejected", async () => {
    const res = await request(app).get("/api/settings/appearance");
    expect(res.status).toBe(401);
  });

  it("29. unauthenticated PATCH rejected", async () => {
    const res = await request(app).patch("/api/settings/appearance").send({ preset: "FLUX" });
    expect(res.status).toBe(401);
  });

  it("30. active MEMBER can read appearance", async () => {
    const session = await login(prisma, memberEmail, seedCredentials().password);
    const res = await request(app)
      .get("/api/settings/appearance")
      .set("Cookie", cookie(session.token));
    expect(res.status).toBe(200);
    expect(res.body.appearance).toMatchObject({ preset: "AURA", mode: "LIGHT" });
    await logout(prisma, session.token);
  });

  it("31. active MEMBER cannot mutate appearance", async () => {
    const session = await login(prisma, memberEmail, seedCredentials().password);
    const res = await request(app)
      .patch("/api/settings/appearance")
      .set("Cookie", cookie(session.token))
      .send({ preset: "FLUX" });
    expect(res.status).toBe(403);
    await logout(prisma, session.token);
  });

  it("32. OWNER can mutate appearance", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const res = await request(app)
      .patch("/api/settings/appearance")
      .set("Cookie", cookie(session.token))
      .set("Origin", env.CORS_ORIGIN)
      .send({ preset: "FLUX" });
    expect(res.status).toBe(200);
    expect(res.body.appearance.preset).toBe("FLUX");
    await logout(prisma, session.token);
  });

  it("33. tenants never see each other's appearance", async () => {
    const sessionA = await login(prisma, seedCredentials().email, seedCredentials().password);
    const sessionB = await tenantBLogin(prisma);
    const resA = await request(app).get("/api/settings/appearance").set("Cookie", cookie(sessionA.token));
    const resB = await request(app).get("/api/settings/appearance").set("Cookie", cookie(sessionB.token));
    expect(resA.body.appearance.preset).toBe("FLUX"); // set in test 32
    expect(resB.body.appearance).toMatchObject({ preset: "AURA", mode: "LIGHT" });
    await logout(prisma, sessionA.token);
    await logout(prisma, sessionB.token);
  });

  it("34. body companyId cannot override the session tenant", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const before = await request(app).get("/api/settings/appearance").set("Cookie", cookie(session.token));
    const res = await request(app)
      .patch("/api/settings/appearance")
      .set("Cookie", cookie(session.token))
      .set("Origin", env.CORS_ORIGIN)
      .send({ companyId: "someone-else", preset: "PULSE" });
    expect(res.status).toBe(400);
    const after = await request(app).get("/api/settings/appearance").set("Cookie", cookie(session.token));
    expect(after.body.appearance.preset).toBe(before.body.appearance.preset);
    await logout(prisma, session.token);
  });

  it("35. forged tenant field alone is rejected", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const res = await request(app)
      .patch("/api/settings/appearance")
      .set("Cookie", cookie(session.token))
      .send({ companyId: "cB" });
    expect(res.status).toBe(400);
    await logout(prisma, session.token);
  });

  it("workspace.appearance is exposed through /api/auth/me", async () => {
    const session = await login(prisma, seedCredentials().email, seedCredentials().password);
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie(session.token));
    expect(res.status).toBe(200);
    expect(res.body.workspace.appearance).toMatchObject({ mode: "LIGHT" });
    await logout(prisma, session.token);
  });

  afterAll(async () => {
    // Restore the demo workspace to its deterministic default (null columns).
    await prisma.company.updateMany({
      where: { slug: "looply-studio" },
      data: {
        appearancePreset: null,
        appearanceMode: null,
        appearanceCustomPrimary: null,
        appearanceCustomSecondary: null,
        appearanceCustomAccent: null,
        appearanceCustomSurface: null,
        appearanceCustomText: null,
        appearanceCustomBorder: null,
      },
    });
  });
});

// ── F4B service-contract tests (36-40) ───────────────────────────────────
// Direct onboarding integration is intentionally deferred to F4B (frontend).
// These prove F4B can call the SAME canonical appearance service. The
// onboarding PATCH /company endpoint is left unchanged.
describe("appearance F4B service contract", () => {
  it("36. canonical service callable before onboarding completes (no template)", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1", workspaceTemplate: null }] });
    const a = await updateAppearance(db, "c1", { preset: "FLUX", mode: "DARK" });
    expect(a).toEqual({ preset: "FLUX", mode: "DARK", customColors: null });
  });

  it("37. CUSTOM completeness invariant is identical for unconfigured workspaces", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1", workspaceTemplate: null }] });
    await expect(updateAppearance(db, "c1", { preset: "CUSTOM" })).rejects.toMatchObject({ status: 400 });
  });

  it("38. fresh company default is deterministic (AURA/LIGHT/null)", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1", workspaceTemplate: null }] });
    expect(await getAppearance(db, "c1")).toEqual({ preset: "AURA", mode: "LIGHT", customColors: null });
    expect(CUSTOM_COLOR_KEYS).toEqual(["primary", "secondary", "accent", "surface", "text", "border"]);
  });

  it("39. writes touch only the given companyId", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "cA" }, { id: "cB" }] });
    await updateAppearance(db, "cB", { preset: "FLUX" });
    expect((await getAppearance(db, "cA")).preset).toBe("AURA");
    expect((await getAppearance(db, "cB")).preset).toBe("FLUX");
  });

  it("40. single canonical round-trip is deterministic", async () => {
    const { db } = makeAppearanceDB({ companies: [{ id: "c1" }] });
    await updateAppearance(db, "c1", { preset: "CUSTOM", customColors: { ...COLORS, text: "#abcdef" } });
    const read = await getAppearance(db, "c1");
    expect(read.customColors).toEqual({ ...COLORS, text: "#ABCDEF" });
  });
});