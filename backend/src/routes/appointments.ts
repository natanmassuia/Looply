import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";
import {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
} from "../services/appointmentService";

const router = Router();
router.use(requireCapability(Capability.CALENDAR));

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  clientId: z.string().min(1).max(64).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  clientId: z.string().min(1).max(64).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

router.post("/", asyncHandler(async (req, res) => {
  const input = parse(createSchema, req.body);
  const appointment = await createAppointment(prisma, req.auth!.companyId, req.auth!.userId, {
    title: input.title,
    description: input.description,
    clientId: input.clientId,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
  });
  res.status(201).json(appointment);
}));

router.get("/", asyncHandler(async (req, res) => {
  const number = (value: unknown, fallback: number) => {
    const parsed = typeof value === "string" ? Number(value) : fallback;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const status = typeof req.query.status === "string" && ["SCHEDULED", "CANCELLED"].includes(req.query.status)
    ? req.query.status as "SCHEDULED" | "CANCELLED"
    : undefined;

  if (typeof req.query.status === "string" && !status) {
    res.status(400).json({ error: { code: "bad_request", message: "Invalid status" } });
    return;
  }

  res.json(await listAppointments(prisma, req.auth!.companyId, {
    clientId: typeof req.query.clientId === "string" ? req.query.clientId : undefined,
    status,
    page: number(req.query.page, 1),
    limit: Math.min(100, number(req.query.limit, 50)),
  }));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await getAppointment(prisma, req.auth!.companyId, req.params.id));
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const input = parse(updateSchema, req.body);
  const appointment = await updateAppointment(prisma, req.auth!.companyId, req.params.id, {
    title: input.title,
    description: input.description,
    clientId: input.clientId,
    startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
    endsAt: input.endsAt ? new Date(input.endsAt) : (input.endsAt === null ? null : undefined),
  });
  res.json(appointment);
}));

router.post("/:id/cancel", asyncHandler(async (req, res) => {
  const appointment = await cancelAppointment(prisma, req.auth!.companyId, req.params.id);
  res.json(appointment);
}));

export default router;
