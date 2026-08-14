import type { DB } from "../lib/db";
import { notFound, badRequest } from "../lib/errors";
import { assertCanTransition, type ContentStatus } from "../domain/workflow";
import type { ApproveInput, RequestChangesInput } from "../lib/validation";

export async function getByToken(db: DB, token: string) {
  const approval = await db.approval.findUnique({
    where: { token },
    include: {
      content: {
        include: {
          client: true,
          versions: { orderBy: { versionNumber: "desc" } },
        },
      },
      version: true,
    },
  });
  if (!approval) throw notFound("Link de aprovação inválido ou expirado");
  return approval;
}

export async function approve(db: DB, token: string, input: ApproveInput) {
  const approval = await db.approval.findUnique({
    where: { token },
    include: { content: true },
  });
  if (!approval) throw notFound("Link de aprovação inválido ou expirado");
  if (approval.status !== "PENDING") {
    throw badRequest("Este conteúdo já foi avaliado");
  }
  assertCanTransition(approval.content.status as ContentStatus, "APPROVED");

  return db.$transaction(async (tx) => {
    const [updatedApproval] = await Promise.all([
      tx.approval.update({
        where: { id: approval.id },
        data: {
          status: "APPROVED",
          clientName: input.reviewerName ?? null,
          clientReviewedAt: new Date(),
        },
      }),
      tx.job.update({
        where: { id: approval.contentId },
        data: { status: "APPROVED" },
      }),
    ]);
    return updatedApproval;
  });
}

export async function requestChanges(
  db: DB,
  token: string,
  input: RequestChangesInput,
) {
  const approval = await db.approval.findUnique({
    where: { token },
    include: { content: true },
  });
  if (!approval) throw notFound("Link de aprovação inválido ou expirado");
  if (approval.status !== "PENDING") {
    throw badRequest("Este conteúdo já foi avaliado");
  }
  assertCanTransition(approval.content.status as ContentStatus, "CHANGES_REQUESTED");

  return db.$transaction(async (tx) => {
    const [updatedApproval] = await Promise.all([
      tx.approval.update({
        where: { id: approval.id },
        data: {
          status: "CHANGES_REQUESTED",
          feedback: input.feedback,
          clientName: input.reviewerName ?? null,
          clientReviewedAt: new Date(),
        },
      }),
      tx.job.update({
        where: { id: approval.contentId },
        data: { status: "CHANGES_REQUESTED" },
      }),
    ]);
    return updatedApproval;
  });
}
