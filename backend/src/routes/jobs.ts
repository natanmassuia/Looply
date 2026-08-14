import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";
import { createJob, getJob, listJobs, transitionJob, updateJob } from "../services/jobService";
import { listJobActivities } from "../services/activityService";

const router = Router();
router.use(requireCapability(Capability.JOBS));

const createSchema = z.object({
  title: z.string().min(1).max(200),
  clientId: z.string().min(1).max(64),
  notes: z.string().max(2000).optional(),
  format: z.enum(["POST", "REELS", "STORY", "CAROUSEL", "VIDEO", "IMAGE"]).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
  clientId: z.string().min(1).max(64).optional(),
  lifecycleStatus: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

router.get("/", asyncHandler(async (req, res) => {
  res.json({ jobs: await listJobs(prisma, req.auth!.companyId) });
}));

router.get("/:id/activity", requireCapability(Capability.ACTIVITY), asyncHandler(async (req, res) => {
  const activities = await listJobActivities(prisma, req.auth!.companyId, req.params.id);
  res.json({ activities });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await getJob(prisma, req.auth!.companyId, req.params.id));
}));

router.post("/", asyncHandler(async (req, res) => {
  const input = parse(createSchema, req.body);
  const job = await createJob(prisma, req.auth!.companyId, req.auth!.userId, input);
  res.status(201).json(job);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const input = parse(updateSchema, req.body);
  const job = await updateJob(prisma, req.auth!.companyId, req.auth!.userId, req.params.id, input);
  res.json(job);
}));

router.post("/:id/transition", requireCapability(Capability.WORKFLOW), asyncHandler(async (req, res) => {
  const input = parse(z.object({ stageId: z.string().min(1).max(64) }), req.body);
  const job = await transitionJob(prisma, req.auth!.companyId, req.auth!.userId, req.params.id, input.stageId);
  res.json(job);
}));

export default router;
