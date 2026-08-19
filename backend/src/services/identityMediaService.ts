import { randomUUID } from "node:crypto";
import type { DB } from "../lib/db";
import { badRequest, conflict, notFound, forbidden } from "../lib/errors";
import type { ObjectStorage } from "../lib/storage";
import { logger } from "../lib/logger";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface MediaIntentInput {
  contentType: string;
  sizeBytes: number;
  originalName?: string;
}

export function validateImageIntent(input: MediaIntentInput): { extension: string; contentType: AllowedImageMimeType } {
  if (!input.contentType || !ALLOWED_IMAGE_MIME_TYPES.includes(input.contentType as AllowedImageMimeType)) {
    throw badRequest("Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    throw badRequest("Tamanho da imagem excede o limite máximo permitido de 5 MB.");
  }
  const contentType = input.contentType as AllowedImageMimeType;
  const extension = MIME_TO_EXT[contentType] || "bin";
  return { extension, contentType };
}

function extractStorageKeyFromUrl(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  if (urlOrKey.startsWith("/api/media/file?key=")) {
    try {
      const url = new URL(`http://localhost${urlOrKey}`);
      return url.searchParams.get("key");
    } catch {
      return null;
    }
  }
  if (urlOrKey.startsWith("users/") || urlOrKey.startsWith("company/")) {
    return urlOrKey;
  }
  return null;
}

async function safeDeleteOldObject(storage: ObjectStorage, oldUrlOrKey: string | null | undefined) {
  const oldKey = extractStorageKeyFromUrl(oldUrlOrKey);
  if (!oldKey) return;
  try {
    await storage.deleteObject(oldKey);
  } catch (err) {
    logger.warn("media_orphan_cleanup_failed", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── 1. USER AVATAR ─────────────────────────────────────────────────────────

export async function createUserAvatarIntent(
  storage: ObjectStorage,
  userId: string,
  input: MediaIntentInput,
) {
  const { extension, contentType } = validateImageIntent(input);
  const storageKey = `users/${userId}/avatar/${randomUUID()}.${extension}`;
  const signed = await storage.createUploadUrl({
    key: storageKey,
    contentType,
    sizeBytes: input.sizeBytes,
  });

  return {
    uploadUrl: signed.url,
    key: storageKey,
    expiresAt: signed.expiresAt,
    headers: {
      "content-type": contentType,
      "content-length": String(input.sizeBytes),
    },
  };
}

export async function completeUserAvatarUpload(
  db: DB,
  storage: ObjectStorage,
  userId: string,
  key: string,
) {
  const expectedPrefix = `users/${userId}/avatar/`;
  if (!key || !key.startsWith(expectedPrefix) || key.includes("..")) {
    throw forbidden("Chave de armazenamento inválida ou não autorizada");
  }

  const head = await storage.headObject(key);
  if (!head) {
    throw conflict("Objeto da imagem ainda não foi enviado");
  }
  if (head.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    throw badRequest("Imagem excede o limite máximo de 5 MB");
  }
  if (head.contentType && !ALLOWED_IMAGE_MIME_TYPES.includes(head.contentType as AllowedImageMimeType)) {
    throw badRequest("Tipo de conteúdo retornado pelo storage é inválido");
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Usuário não encontrado");

  const oldAvatar = user.avatarUrl;
  const canonicalUrl = `/api/media/file?key=${encodeURIComponent(key)}`;

  const updated = await db.user.update({
    where: { id: userId },
    data: { avatarUrl: canonicalUrl },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
  });

  await safeDeleteOldObject(storage, oldAvatar);
  return updated;
}

export async function deleteUserAvatar(
  db: DB,
  storage: ObjectStorage,
  userId: string,
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Usuário não encontrado");

  const oldAvatar = user.avatarUrl;
  const updated = await db.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
  });

  await safeDeleteOldObject(storage, oldAvatar);
  return updated;
}

// ── 2. COMPANY LOGO ────────────────────────────────────────────────────────

export async function createCompanyLogoIntent(
  storage: ObjectStorage,
  companyId: string,
  input: MediaIntentInput,
) {
  const { extension, contentType } = validateImageIntent(input);
  const storageKey = `company/${companyId}/logo/${randomUUID()}.${extension}`;
  const signed = await storage.createUploadUrl({
    key: storageKey,
    contentType,
    sizeBytes: input.sizeBytes,
  });

  return {
    uploadUrl: signed.url,
    key: storageKey,
    expiresAt: signed.expiresAt,
    headers: {
      "content-type": contentType,
      "content-length": String(input.sizeBytes),
    },
  };
}

export async function completeCompanyLogoUpload(
  db: DB,
  storage: ObjectStorage,
  companyId: string,
  key: string,
) {
  const expectedPrefix = `company/${companyId}/logo/`;
  if (!key || !key.startsWith(expectedPrefix) || key.includes("..")) {
    throw forbidden("Chave de armazenamento inválida ou não autorizada");
  }

  const head = await storage.headObject(key);
  if (!head) {
    throw conflict("Objeto da logo ainda não foi enviado");
  }
  if (head.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    throw badRequest("Logo excede o limite máximo de 5 MB");
  }
  if (head.contentType && !ALLOWED_IMAGE_MIME_TYPES.includes(head.contentType as AllowedImageMimeType)) {
    throw badRequest("Tipo de conteúdo retornado pelo storage é inválido");
  }

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw notFound("Empresa não encontrada");

  const oldLogo = company.logoUrl;
  const canonicalUrl = `/api/media/file?key=${encodeURIComponent(key)}`;

  const updated = await db.company.update({
    where: { id: companyId },
    data: { logoUrl: canonicalUrl },
    select: { id: true, name: true, logoUrl: true, timezone: true, phone: true },
  });

  await safeDeleteOldObject(storage, oldLogo);
  return updated;
}

export async function deleteCompanyLogo(
  db: DB,
  storage: ObjectStorage,
  companyId: string,
) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw notFound("Empresa não encontrada");

  const oldLogo = company.logoUrl;
  const updated = await db.company.update({
    where: { id: companyId },
    data: { logoUrl: null },
    select: { id: true, name: true, logoUrl: true, timezone: true, phone: true },
  });

  await safeDeleteOldObject(storage, oldLogo);
  return updated;
}

// ── 3. CLIENT LOGO ─────────────────────────────────────────────────────────

export async function createClientLogoIntent(
  db: DB,
  storage: ObjectStorage,
  companyId: string,
  clientId: string,
  input: MediaIntentInput,
) {
  const client = await db.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) throw notFound("Cliente não encontrado");

  const { extension, contentType } = validateImageIntent(input);
  const storageKey = `company/${companyId}/clients/${clientId}/logo/${randomUUID()}.${extension}`;
  const signed = await storage.createUploadUrl({
    key: storageKey,
    contentType,
    sizeBytes: input.sizeBytes,
  });

  return {
    uploadUrl: signed.url,
    key: storageKey,
    expiresAt: signed.expiresAt,
    headers: {
      "content-type": contentType,
      "content-length": String(input.sizeBytes),
    },
  };
}

export async function completeClientLogoUpload(
  db: DB,
  storage: ObjectStorage,
  companyId: string,
  clientId: string,
  key: string,
) {
  const client = await db.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) throw notFound("Cliente não encontrado");

  const expectedPrefix = `company/${companyId}/clients/${clientId}/logo/`;
  if (!key || !key.startsWith(expectedPrefix) || key.includes("..")) {
    throw forbidden("Chave de armazenamento inválida ou não autorizada");
  }

  const head = await storage.headObject(key);
  if (!head) {
    throw conflict("Objeto da foto do cliente ainda não foi enviado");
  }
  if (head.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    throw badRequest("Imagem excede o limite máximo de 5 MB");
  }
  if (head.contentType && !ALLOWED_IMAGE_MIME_TYPES.includes(head.contentType as AllowedImageMimeType)) {
    throw badRequest("Tipo de conteúdo retornado pelo storage é inválido");
  }

  const oldLogo = client.logoUrl;
  const canonicalUrl = `/api/media/file?key=${encodeURIComponent(key)}`;

  const updated = await db.client.update({
    where: { id: clientId },
    data: { logoUrl: canonicalUrl },
    select: {
      id: true,
      name: true,
      brandColor: true,
      status: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      channels: true,
      logoUrl: true,
    },
  });

  await safeDeleteOldObject(storage, oldLogo);
  return updated;
}

