import { describe, it, expect, beforeEach } from "vitest";
import type { DB } from "../src/lib/db";
import type { ObjectStorage } from "../src/lib/storage";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  createUserAvatarIntent,
  completeUserAvatarUpload,
  deleteUserAvatar,
  createCompanyLogoIntent,
  completeCompanyLogoUpload,
  deleteCompanyLogo,
  createClientLogoIntent,
  completeClientLogoUpload,
  deleteClientLogo,
  createContactAvatarIntent,
  completeContactAvatarUpload,
  deleteContactAvatar,
  resolveMediaDownloadUrl,
  validateImageIntent,
} from "../src/services/identityMediaService";

function makeMockStorage() {
  const store = new Map<string, { sizeBytes: number; contentType: string }>();
  const deletedKeys: string[] = [];

  const storage: ObjectStorage & { deletedKeys: string[]; store: Map<string, any> } = {
    deletedKeys,
    store,
    createUploadUrl: async ({ key }) => ({
      url: `https://storage.test/put/${encodeURIComponent(key)}`,
      expiresAt: new Date(Date.now() + 600_000),
    }),
    putObject: async ({ key, buffer, contentType }) => {
      store.set(key, { sizeBytes: buffer.length, contentType });
    },
    headObject: async (key) => {
      const item = store.get(key);
      if (!item) return null;
      return { sizeBytes: item.sizeBytes, contentType: item.contentType, etag: "etag-1" };
    },
    createDownloadUrl: async ({ key, filename }) => ({
      url: `https://storage.test/get/${encodeURIComponent(key)}?name=${encodeURIComponent(filename)}`,
      expiresAt: new Date(Date.now() + 600_000),
    }),
    deleteObject: async (key) => {
      deletedKeys.push(key);
      store.delete(key);
    },
  };

  return storage;
}

function makeMockDb() {
  const users: any[] = [
    {
      id: "usr-1",
      name: "User One",
      email: "user1@test.com",
      phone: "11999990001",
      avatarUrl: null,
    },
    {
      id: "usr-2",
      name: "User Two",
      email: "user2@test.com",
      phone: "11999990002",
      avatarUrl: "/api/media/file?key=users%2Fusr-2%2Favatar%2Fold-avatar.png",
    },
    {
      id: "usr-3",
      name: "User Three",
      email: "user3@test.com",
      phone: "11999990003",
      avatarUrl: null,
    },
  ];

  const members: any[] = [
    { userId: "usr-1", companyId: "comp-1", isActive: true },
    { userId: "usr-2", companyId: "comp-1", isActive: true },
    { userId: "usr-3", companyId: "comp-2", isActive: true },
  ];

  const companies: any[] = [
    {
      id: "comp-1",
      name: "Company One",
      logoUrl: null,
      timezone: "America/Sao_Paulo",
      phone: "1130000001",
    },
    {
      id: "comp-2",
      name: "Company Two",
      logoUrl: "/api/media/file?key=company%2Fcomp-2%2Flogo%2Fold-logo.png",
      timezone: "America/Sao_Paulo",
      phone: "1130000002",
    },
  ];

  const clients: any[] = [
    {
      id: "cli-1",
      companyId: "comp-1",
      name: "Client One Comp One",
      logoUrl: null,
    },
    {
      id: "cli-2",
      companyId: "comp-2",
      name: "Client Two Comp Two",
      logoUrl: "/api/media/file?key=company%2Fcomp-2%2Fclients%2Fcli-2%2Flogo%2Fold.png",
    },
  ];

  const now = new Date("2026-10-27T12:00:00.000Z");
  const conversations: any[] = [
    {
      id: "conv-1", companyId: "comp-1", provider: "whatsapp", remotePhone: "+5511999990001",
      contactName: "Contato Um", contactAvatarUrl: null, lastMessagePreview: null, lastMessageAt: null,
      unreadCount: 0, aiStatus: "ACTIVE", createdAt: now, updatedAt: now, client: null,
    },
    {
      id: "conv-2", companyId: "comp-2", provider: "whatsapp", remotePhone: "+5511999990002",
      contactName: "Contato Dois",
      contactAvatarUrl: "/api/media/file?key=company%2Fcomp-2%2Fconversations%2Fconv-2%2Favatar%2Fold.png",
      lastMessagePreview: null, lastMessageAt: null, unreadCount: 0, aiStatus: "ACTIVE",
      createdAt: now, updatedAt: now, client: null,
    },
  ];

  const db: any = {
    conversation: {
      findFirst: async ({ where }: any) =>
        conversations.find((c) => c.id === where.id && (where.companyId ? c.companyId === where.companyId : true)) ?? null,
      update: async ({ where, data }: any) => {
        const c = conversations.find((item) => item.id === where.id);
        if (!c) return null;
        Object.assign(c, data);
        return { ...c };
      },
    },
    user: {
      findUnique: async ({ where }: any) => users.find((u) => u.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const u = users.find((item) => item.id === where.id);
        if (!u) return null;
        Object.assign(u, data);
        return { ...u };
      },
    },
    company: {
      findUnique: async ({ where }: any) => companies.find((c) => c.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const c = companies.find((item) => item.id === where.id);
        if (!c) return null;
        Object.assign(c, data);
        return { ...c };
      },
    },
    client: {
      findFirst: async ({ where }: any) =>
        clients.find((c) => c.id === where.id && (where.companyId ? c.companyId === where.companyId : true)) ?? null,
      update: async ({ where, data }: any) => {
        const c = clients.find((item) => item.id === where.id);
        if (!c) return null;
        Object.assign(c, data);
        return { ...c };
      },
    },
    companyMember: {
      findFirst: async ({ where }: any) =>
        members.find(
          (m) =>
            m.userId === where.userId &&
            m.companyId === where.companyId &&
            (where.isActive === undefined || m.isActive === where.isActive),
        ) ?? null,
    },
  };

  return { db: db as unknown as DB, users, companies, clients, members, conversations };
}

