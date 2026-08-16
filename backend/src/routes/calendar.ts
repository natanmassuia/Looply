import { Router } from "express";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";
import { getCalendar } from "../services/calendarService";

const router = Router();
router.use(requireCapability(Capability.CALENDAR));

router.get("/", asyncHandler(async (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const lifecycleStatus = typeof req.query.lifecycleStatus === "string" && ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(req.query.lifecycleStatus)
    ? req.query.lifecycleStatus as "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
    : undefined;
  res.json(await getCalendar(prisma, req.auth!.companyId, {
    from,
    to,
    clientId: typeof req.query.clientId === "string" ? req.query.clientId : undefined,
    stageId: typeof req.query.stageId === "string" ? req.query.stageId : undefined,
    lifecycleStatus,
  }));
}));

export default router;
