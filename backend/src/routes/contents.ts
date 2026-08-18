import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler, badRequest } from "../lib/errors";
import { parse } from "../lib/parse";
import {
  createContentSchema,
  createVersionSchema,
  scheduleSchema,
} from "../lib/validation";
import { CONTENT_STATUSES, type ContentStatus } from "../domain/workflow";
import {
  createContent,
  listContents,
  getContent,
  moveToReview,
  sendForApproval,
  createVersion,
  schedule,
  publish,
  groupContent,
  ungroupContent,
} from "../services/contentService";
import { transitionJobLifecycle } from "../services/jobService";
import { env } from "../lib/env";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";

const router = Router();
router.use(requireCapability(Capability.JOBS));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !CONTENT_STATUSES.includes(status as ContentStatus)) {
      return res.status(400).json({ error: { code: "validation_error", message: "status inválido" } });
    }
    const contents = await listContents(prisma, req.auth!.companyId, status as ContentStatus | undefined);
    res.json({ contents });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(createContentSchema, req.body);
    const content = await createContent(prisma, input, req.auth!.companyId, req.auth!.userId);
    res.status(201).json(content);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const content = await getContent(prisma, req.auth!.companyId, req.params.id);
    res.json(content);
  }),
);

router.post(
  "/:id/review",
  asyncHandler(async (req, res) => {
    const content = await moveToReview(prisma, req.auth!.companyId, req.params.id);
    res.json(content);
  }),
);

router.post(
  "/:id/send-approval",
  asyncHandler(async (req, res) => {
    const { token } = await sendForApproval(prisma, req.auth!.companyId, req.params.id);
    res.json({
      token,
      approvalUrl: `${env.PUBLIC_APP_URL}/approve/${token}`,
    });
  }),
);

router.post(
  "/:id/versions",
  asyncHandler(async (req, res) => {
    const input = parse(createVersionSchema, req.body);
    const version = await createVersion(prisma, req.auth!.companyId, req.params.id, input, req.auth!.userId);
    res.status(201).json(version);
  }),
);

router.post(
  "/:id/schedule",
  asyncHandler(async (req, res) => {
    const input = parse(scheduleSchema, req.body);
    const content = await schedule(prisma, req.auth!.companyId, req.params.id, input);
    res.json(content);
  }),
);

router.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const content = await publish(prisma, req.auth!.companyId, req.params.id);
    res.json(content);
  }),
);

// Generic status transition for drag-and-drop
const statusSchema = z.object({
  status: z.enum(CONTENT_STATUSES as unknown as [string, ...string[]]),
});

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Status inválido");
    }
    const content = await prisma.job.findFirst({ where: { id: req.params.id, companyId: req.auth!.companyId } });
    if (!content) throw badRequest("Conteúdo não encontrado");

    const newStatus = parsed.data.status as ContentStatus;

    // Move parent + all children to the same column (cards move together)
    await prisma.$transaction([
      prisma.job.updateMany({
        where: { id: req.params.id, companyId: req.auth!.companyId },
        data: { status: newStatus },
      }),
      prisma.job.updateMany({
        where: { parentId: req.params.id, companyId: req.auth!.companyId },
        data: { status: newStatus },
      }),
    ]);
    res.json({ id: req.params.id, status: newStatus });
  }),
);

// Group: make childId a sub-ticket of parentId
const groupSchema = z.object({ parentId: z.string().min(1) });

router.post(
  "/:id/group",
  asyncHandler(async (req, res) => {
    const parsed = groupSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("parentId é obrigatório");
    const result = await groupContent(prisma, req.auth!.companyId, req.params.id, parsed.data.parentId);
    res.json(result);
  }),
);

// Ungroup: remove parent from a content item
router.post(
  "/:id/ungroup",
  asyncHandler(async (req, res) => {
    const result = await ungroupContent(prisma, req.auth!.companyId, req.params.id);
    res.json(result);
  }),
);

// Cancel: business-state cancellation (not physical delete). Uses the tested
// transitionJobLifecycle service: idempotent for CANCELLED, records a
// JOB_CANCELLED activity, preserves files/history/approvals. Tenant-scoped.
router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const job = await transitionJobLifecycle(prisma, req.auth!.companyId, req.auth!.userId, req.params.id, "CANCELLED");
    res.json(job);
  }),
);

export default router;
