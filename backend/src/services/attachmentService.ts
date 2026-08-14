import { randomUUID } from "node:crypto";
import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import type { ObjectStorage } from "../lib/storage";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function cleanOriginalName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
}

function keyFor(companyId: string, jobId: string): string {
  return `company/${companyId}/jobs/${jobId}/${randomUUID()}`;
}

function publicAttachment(file: {
  id: string;
  jobId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  etag?: string | null;
  createdAt: Date;
}) {
  return {
    id: file.id,
    jobId: file.jobId,
    originalName: file.originalName,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    status: file.status,
    etag: file.etag ?? null,
    createdAt: file.createdAt,
  };
}

export async function createUploadIntent(
  db: DB,
  storage: ObjectStorage,
  input: { companyId: string; jobId: string; uploadedByUserId: string; originalName: string; contentType: string; sizeBytes: number },
) {
  const job = await db.job.findFirst({ where: { id: input.jobId, companyId: input.companyId }, select: { id: true } });
  if (!job) throw notFound("Job não encontrado");
  const originalName = cleanOriginalName(input.originalName);
  if (!originalName) throw badRequest("Nome do arquivo inválido");
  if (!input.contentType || input.contentType.length > 160) throw badRequest("Tipo do arquivo inválido");
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw badRequest("Arquivo excede o limite permitido");
  }

  const storageKey = keyFor(input.companyId, input.jobId);
  const signed = await storage.createUploadUrl({ key: storageKey, contentType: input.contentType, sizeBytes: input.sizeBytes });
  const file = await db.jobAttachment.create({
    data: {
      companyId: input.companyId,
      jobId: input.jobId,
      uploadedByUserId: input.uploadedByUserId,
      storageKey,
      originalName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: "PENDING",
    },
  });
  return {
    file: publicAttachment(file),
    uploadUrl: signed.url,
    expiresAt: signed.expiresAt,
    headers: { "content-type": input.contentType, "content-length": String(input.sizeBytes) },
  };
}

export async function completeUpload(db: DB, storage: ObjectStorage, companyId: string, fileId: string) {
  const file = await db.jobAttachment.findFirst({ where: { id: fileId, companyId } });
  if (!file) throw notFound("Arquivo não encontrado");
  if (file.status === "AVAILABLE") return publicAttachment(file);
  if (file.status !== "PENDING") throw conflict("Upload não está pendente");

  const object = await storage.headObject(file.storageKey);
  if (!object) throw conflict("Objeto ainda não foi enviado");
  if (object.sizeBytes !== file.sizeBytes) throw badRequest("Tamanho do objeto não confere");
  if (object.contentType && object.contentType !== file.contentType) throw badRequest("Tipo do objeto não confere");

  await db.jobAttachment.updateMany({
    where: { id: fileId, companyId, status: "PENDING" },
    data: { status: "AVAILABLE", etag: object.etag ?? null },
  });
  const available = await db.jobAttachment.findFirst({ where: { id: fileId, companyId } });
  if (!available) throw notFound("Arquivo não encontrado");
  return publicAttachment(available);
}

export async function listJobAttachments(db: DB, companyId: string, jobId: string) {
  const job = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
  if (!job) throw notFound("Job não encontrado");
  const files = await db.jobAttachment.findMany({
    where: { companyId, jobId },
    orderBy: { createdAt: "desc" },
    select: { id: true, jobId: true, originalName: true, contentType: true, sizeBytes: true, status: true, etag: true, createdAt: true },
  });
  return files.map(publicAttachment);
}

export async function createDownloadUrl(db: DB, storage: ObjectStorage, companyId: string, fileId: string) {
  const file = await db.jobAttachment.findFirst({ where: { id: fileId, companyId } });
  if (!file) throw notFound("Arquivo não encontrado");
  if (file.status !== "AVAILABLE") throw conflict("Arquivo ainda não está disponível");
  const signed = await storage.createDownloadUrl({ key: file.storageKey, filename: file.originalName });
  return { url: signed.url, expiresAt: signed.expiresAt };
}

export async function deleteAttachment(db: DB, storage: ObjectStorage, companyId: string, fileId: string) {
  const file = await db.jobAttachment.findFirst({ where: { id: fileId, companyId }, select: { id: true, storageKey: true } });
  if (!file) throw notFound("Arquivo não encontrado");
  // Object deletion happens first. If it fails, metadata stays available for retry.
  await storage.deleteObject(file.storageKey);
  await db.jobAttachment.deleteMany({ where: { id: fileId, companyId } });
}
