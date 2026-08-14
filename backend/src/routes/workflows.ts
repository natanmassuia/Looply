import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";
import { getWorkflow, listWorkflows } from "../services/workflowService";

const router = Router();
router.use(requireCapability(Capability.WORKFLOW));

router.get("/", asyncHandler(async (req, res) => {
  res.json({ workflows: await listWorkflows(prisma, req.auth!.companyId) });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await getWorkflow(prisma, req.auth!.companyId, req.params.id));
}));

export default router;
