import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import { randomToken } from "../lib/token";
import { hashToken } from "../lib/password";
import { createActivity } from "./activityService";
import type { ObjectStorage } from "../lib/storage";

const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function invalidPublicApproval(): never {
  throw notFound("Link de aprovação inválido ou expirado");
}

async function loadPublicApproval(db: DB, token: string) {
  const approval = await db.approval.findFirst({
    where: { tokenHash: hashToken(token) },
    include: {
      content: { select: { id: true, title: true, client: { select: { name: true } } } },
      version: { select: { id: true, contentId: true, versionNumber: true, caption: true, mediaUrl: true, mediaType: true } },
      decisions: { orderBy: { createdAt: "asc" }, take: 100, select: { decision: true, comment: true, actorName: true, createdAt: true } },
      files: { take: 100, include: { attachment: { select: { id: true, originalName: true, contentType: true, sizeBytes: true, status: true } } } },
    },
  });
  if (!approval || approval.revokedAt || approval.expiresAt < new Date()) invalidPublicApproval();
  return approval;
}

export async function createApproval(
  db: DB,
  input: { companyId: string; jobId: string; versionId?: string; attachmentIds?: string[]; actorUserId?: string },
) {
  const job = await db.job.findFirst({ where: { id: input.jobId, companyId: input.companyId }, select: { id: true } });
  if (!job) throw notFound("Job não encontrado");
  const version = input.versionId
    ? await db.jobVersion.findFirst({ where: { id: input.versionId, contentId: input.jobId } })
    : await db.jobVersion.findFirst({ where: { contentId: input.jobId }, orderBy: { versionNumber: "desc" } });
  if (!version) throw notFound("Versão não encontrada");

  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 0) {
    const attachments = await db.jobAttachment.findMany({
      where: { id: { in: attachmentIds }, companyId: input.companyId, jobId: input.jobId, status: "AVAILABLE" },
      select: { id: true },
    });
    if (attachments.length !== new Set(attachmentIds).size) throw notFound("Arquivo não encontrado");
  }

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  const approval = await db.$transaction(async (tx) => {
    const created = await tx.approval.create({
      data: {
        companyId: input.companyId,
        contentId: input.jobId,
        contentVersionId: version.id,
        tokenHash: hashToken(token),
        expiresAt,
        status: "PENDING",
        files: attachmentIds.length ? { create: attachmentIds.map((attachmentId) => ({ attachmentId })) } : undefined,
      },
    });
    await createActivity(tx, {
      companyId: input.companyId,
      jobId: input.jobId,
      actorUserId: input.actorUserId,
      type: "APPROVAL_REQUESTED",
      metadata: { approvalId: created.id, versionId: version.id },
    });
    return created;
  });
  return { approval, token, expiresAt };
}

export async function listApprovals(db: DB, companyId: string, jobId: string) {
  const job = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
  if (!job) throw notFound("Job não encontrado");
  return db.approval.findMany({
    where: { companyId, contentId: jobId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, contentId: true, contentVersionId: true, status: true, feedback: true, clientName: true, expiresAt: true, revokedAt: true, decidedAt: true, createdAt: true },
  });
}

export async function getInternalApproval(db: DB, companyId: string, approvalId: string) {
  const approval = await db.approval.findFirst({
    where: { id: approvalId, companyId },
    select: { id: true, companyId: true, contentId: true, contentVersionId: true, status: true, feedback: true, clientName: true, expiresAt: true, revokedAt: true, decidedAt: true, createdAt: true, decisions: { orderBy: { createdAt: "asc" }, take: 100 } },
  });
  if (!approval) throw notFound("Approval não encontrado");
  return approval;
}

export async function revokeApproval(db: DB, companyId: string, approvalId: string, actorUserId: string) {
  const current = await db.approval.findFirst({ where: { id: approvalId, companyId }, select: { id: true, contentId: true, status: true, revokedAt: true, decidedAt: true } });
  if (!current) throw notFound("Approval não encontrado");
  if (current.decidedAt || current.status !== "PENDING") throw conflict("Approval já finalizado");
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.approval.updateMany({ where: { id: approvalId, companyId, status: "PENDING", revokedAt: null, decidedAt: null }, data: { status: "REVOKED", revokedAt: new Date() } });
    if (result.count === 0) throw conflict("Approval já finalizado");
    await createActivity(tx, { companyId, jobId: current.contentId, actorUserId, type: "APPROVAL_REVOKED", metadata: { approvalId } });
    return tx.approval.findFirst({ where: { id: approvalId, companyId } });
  });
  return updated;
}