describe("Identity Media Service — Security & Operations", () => {
  let storage: ReturnType<typeof makeMockStorage>;
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    storage = makeMockStorage();
    mockDb = makeMockDb();
  });

  describe("Validation & MIME Restrictions", () => {
    it("accepts valid image MIME types (jpeg, png, webp) within 5MB", () => {
      for (const mime of ALLOWED_IMAGE_MIME_TYPES) {
        const result = validateImageIntent({ contentType: mime, sizeBytes: 1024 * 1024 });
        expect(result.contentType).toBe(mime);
        expect(result.extension).toBeDefined();
      }
    });

    it("rejects forbidden MIME types (svg, html, executables, pdf)", () => {
      const invalid = ["image/svg+xml", "text/html", "application/javascript", "application/pdf", "image/gif"];
      for (const mime of invalid) {
        expect(() => validateImageIntent({ contentType: mime, sizeBytes: 1024 })).toThrowError(/não permitido/i);
      }
    });

    it("rejects files exceeding 5MB (5242880 bytes)", () => {
      expect(() =>
        validateImageIntent({ contentType: "image/png", sizeBytes: MAX_IMAGE_SIZE_BYTES + 1 }),
      ).toThrowError(/limite máximo/i);
    });

    it("rejects non-positive or non-integer sizeBytes", () => {
      expect(() => validateImageIntent({ contentType: "image/png", sizeBytes: 0 })).toThrowError();
      expect(() => validateImageIntent({ contentType: "image/png", sizeBytes: -100 })).toThrowError();
      expect(() => validateImageIntent({ contentType: "image/png", sizeBytes: 10.5 })).toThrowError();
    });
  });

  describe("User Avatar Operations", () => {
    it("creates upload intent with user-scoped key", async () => {
      const intent = await createUserAvatarIntent(storage, "usr-1", {
        contentType: "image/png",
        sizeBytes: 500_000,
      });

      expect(intent.uploadUrl).toBeDefined();
      expect(intent.key).toMatch(/^users\/usr-1\/avatar\/[a-f0-9-]+(\.png)?$/);
      expect(intent.headers["content-type"]).toBe("image/png");
    });

    it("rejects completing upload if key prefix does not match user id", async () => {
      await expect(
        completeUserAvatarUpload(mockDb.db, storage, "usr-1", "users/usr-2/avatar/hacked.png"),
      ).rejects.toThrowError(/não autorizada/i);
    });

    it("rejects completing upload if key contains path traversal", async () => {
      await expect(
        completeUserAvatarUpload(mockDb.db, storage, "usr-1", "users/usr-1/avatar/../other/pic.png"),
      ).rejects.toThrowError(/não autorizada/i);
    });

    it("rejects completing upload if object is not found in storage", async () => {
      const validKey = "users/usr-1/avatar/missing.png";
      await expect(
        completeUserAvatarUpload(mockDb.db, storage, "usr-1", validKey),
      ).rejects.toThrowError(/ainda não foi enviado/i);
    });

    it("completes upload, persists canonical URL and cleans up old avatar object", async () => {
      const key = "users/usr-2/avatar/new-avatar.png";
      storage.store.set(key, { sizeBytes: 200_000, contentType: "image/png" });

      const updated = await completeUserAvatarUpload(mockDb.db, storage, "usr-2", key);
      expect(updated.avatarUrl).toContain(encodeURIComponent(key));

      // Old object was cleaned up
      expect(storage.deletedKeys).toContain("users/usr-2/avatar/old-avatar.png");
    });

    it("deletes user avatar and cleans up storage object", async () => {
      const updated = await deleteUserAvatar(mockDb.db, storage, "usr-2");
      expect(updated.avatarUrl).toBeNull();
      expect(storage.deletedKeys).toContain("users/usr-2/avatar/old-avatar.png");
    });
  });

  describe("Company Logo Operations", () => {
    it("creates upload intent with company-scoped key", async () => {
      const intent = await createCompanyLogoIntent(storage, "comp-1", {
        contentType: "image/webp",
        sizeBytes: 300_000,
      });

      expect(intent.key).toMatch(/^company\/comp-1\/logo\/[a-f0-9-]+(\.webp)?$/);
    });

    it("rejects complete if key does not match company prefix", async () => {
      await expect(
        completeCompanyLogoUpload(mockDb.db, storage, "comp-1", "company/comp-2/logo/pic.png"),
      ).rejects.toThrowError(/não autorizada/i);
    });

    it("completes upload and cleans up old logo", async () => {
      const key = "company/comp-2/logo/new-logo.png";
      storage.store.set(key, { sizeBytes: 150_000, contentType: "image/png" });

      const updated = await completeCompanyLogoUpload(mockDb.db, storage, "comp-2", key);
      expect(updated.logoUrl).toContain(encodeURIComponent(key));
      expect(storage.deletedKeys).toContain("company/comp-2/logo/old-logo.png");
    });

    it("deletes company logo and cleans up storage object", async () => {
      const updated = await deleteCompanyLogo(mockDb.db, storage, "comp-2");
      expect(updated.logoUrl).toBeNull();
      expect(storage.deletedKeys).toContain("company/comp-2/logo/old-logo.png");
    });
  });

  describe("Client Logo Operations & Tenant Isolation", () => {
    it("creates client logo intent for tenant-owned client", async () => {
      const intent = await createClientLogoIntent(mockDb.db, storage, "comp-1", "cli-1", {
        contentType: "image/jpeg",
        sizeBytes: 400_000,
      });

      expect(intent.key).toMatch(/^company\/comp-1\/clients\/cli-1\/logo\/[a-f0-9-]+(\.jpg)?$/);
    });

    it("blocks creating client logo intent for cross-tenant client (returns 404)", async () => {
      // cli-2 belongs to comp-2, attempting with comp-1
      await expect(
        createClientLogoIntent(mockDb.db, storage, "comp-1", "cli-2", {
          contentType: "image/jpeg",
          sizeBytes: 400_000,
        }),
      ).rejects.toThrowError(/Cliente não encontrado/i);
    });

    it("completes client logo upload and cleans up old client logo", async () => {
      const key = "company/comp-2/clients/cli-2/logo/new.png";
      storage.store.set(key, { sizeBytes: 100_000, contentType: "image/png" });

      const updated = await completeClientLogoUpload(mockDb.db, storage, "comp-2", "cli-2", key);
      expect(updated.logoUrl).toContain(encodeURIComponent(key));
      expect(storage.deletedKeys).toContain("company/comp-2/clients/cli-2/logo/old.png");
    });

    it("blocks complete client logo if cross-tenant key prefix is spoofed", async () => {
      await expect(
        completeClientLogoUpload(mockDb.db, storage, "comp-1", "cli-1", "company/comp-2/clients/cli-2/logo/spoof.png"),
      ).rejects.toThrowError(/não autorizada/i);
    });

    it("deletes client logo for own tenant", async () => {
      const updated = await deleteClientLogo(mockDb.db, storage, "comp-2", "cli-2");
      expect(updated.logoUrl).toBeNull();
      expect(storage.deletedKeys).toContain("company/comp-2/clients/cli-2/logo/old.png");
    });

    it("blocks delete client logo for cross-tenant client", async () => {
      await expect(
        deleteClientLogo(mockDb.db, storage, "comp-1", "cli-2"),
      ).rejects.toThrowError(/Cliente não encontrado/i);
    });
  });

  describe("Conversation Contact Avatar (manual) & Tenant Isolation", () => {
    it("creates a conversation-scoped avatar intent for an owned conversation", async () => {
      const intent = await createContactAvatarIntent(mockDb.db, storage, "comp-1", "conv-1", {
        contentType: "image/png",
        sizeBytes: 100_000,
      });
      expect(intent.key).toMatch(/^company\/comp-1\/conversations\/conv-1\/avatar\/[a-f0-9-]+\.png$/);
    });

    it("blocks creating an avatar intent for a cross-tenant conversation (404)", async () => {
      await expect(
        createContactAvatarIntent(mockDb.db, storage, "comp-1", "conv-2", { contentType: "image/png", sizeBytes: 100_000 }),
      ).rejects.toThrowError(/Conversa não encontrada/i);
    });

    it("completes the avatar upload, persists the canonical URL and cleans up the old object", async () => {
      const key = "company/comp-2/conversations/conv-2/avatar/new.png";
      storage.store.set(key, { sizeBytes: 100_000, contentType: "image/png" });

      const updated = await completeContactAvatarUpload(mockDb.db, storage, "comp-2", "conv-2", key);
      expect(updated.contactAvatarUrl).toContain(encodeURIComponent(key));
      expect(storage.deletedKeys).toContain("company/comp-2/conversations/conv-2/avatar/old.png");
    });

    it("blocks complete when the key prefix is spoofed to another conversation/tenant", async () => {
      await expect(
        completeContactAvatarUpload(mockDb.db, storage, "comp-1", "conv-1", "company/comp-2/conversations/conv-2/avatar/spoof.png"),
      ).rejects.toThrowError(/não autorizada/i);
    });

    it("deletes the contact avatar for the owning tenant", async () => {
      const key = "company/comp-2/conversations/conv-2/avatar/set.png";
      storage.store.set(key, { sizeBytes: 50_000, contentType: "image/png" });
      await completeContactAvatarUpload(mockDb.db, storage, "comp-2", "conv-2", key);

      const updated = await deleteContactAvatar(mockDb.db, storage, "comp-2", "conv-2");
      expect(updated.contactAvatarUrl).toBeNull();
      expect(storage.deletedKeys).toContain(key);
    });
  });

  describe("Media Serving Authorization", () => {
    it("allows viewing a team member avatar within the same tenant", async () => {
      const auth = { userId: "usr-1", companyId: "comp-1" };
      // usr-2 is an active member of comp-1 → same-tenant avatar view allowed.
      const res = await resolveMediaDownloadUrl(mockDb.db, storage, auth, "users/usr-2/avatar/photo.png");
      expect(res.url).toContain("users%2Fusr-2%2Favatar%2Fphoto.png");
    });

    it("blocks viewing a cross-tenant member avatar (Tenant A cannot read Tenant B media)", async () => {
      const auth = { userId: "usr-1", companyId: "comp-1" };
      // usr-3 is a member of comp-2 only → not authorized for comp-1.
      await expect(
        resolveMediaDownloadUrl(mockDb.db, storage, auth, "users/usr-3/avatar/photo.png"),
      ).rejects.toThrowError(/não autorizado/i);
    });

    it("allows company members to view their own tenant company media", async () => {
      const auth = { userId: "usr-1", companyId: "comp-1" };
      const res = await resolveMediaDownloadUrl(mockDb.db, storage, auth, "company/comp-1/logo/logo.png");
      expect(res.url).toContain("company%2Fcomp-1%2Flogo%2Flogo.png");
    });

    it("blocks viewing other tenant company media (cross-tenant 403)", async () => {
      const auth = { userId: "usr-1", companyId: "comp-1" };
      await expect(
        resolveMediaDownloadUrl(mockDb.db, storage, auth, "company/comp-2/logo/logo.png"),
      ).rejects.toThrowError(/não autorizado/i);
    });

    it("rejects path traversal in key", async () => {
      const auth = { userId: "usr-1", companyId: "comp-1" };
      await expect(
        resolveMediaDownloadUrl(mockDb.db, storage, auth, "company/comp-1/../comp-2/secret.png"),
      ).rejects.toThrowError(/inválida/i);
    });
  });
});