export async function deleteClientLogo(
  db: DB,
  storage: ObjectStorage,
  companyId: string,
  clientId: string,
) {
  const client = await db.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) throw notFound("Cliente não encontrado");

  const oldLogo = client.logoUrl;
  const updated = await db.client.update({
    where: { id: clientId },
    data: { logoUrl: null },
    select: {
      id: true,
      name: true,
      brandColor: true,
      status: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      channels: true,
      logoUrl: true,
    },
  });

  await safeDeleteOldObject(storage, oldLogo);
  return updated;
}

// ── 4. MEDIA SERVING / DOWNLOAD ────────────────────────────────────────────

export async function resolveMediaDownloadUrl(
  db: DB,
  storage: ObjectStorage,
  auth: { userId: string; companyId: string },
  key: string,
) {
  if (!key || key.includes("..")) {
    throw badRequest("Chave de armazenamento inválida");
  }

  // Authorization check:
  // 1. users/<userId>/avatar/ -> ONLY if that user is an active member of the
  //    requesting tenant. This prevents cross-tenant avatar/media disclosure
  //    (Tenant A must not read Tenant B's member media).
  // 2. company/<companyId>/ -> must belong to current active company
  if (key.startsWith("users/")) {
    const segments = key.split("/");
    const ownerUserId = segments[1];
    if (!ownerUserId) throw forbidden("Acesso não autorizado ao arquivo de mídia");
    const member = await db.companyMember.findFirst({
      where: { userId: ownerUserId, companyId: auth.companyId, isActive: true },
    });
    if (!member) throw forbidden("Acesso não autorizado ao arquivo de mídia");
  } else if (key.startsWith(`company/${auth.companyId}/`)) {
    // belongs to current tenant
  } else {
    throw forbidden("Acesso não autorizado ao arquivo de mídia");
  }

  const filename = key.split("/").pop() || "media";
  const signed = await storage.createDownloadUrl({ key, filename });
  return signed;
}
