import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";
import { requireRole } from "../middleware/requireAuth";
import { demoGuard } from "../middleware/demoGuard";
import {
  addStage,
  getWorkflow,
  listWorkflows,
  removeStage,
  renameStage,
  reorderStages,
} from "../services/workflowService";

const router = Router();
router.use(requireCapability(Capability.WORKFLOW));

router.get("/", asyncHandler(async (req, res) => {
  res.json({ workflows: await listWorkflows(prisma, req.auth!.companyId) });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await getWorkflow(prisma, req.auth!.companyId, req.params.id));
}));

// ── Bounded V1 workflow configuration (OWNER/ADMIN only) ──────────────────

const nameSchema = z.object({ name: z.string().min(1).max(80) });
const reorderSchema = z.object({ stageIds: z.array(z.string().min(1).max(64)).min(1) });

router.post(
  "/:id/stages",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const input = parse(nameSchema, req.body);
    const stage = await addStage(prisma, req.auth!.companyId, req.params.id, input);
    res.status(201).json(stage);
  }),
);

router.patch(
  "/:id/stages/:stageId",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const input = parse(nameSchema, req.body);
    const stage = await renameStage(prisma, req.auth!.companyId, req.params.id, req.params.stageId, input);
    res.json(stage);
  }),
);

router.post(
  "/:id/reorder",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const input = parse(reorderSchema, req.body);
    await reorderStages(prisma, req.auth!.companyId, req.params.id, input.stageIds);
    res.json(await getWorkflow(prisma, req.auth!.companyId, req.params.id));
  }),
);

router.delete(
  "/:id/stages/:stageId",
  demoGuard,
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const result = await removeStage(prisma, req.auth!.companyId, req.params.id, req.params.stageId);
    res.json(result);
  }),
);

export default router;
