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
import { env } from "../lib/env";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !CONTENT_STATUSES.includes(status as ContentStatus)) {
      return res.status(400).json({ error: { code: "validation_error", message: "status inválido" } });
    }
    const contents = await listContents(prisma, status as ContentStatus | undefined);
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
    const content = await getContent(prisma, req.params.id);
    res.json(content);
  }),
);

router.post(
  "/:id/review",
  asyncHandler(async (req, res) => {
    const content = await moveToReview(prisma, req.params.id);
    res.json(content);
  }),
);

router.post(
  "/:id/send-approval",
  asyncHandler(async (req, res) => {
    const { token } = await sendForApproval(prisma, req.params.id);
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
    const version = await createVersion(prisma, req.params.id, input);
    res.status(201).json(version);
  }),
);

router.post(
  "/:id/schedule",
  asyncHandler(async (req, res) => {
    const input = parse(scheduleSchema, req.body);
    const content = await schedule(prisma, req.params.id, input);
    res.json(content);
  }),
);

router.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const content = await publish(prisma, req.params.id);
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
    const content = await prisma.content.findUnique({ where: { id: req.params.id } });
    if (!content) throw badRequest("Conteúdo não encontrado");

    const newStatus = parsed.data.status as ContentStatus;

    // Move parent + all children to the same column (cards move together)
    await prisma.$transaction([
      prisma.content.update({
        where: { id: req.params.id },
        data: { status: newStatus },
      }),
      prisma.content.updateMany({
        where: { parentId: req.params.id },
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
    const result = await groupContent(prisma, req.params.id, parsed.data.parentId);
    res.json(result);
  }),
);

// Ungroup: remove parent from a content item
router.post(
  "/:id/ungroup",
  asyncHandler(async (req, res) => {
    const result = await ungroupContent(prisma, req.params.id);
    res.json(result);
  }),
);

export default router;
