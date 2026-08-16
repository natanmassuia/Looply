import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { getObjectStorage } from "../lib/storage";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";
import {
  completeUpload,
  createDownloadUrl,
  createUploadIntent,
  deleteAttachment,
  listJobAttachments,
} from "../services/attachmentService";

const router = Router();
router.use(requireCapability(Capability.FILES));

const intentSchema = z.object({
  originalName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive(),
});

router.post("/jobs/:jobId/files/upload-intent", asyncHandler(async (req, res) => {
  const input = parse(intentSchema, req.body);
  const result = await createUploadIntent(prisma, getObjectStorage(), {
    ...input,
    companyId: req.auth!.companyId,
    jobId: req.params.jobId,
    uploadedByUserId: req.auth!.userId,
  });
  res.status(201).json(result);
}));

router.get("/jobs/:jobId/files", asyncHandler(async (req, res) => {
  res.json({ files: await listJobAttachments(prisma, req.auth!.companyId, req.params.jobId) });
}));

router.post("/files/:id/complete", asyncHandler(async (req, res) => {
  res.json(await completeUpload(prisma, getObjectStorage(), req.auth!.companyId, req.params.id));
}));

router.get("/files/:id/download", asyncHandler(async (req, res) => {
  res.json(await createDownloadUrl(prisma, getObjectStorage(), req.auth!.companyId, req.params.id));
}));

router.delete("/files/:id", asyncHandler(async (req, res) => {
  await deleteAttachment(prisma, getObjectStorage(), req.auth!.companyId, req.params.id);
  res.status(204).end();
}));

export default router;
