import { describe, it, expect, vi } from "vitest";
import type { DB } from "../src/lib/db";
import { requestPasswordRecovery, resetPasswordWithToken } from "../src/services/recoveryService";
import { verifyPassword, hashToken } from "../src/lib/password";
import { randomToken } from "../src/lib/token";
import type { MailService } from "../src/services/mailService";

function makeFakeDB(seed: { users?: any[]; tokens?: any[]; sessions?: any[] } = {}) {
  const state = {
    users: seed.users ?? [],
    tokens: seed.tokens ?? [],
    sessions: seed.sessions ?? [],
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
    passwordResetToken: {
      findUnique: async ({ where }: any) => {
        const t = state.tokens.find((x) => x.tokenHash === where.tokenHash);
        if (!t) return null;
        const u = state.users.find((user) => user.id === t.userId);
        return { ...t, user: u };
      },
      create: async ({ data }: any) => {
        const row = { id: `token-${state.tokens.length + 1}`, ...data };
        state.tokens.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const t = state.tokens.find((x) => x.id === where.id);
        if (t) Object.assign(t, data);
        return t;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const t of state.tokens) {
          if (t.userId === where.userId && (where.usedAt === undefined || t.usedAt === where.usedAt)) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      },
    },
    session: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of state.sessions) {
          if (s.userId === where.userId && (where.revokedAt === undefined || s.revokedAt === where.revokedAt)) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      },
    },
    _state: state,
  };

  return db;
}

describe("Password Recovery Service", () => {
  it("returns neutral success and dispatches email for existing active user", async () => {
    const db = makeFakeDB({
      users: [
        { id: "u1", name: "Alice", email: "alice@looply.com", active: true, passwordHash: "hash1" },
      ],
    });

    const sendMock = vi.fn().mockResolvedValue({ id: "resend-msg-123" });
    const mockMail: MailService = { sendPasswordResetEmail: sendMock };

    const result = await requestPasswordRecovery(db as unknown as DB, mockMail, "alice@looply.com");
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Se o e-mail estiver cadastrado/i);

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0][0].to).toBe("alice@looply.com");
    expect(sendMock.mock.calls[0][0].token).toBeDefined();

    // Verify hashed token stored
    expect(db._state.tokens.length).toBe(1);
    expect(db._state.tokens[0].userId).toBe("u1");
    expect(db._state.tokens[0].tokenHash).toBeDefined();
    expect(db._state.tokens[0].usedAt).toBeNull();
  });

  it("returns identical neutral success and does not dispatch email for non-existent user", async () => {
    const db = makeFakeDB();
    const sendMock = vi.fn();
    const mockMail: MailService = { sendPasswordResetEmail: sendMock };

    const result = await requestPasswordRecovery(db as unknown as DB, mockMail, "ghost@looply.com");
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Se o e-mail estiver cadastrado/i);
    expect(sendMock).not.toHaveBeenCalled();
    expect(db._state.tokens.length).toBe(0);
  });

  it("resets password successfully with valid token and revokes user sessions", async () => {
    const rawToken = randomToken(32);
    const db = makeFakeDB({
      users: [
        { id: "u1", name: "Bob", email: "bob@looply.com", active: true, passwordHash: "oldHash", mustChangePassword: false },
      ],
      tokens: [
        { id: "t1", userId: "u1", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 3600000), usedAt: null },
      ],
      sessions: [
        { id: "s1", userId: "u1", revokedAt: null },
        { id: "s2", userId: "u1", revokedAt: null },
      ],
    });

    const result = await resetPasswordWithToken(db as unknown as DB, rawToken, "NewSecurePassword123!");
    expect(result.ok).toBe(true);

    const user = db._state.users[0];
    expect(await verifyPassword("NewSecurePassword123!", user.passwordHash)).toBe(true);
    expect(user.mustChangePassword).toBe(false);

    // Token marked used
    expect(db._state.tokens[0].usedAt).not.toBeNull();

    // All active sessions revoked
    expect(db._state.sessions.every((s: any) => s.revokedAt !== null)).toBe(true);
  });

  it("rejects reset when token is expired", async () => {
    const rawToken = randomToken(32);
    const db = makeFakeDB({
      users: [{ id: "u1", name: "Charlie", email: "charlie@looply.com", active: true }],
      tokens: [
        { id: "t1", userId: "u1", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() - 1000), usedAt: null },
      ],
    });

    await expect(
      resetPasswordWithToken(db as unknown as DB, rawToken, "NewSecurePassword123!"),
    ).rejects.toThrow(/inválido ou expirado/i);
  });

  it("rejects reset when token is already used", async () => {
    const rawToken = randomToken(32);
    const db = makeFakeDB({
      users: [{ id: "u1", name: "Dave", email: "dave@looply.com", active: true }],
      tokens: [
        { id: "t1", userId: "u1", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 3600000), usedAt: new Date() },
      ],
    });

    await expect(
      resetPasswordWithToken(db as unknown as DB, rawToken, "NewSecurePassword123!"),
    ).rejects.toThrow(/inválido ou expirado/i);
  });

  it("rejects password shorter than minimum policy", async () => {
    const rawToken = randomToken(32);
    const db = makeFakeDB({
      users: [{ id: "u1", name: "Eve", email: "eve@looply.com", active: true }],
      tokens: [
        { id: "t1", userId: "u1", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 3600000), usedAt: null },
      ],
    });

    await expect(
      resetPasswordWithToken(db as unknown as DB, rawToken, "short"),
    ).rejects.toThrow(/10 e 200 caracteres/i);
  });
});
