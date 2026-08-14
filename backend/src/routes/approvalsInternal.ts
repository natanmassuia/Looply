import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";
import { createApproval, getInternalApproval, listApprovals, revokeApproval } from "../services/approvalService";

const router = Router();
router.use(requireCapability(Capability.APPROVAL));

const createSchema = z.object({
  versionId: z.string().min(1).max(64).optional(),
  attachmentIds: z.array(z.string().min(1).max(64)).max(20).optional(),
});

router.post("/jobs/:jobId/approvals", asyncHandler(async (req, res) => {
  const input = parse(createSchema, req.body ?? {});
  const result = await createApproval(prisma, {
    companyId: req.auth!.companyId,
    jobId: req.params.jobId,
    versionId: input.versionId,
    attachmentIds: input.attachmentIds,
    actorUserId: req.auth!.userId,
  });
  res.status(201).json({
    approvalId: result.approval.id,
    expiresAt: result.expiresAt,
    token: result.token,
    approvalUrl: `${env.PUBLIC_APP_URL}/approve/${result.token}`,
  });
}));

router.get("/jobs/:jobId/approvals", asyncHandler(async (req, res) => {
  res.json({ approvals: await listApprovals(prisma, req.auth!.companyId, req.params.jobId) });
}));

router.get("/approvals/:id", asyncHandler(async (req, res) => {
  res.json(await getInternalApproval(prisma, req.auth!.companyId, req.params.id));
}));

router.post("/approvals/:id/revoke", asyncHandler(async (req, res) => {
  res.json(await revokeApproval(prisma, req.auth!.companyId, req.params.id, req.auth!.userId));
}));

export default router;
