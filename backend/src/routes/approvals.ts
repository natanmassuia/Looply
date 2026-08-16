import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { approveSchema, requestChangesSchema } from "../lib/validation";
import { getPublicApproval, approve, requestChanges, reject, publicFileDownload } from "../services/approvalService";
import { getObjectStorage } from "../lib/storage";
import { PUBLIC_APPROVAL_READ_LIMIT, PUBLIC_APPROVAL_WRITE_LIMIT } from "../lib/rateLimit";

const router = Router();
router.use((req, _res, next) => {
  if (req.method === "POST") return PUBLIC_APPROVAL_WRITE_LIMIT(req, _res, next);
  if (req.method === "GET") return PUBLIC_APPROVAL_READ_LIMIT(req, _res, next);
  next();
});

router.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const data = await getPublicApproval(prisma, req.params.token);
    res.json(data);
  }),
);

router.post(
  "/:token/approve",
  asyncHandler(async (req, res) => {
    const input = parse(approveSchema, req.body ?? {});
    const approval = await approve(prisma, req.params.token, input);
    res.json(approval);
  }),
);

router.post(
  "/:token/reject",
  asyncHandler(async (req, res) => {
    const input = parse(z.object({ reviewerName: z.string().max(120).optional(), feedback: z.string().max(5000).optional() }), req.body ?? {});
    const approval = await reject(prisma, req.params.token, input);
    res.json(approval);
  }),
);

router.get(
  "/:token/files/:fileId/download",
  asyncHandler(async (req, res) => {
    const signed = await publicFileDownload(prisma, getObjectStorage(), req.params.token, req.params.fileId);
    res.json(signed);
  }),
);

router.post(
  "/:token/request-changes",
  asyncHandler(async (req, res) => {
    const input = parse(requestChangesSchema, req.body);
    const approval = await requestChanges(prisma, req.params.token, input);
    res.json(approval);
  }),
);

export default router;
