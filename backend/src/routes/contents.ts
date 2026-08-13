import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
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
    const content = await createContent(prisma, input);
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

export default router;
