import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { approveSchema, requestChangesSchema } from "../lib/validation";
import { getByToken, approve, requestChanges } from "../services/approvalService";

const router = Router();

router.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const data = await getByToken(prisma, req.params.token);
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
  "/:token/request-changes",
  asyncHandler(async (req, res) => {
    const input = parse(requestChangesSchema, req.body);
    const approval = await requestChanges(prisma, req.params.token, input);
    res.json(approval);
  }),
);

export default router;