type Decision = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";

function publicDecision(approval: { id: string; status: string; decidedAt: Date | null; feedback?: string | null }) {
  return { id: approval.id, status: approval.status, decidedAt: approval.decidedAt, feedback: approval.feedback ?? null };
}

async function decide(db: DB, token: string, decision: Decision, input: { reviewerName?: string; reviewerEmail?: string; comment?: string }) {
  if (decision === "CHANGES_REQUESTED" && !input.comment?.trim()) throw badRequest("Comentário é obrigatório");
  const approval = await loadPublicApproval(db, token);
  if (approval.status !== "PENDING" || approval.decidedAt) {
    const existing = approval.decisions[approval.decisions.length - 1];
    if (existing?.decision === decision) return publicDecision(approval);
    throw conflict("Este Approval já foi decidido");
  }

  const status = decision;
  const updated = await db.$transaction(async (tx) => {
    const changed = await tx.approval.updateMany({
      where: { id: approval.id, status: "PENDING", revokedAt: null, decidedAt: null, expiresAt: { gt: new Date() } },
      data: { status, decidedAt: new Date(), feedback: input.comment ?? null, clientName: input.reviewerName ?? null, clientReviewedAt: new Date() },
    });
    if (changed.count === 0) throw conflict("Este Approval já foi decidido");
    await tx.approvalDecision.create({ data: { approvalId: approval.id, decision, comment: input.comment ?? null, actorName: input.reviewerName ?? null, actorEmail: input.reviewerEmail ?? null, actorType: "PUBLIC" } });
    if (decision === "APPROVED" || decision === "CHANGES_REQUESTED") {
      await tx.job.updateMany({ where: { id: approval.contentId, companyId: approval.companyId }, data: { status: decision } });
    }
    await createActivity(tx, {
      companyId: approval.companyId,
      jobId: approval.contentId,
      type: decision === "APPROVED" ? "APPROVAL_APPROVED" : decision === "CHANGES_REQUESTED" ? "APPROVAL_CHANGES_REQUESTED" : "APPROVAL_REJECTED",
      metadata: { approvalId: approval.id, versionId: approval.contentVersionId },
    });
    const result = await tx.approval.findFirst({ where: { id: approval.id }, select: { id: true, status: true, decidedAt: true, feedback: true } });
    return publicDecision(result!);
  });
  return updated;
}

export async function approve(db: DB, token: string, input: { reviewerName?: string }) {
  return decide(db, token, "APPROVED", input);
}

export async function requestChanges(db: DB, token: string, input: { feedback: string; reviewerName?: string }) {
  return decide(db, token, "CHANGES_REQUESTED", { comment: input.feedback, reviewerName: input.reviewerName });
}

export async function reject(db: DB, token: string, input: { feedback?: string; reviewerName?: string }) {
  return decide(db, token, "REJECTED", { comment: input.feedback, reviewerName: input.reviewerName });
}

export async function getPublicApproval(db: DB, token: string) {
  const approval = await loadPublicApproval(db, token);
  return {
    id: approval.id,
    status: approval.status,
    expiresAt: approval.expiresAt,
    job: approval.content,
    version: approval.version,
    decisions: approval.decisions,
    files: approval.files.filter((file) => file.attachment.status === "AVAILABLE").map((file) => file.attachment),
  };
}

export async function publicFileDownload(db: DB, storage: ObjectStorage, token: string, fileId: string) {
  const approval = await loadPublicApproval(db, token);
  const file = await db.approvalAttachment.findFirst({
    where: { approvalId: approval.id, attachmentId: fileId, attachment: { companyId: approval.companyId, jobId: approval.contentId, status: "AVAILABLE" } },
    select: { attachment: { select: { id: true, storageKey: true, originalName: true } } },
  });
  if (!file) throw notFound("Arquivo não encontrado");
  return storage.createDownloadUrl({ key: file.attachment.storageKey, filename: file.attachment.originalName });
}

export { getPublicApproval as getByToken };
